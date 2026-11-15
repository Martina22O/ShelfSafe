/**
 * Screen: InventoryListScreen
 * Reference: docs/design/mobile/03-inventory/inventory_mobile.png
 * Features:
 * - Search by name or barcode
 * - Horizontal scrolling category filter chips
 * - Stock status filter chips (All, Low Stock, Near Expiry, Expired)
 * - Product cards with SKU/Barcode, category pill, units, and FEFO expiry badge
 * - Archived products toggle & restore modal
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  BackHandler,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Search, Package, ArrowRight, X } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { InventoryStackParamList } from '../../navigation/types';
import {
  getInventory,
  getCategories,
  getArchivedProducts,
  restoreProduct,
} from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { ProductWithBatches, Category, ProductStockStatus, Product } from '../../types/inventory';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

const RefreshControlComponent = RefreshControl as any;

type Props = NativeStackScreenProps<InventoryStackParamList, 'InventoryList'>;

const STATUS_FILTERS = ['All Stocks', 'Low Stock', 'Near Expiry', 'Expired'] as const;
type StatusFilterType = (typeof STATUS_FILTERS)[number];

export default function InventoryListScreen({ navigation }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const {
    near_expiry_days,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useStoreSettings();

  const [allProducts, setAllProducts] = useState<ProductWithBatches[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterType>('All Stocks');

  // Archived products state
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [restoringProduct, setRestoringProduct] = useState<Product | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);

  // Prevent back navigation while restoring
  useEffect(() => {
    const backAction = () => {
      if (restoring) return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [restoring]);

  const loadData = async (isMounted = true) => {
    if (settingsLoading || settingsError) return;
    setError(null);
    const [invRes, catRes] = await Promise.all([
      getInventory(near_expiry_days),
      getCategories(),
    ]);

    if (!isMounted) return;

    if (invRes.kind === 'error') {
      setError(invRes.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setAllProducts(invRes.products);

    if (catRes.kind === 'success') {
      setCategories(catRes.categories);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (!settingsLoading && !settingsError) {
        loadData(isMounted);
        if (showArchived) {
          loadArchivedData(isMounted);
        }
      }
      return () => {
        isMounted = false;
      };
    }, [near_expiry_days, settingsLoading, settingsError, showArchived])
  );

  const loadArchivedData = async (isMounted = true) => {
    setLoadingArchived(true);
    const res = await getArchivedProducts();
    if (isMounted) {
      if (res.kind === 'success') {
        setArchivedProducts(res.products);
      }
      setLoadingArchived(false);
    }
  };

  const toggleShowArchived = () => {
    const next = !showArchived;
    setShowArchived(next);
    if (next) {
      loadArchivedData();
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setRestoreSuccess(null);
    loadData();
    if (showArchived) {
      loadArchivedData();
    }
  };

  const handleOpenRestoreModal = (product: Product) => {
    setRestoringProduct(product);
    setRestoreError(null);
    setRestoreModalVisible(true);
  };

  const handleConfirmRestore = async () => {
    if (!restoringProduct) return;
    setRestoring(true);
    setRestoreError(null);

    const res = await restoreProduct(restoringProduct.id);
    setRestoring(false);

    if (res.kind !== 'success') {
      setRestoreError(res.message);
      return;
    }

    setRestoreModalVisible(false);
    setRestoreSuccess(`"${restoringProduct.name}" restored to active inventory.`);
    setRestoringProduct(null);
    loadData();
    loadArchivedData();
  };

  // Client-side search & category filtering
  const categoryOptions = ['All Categories', ...categories.map((c) => c.name)];

  const filteredProducts = allProducts.filter((product) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = product.name.toLowerCase().includes(q);
      const matchBarcode = product.barcode ? product.barcode.toLowerCase().includes(q) : false;
      if (!matchName && !matchBarcode) return false;
    }

    if (selectedCategory !== 'All Categories') {
      const prodCatName = product.category ? product.category.name : 'Uncategorized';
      if (prodCatName !== selectedCategory) return false;
    }

    if (selectedStatus !== 'All Stocks') {
      if (selectedStatus === 'Low Stock' && !product.statuses.includes('Low stock')) return false;
      if (selectedStatus === 'Near Expiry' && !product.statuses.includes('Near expiry')) return false;
      if (selectedStatus === 'Expired' && !product.statuses.includes('Has expired stock')) return false;
    }

    return true;
  });

  const getStatusBadge = (statuses: ProductStockStatus[]) => {
    if (statuses.includes('Has expired stock')) {
      return { label: 'Expired', bg: COLORS.dangerLight, text: COLORS.danger, border: COLORS.dangerBorder };
    }
    if (statuses.includes('Near expiry')) {
      return { label: 'Near Expiry', bg: COLORS.amberLight, text: COLORS.amberDark, border: COLORS.amberBorder };
    }
    if (statuses.includes('Low stock')) {
      return { label: 'Low Stock', bg: COLORS.orangeLight, text: COLORS.orangeDark, border: COLORS.orangeBorder };
    }
    return { label: 'Good Stock', bg: COLORS.bgTint, text: COLORS.primary, border: '#d6f0b4' };
  };

  if (settingsLoading || (loading && !refreshing)) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading inventory...</Text>
      </SafeAreaView>
    );
  }

  if (settingsError || (error && !loading)) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error Loading Inventory</Text>
          <Text style={styles.errorText}>{settingsError || error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => (settingsError ? reloadSettings() : loadData())}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControlComponent
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Screen Background Image with Yellow Wave (scrolls naturally with content) */}
          <Image
            source={require('../../../assets/designs/screen-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Top Logo Row */}
          <View style={styles.topLogoRow}>
            <Image
              source={require('../../../assets/designs/shelfsafe-logo.jpg')}
              style={styles.screenLogo}
              resizeMode="contain"
            />
          </View>

          {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Inventory</Text>
            <Text style={styles.subtitle}>
              {allProducts.length} products • {filteredProducts.length} showing
            </Text>
          </View>

          <TouchableOpacity
            style={styles.archivedToggleBtn}
            onPress={toggleShowArchived}
          >
            <Text style={styles.archivedToggleText}>
              {showArchived ? 'Hide Archived' : 'Archived'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Restore Success Toast */}
        {restoreSuccess && (
          <View style={styles.successToast}>
            <Text style={styles.successToastText}>{restoreSuccess}</Text>
            <TouchableOpacity onPress={() => setRestoreSuccess(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={COLORS.primary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Search size={18} color={COLORS.textTertiary} strokeWidth={2} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search product name or barcode..."
            placeholderTextColor={COLORS.textSubtle}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={16} color={COLORS.textSecondary} strokeWidth={2} style={styles.clearSearch} />
            </TouchableOpacity>
          )}
        </View>

        {/* Status Filter Chips */}
        <View style={styles.chipSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {STATUS_FILTERS.map((status) => {
                const isSelected = selectedStatus === status;
                return (
                  <TouchableOpacity
                    key={status}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    onPress={() => setSelectedStatus(status)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {status}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Category Filter Chips */}
        <View style={styles.chipSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {categoryOptions.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Product List */}
        <View style={styles.listSection}>
          {filteredProducts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Package size={40} color={COLORS.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No products found</Text>
              <Text style={styles.emptySubtitle}>
                Try adjusting your search query or filters.
              </Text>
            </View>
          ) : (
            filteredProducts.map((product) => {
              const statusInfo = getStatusBadge(product.statuses);
              const catName = product.category ? product.category.name : 'General';

              return (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigation.navigate('ProductDetail', {
                      productId: product.id,
                      productName: product.name,
                    })
                  }
                >
                  <View style={styles.productCardHeader}>
                    <View style={styles.productMetaLeft}>
                      <View style={styles.categoryPill}>
                        <Text style={styles.categoryPillText}>{catName}</Text>
                      </View>
                      {product.barcode ? (
                        <Text style={styles.barcodeText}>{product.barcode}</Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: statusInfo.bg,
                          borderColor: statusInfo.border,
                        },
                      ]}
                    >
                      <Text style={[styles.statusPillText, { color: statusInfo.text }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.productName}>{product.name}</Text>

                  <View style={styles.productCardFooter}>
                    <View style={styles.stockInfoWrapper}>
                      <Text style={styles.stockUnitsValue}>
                        {product.total_units}{' '}
                        <Text style={styles.stockUnitsLabel}>units</Text>
                      </Text>
                      <Text style={styles.batchCountText}>
                        • {product.batch_count} {product.batch_count === 1 ? 'batch' : 'batches'}
                      </Text>
                    </View>

                    <View style={styles.viewDetailLinkRow}>
                      <Text style={styles.viewDetailLink}>Details</Text>
                      <ArrowRight size={14} color={COLORS.primary} strokeWidth={2} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Archived Products Section */}
        {showArchived && (
          <View style={styles.archivedSection}>
            <Text style={styles.archivedSectionTitle}>Archived Products</Text>
            {loadingArchived ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
            ) : archivedProducts.length === 0 ? (
              <Text style={styles.archivedEmptyText}>No archived products.</Text>
            ) : (
              archivedProducts.map((p) => (
                <View key={p.id} style={styles.archivedCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.archivedName}>{p.name}</Text>
                    <Text style={styles.archivedBarcode}>{p.barcode || 'No barcode'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.restoreBtn}
                    onPress={() => handleOpenRestoreModal(p)}
                  >
                    <Text style={styles.restoreBtnText}>Restore</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Restore Confirmation Modal */}
      <Modal
        visible={restoreModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!restoring) setRestoreModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Restore Product?</Text>
            <Text style={styles.modalDesc}>
              Restore "{restoringProduct?.name}" back to active inventory with its existing batches.
            </Text>

            {restoreError && <Text style={styles.modalError}>{restoreError}</Text>}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setRestoreModalVisible(false)}
                disabled={restoring}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleConfirmRestore}
                disabled={restoring}
              >
                {restoring ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Restore</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  safeArea: {
    flex: 1,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.dangerDark,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.dangerDark,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 36,
  },
  topLogoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  screenLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  archivedToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  archivedToggleText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
  },
  successToast: {
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  successToastText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    flex: 1,
  },
  toastClose: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  clearSearch: {
    fontSize: 14,
    color: COLORS.textSubtle,
    padding: 4,
  },
  chipSection: {
    marginBottom: 10,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: COLORS.bgTint,
    borderColor: COLORS.primary,
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  categoryChipTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  listSection: {
    marginTop: 26,
    gap: 12,
  },
  emptyContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  emptySubtitle: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  productCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  productCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  productMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryPill: {
    backgroundColor: COLORS.bgWarm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  categoryPillText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
  },
  barcodeText: {
    fontSize: 10,
    fontFamily: FONTS.regular,
    color: COLORS.textSubtle,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 8,
  },
  productCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 8,
  },
  stockInfoWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  stockUnitsValue: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.text,
  },
  stockUnitsLabel: {
    fontSize: 11,
    fontWeight: 'normal',
    color: COLORS.textMuted,
  },
  batchCountText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  viewDetailLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewDetailLink: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  archivedSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  archivedSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  archivedEmptyText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textSubtle,
    fontStyle: 'italic',
  },
  archivedCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  archivedName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  archivedBarcode: {
    fontSize: 11,
    color: COLORS.textSubtle,
    marginTop: 2,
  },
  restoreBtn: {
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  restoreBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  modalError: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 12,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textMuted,
  },
  modalConfirmBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
