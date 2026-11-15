/**
 * Screen: ProductDetailScreen
 * Reference: docs/design/mobile/03-inventory/sample-inventory_mobile.png
 * Features:
 * - Product metadata header with category, barcode, and price
 * - Stat cards (Total Left, Sellable FEFO, Batches) with icons on left
 * - FEFO batch breakdown (earliest expiry first) with days countdown
 * - Quantity correction modal
 * - Batch dates edit modal
 * - Delete batch & Delete product confirmation modals
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  BackHandler,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Edit, Trash2, Plus, Package, ShieldCheck, Layers } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { InventoryStackParamList } from '../../navigation/types';
import {
  getProductWithBatches,
  getBatch,
  correctBatchQuantity,
  updateBatchDates,
  removeBatch,
  removeProduct,
} from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { ProductWithBatches, ProductStockStatus, Batch } from '../../types/inventory';
import {
  formatDisplayDate,
  getTodayInManila,
  getBatchStatus,
  BatchStockStatus,
  isValidCalendarDate,
  isDateInPast,
} from '../../utils/date';
import DateField from '../../components/DateField';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

const RefreshControlComponent = RefreshControl as any;

type Props = NativeStackScreenProps<InventoryStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = (Platform.OS === 'ios' ? 44 : 56) + insets.top;
  const { width: screenWidth } = useWindowDimensions();
  const bgScale = screenWidth / 402;
  const bgHeight = screenWidth * (856 / 402);

  const {
    near_expiry_days,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useStoreSettings();
  const productId = route.params?.productId;

  const [product, setProduct] = useState<ProductWithBatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productNotFound, setProductNotFound] = useState(false);

  // Status banners
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Correct Quantity Modal State
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [fetchingBatch, setFetchingBatch] = useState(false);
  const [newQtyInput, setNewQtyInput] = useState('');
  const [qtyStep, setQtyStep] = useState<'input' | 'confirm'>('input');
  const [qtyModalError, setQtyModalError] = useState<string | null>(null);

  // Edit Dates Modal State
  const [datesModalVisible, setDatesModalVisible] = useState(false);
  const [purchaseDateInput, setPurchaseDateInput] = useState('');
  const [expirationDateInput, setExpirationDateInput] = useState('');
  const [datesStep, setDatesStep] = useState<'input' | 'confirm'>('input');
  const [datesModalError, setDatesModalError] = useState<string | null>(null);

  // Delete Batch Modal State
  const [deleteBatchModalVisible, setDeleteBatchModalVisible] = useState(false);

  // Delete Product Modal State
  const [deleteProductModalVisible, setDeleteProductModalVisible] = useState(false);

  // Prevent hardware back navigation during active saving
  useEffect(() => {
    const backAction = () => {
      if (saving) return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [saving]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!saving) return;
      e.preventDefault();
    });
    return unsubscribe;
  }, [navigation, saving]);

  const loadProduct = async (isMounted = true) => {
    if (!productId) {
      setProductNotFound(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (settingsLoading || settingsError) return;
    setError(null);

    const res = await getProductWithBatches(productId, near_expiry_days);
    if (!isMounted) return;

    setLoading(false);
    setRefreshing(false);

    if (res.kind === 'not_found') {
      setProductNotFound(true);
      return;
    }

    if (res.kind === 'error') {
      setError(res.message);
      return;
    }

    setProduct(res.data);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (!settingsLoading && !settingsError) {
        loadProduct(isMounted);
      }
      return () => {
        isMounted = false;
      };
    }, [productId, near_expiry_days, settingsLoading, settingsError])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setActionSuccess(null);
    setActionError(null);
    loadProduct();
  };

  // Correct Quantity Handlers
  const openQtyModal = async (batch: Batch) => {
    setActiveBatch(batch);
    setNewQtyInput(String(batch.quantity_left));
    setQtyStep('input');
    setQtyModalError(null);
    setQtyModalVisible(true);
    setFetchingBatch(true);

    const fresh = await getBatch(batch.id);
    setFetchingBatch(false);
    if (fresh.kind === 'success') {
      setActiveBatch(fresh.batch);
      setNewQtyInput(String(fresh.batch.quantity_left));
    }
  };

  const handleQtySubmit = () => {
    const trimmed = newQtyInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      setQtyModalError('Quantity must be a valid whole number (0 to 100,000)');
      return;
    }
    const val = Number(trimmed);
    if (val < 0 || val > 100000) {
      setQtyModalError('Quantity must be between 0 and 100,000');
      return;
    }
    setQtyStep('confirm');
  };

  const confirmQtyCorrection = async () => {
    if (!activeBatch) return;
    setSaving(true);
    setQtyModalError(null);

    const val = Number(newQtyInput.trim());
    const res = await correctBatchQuantity(activeBatch.id, val);

    if (res.kind === 'db_error') {
      setQtyModalError(res.message);
      setQtyStep('input');
      setSaving(false);
      return;
    }

    if (res.kind === 'network_timeout') {
      setQtyModalVisible(false);
      setActionError(res.message);
      await loadProduct();
      setSaving(false);
      return;
    }

    setQtyModalVisible(false);
    setActionSuccess(`Batch quantity updated to ${val} units.`);
    await loadProduct();
    setSaving(false);
  };

  // Edit Dates Handlers
  const openDatesModal = (batch: Batch) => {
    setActiveBatch(batch);
    setPurchaseDateInput(batch.purchase_date);
    setExpirationDateInput(batch.expiration_date);
    setDatesStep('input');
    setDatesModalError(null);
    setDatesModalVisible(true);
  };

  const handleDatesSubmit = () => {
    setDatesModalError(null);
    if (!purchaseDateInput.trim() || !expirationDateInput.trim()) {
      setDatesModalError('Both purchase date and expiration date are required (YYYY-MM-DD)');
      return;
    }
    if (!isValidCalendarDate(purchaseDateInput.trim()) || !isValidCalendarDate(expirationDateInput.trim())) {
      setDatesModalError('Dates must be valid calendar dates formatted YYYY-MM-DD');
      return;
    }
    setDatesStep('confirm');
  };

  const confirmDatesUpdate = async () => {
    if (!activeBatch) return;
    setSaving(true);
    setDatesModalError(null);

    const res = await updateBatchDates(
      activeBatch.id,
      purchaseDateInput.trim(),
      expirationDateInput.trim()
    );

    if (res.kind === 'db_error') {
      setDatesModalError(res.message);
      setDatesStep('input');
      setSaving(false);
      return;
    }

    if (res.kind === 'network_timeout') {
      setDatesModalVisible(false);
      setActionError(res.message);
      await loadProduct();
      setSaving(false);
      return;
    }

    setDatesModalVisible(false);
    setActionSuccess('Batch dates updated successfully.');
    await loadProduct();
    setSaving(false);
  };

  // Delete Batch Handlers
  const openDeleteBatchModal = (batch: Batch) => {
    setActiveBatch(batch);
    setDeleteBatchModalVisible(true);
  };

  const confirmDeleteBatch = async () => {
    if (!activeBatch) return;
    setSaving(true);
    setActionError(null);

    const res = await removeBatch(activeBatch.id);
    setDeleteBatchModalVisible(false);

    if (res.kind !== 'success') {
      setActionError(res.message);
      setSaving(false);
      return;
    }

    const actionText = res.data.action === 'archived' ? 'archived' : 'deleted';
    setActionSuccess(`Batch ${actionText} successfully.`);
    await loadProduct();
    setSaving(false);
  };

  // Delete Product Handlers
  const confirmDeleteProduct = async () => {
    if (!product) return;
    setSaving(true);
    setActionError(null);

    const res = await removeProduct(product.id);
    setDeleteProductModalVisible(false);
    setSaving(false);

    if (res.kind !== 'success') {
      setActionError(res.message);
      return;
    }

    const actionText = res.data.action === 'archived' ? 'archived' : 'deleted';
    setActionSuccess(`Product ${actionText}.`);
    setTimeout(() => {
      navigation.navigate('InventoryList');
    }, 600);
  };

  const getStatusBadge = (status: ProductStockStatus) => {
    switch (status) {
      case 'Has expired stock':
        return { label: 'Expired Stock', bg: COLORS.dangerLight, text: COLORS.danger, border: COLORS.dangerBorder };
      case 'Low stock':
        return { label: 'Low Stock', bg: COLORS.orangeLight, text: COLORS.orangeDark, border: COLORS.orangeBorder };
      case 'Near expiry':
        return { label: 'Near Expiry', bg: COLORS.amberLight, text: COLORS.amberDark, border: COLORS.amberBorder };
      case 'In Stock':
      default:
        return { label: 'In Stock', bg: COLORS.bgTint, text: COLORS.primary, border: '#d6f0b4' };
    }
  };

  const getBatchBadge = (status: BatchStockStatus) => {
    switch (status) {
      case 'Sold out':
        return { label: 'Sold Out', bg: '#f1f5f9', text: COLORS.textMuted, border: COLORS.border };
      case 'Expired':
        return { label: 'Expired', bg: COLORS.dangerLight, text: COLORS.danger, border: COLORS.dangerBorder };
      case 'Near Expiry':
        return { label: 'Near Expiry', bg: COLORS.amberLight, text: COLORS.amberDark, border: COLORS.amberBorder };
      case 'Good':
      default:
        return { label: 'Good', bg: COLORS.bgTint, text: COLORS.primary, border: '#d6f0b4' };
    }
  };

  if (productNotFound && !loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right', 'bottom']}>
        <Text style={styles.notFoundTitle}>Product Not Found</Text>
        <Text style={styles.notFoundSub}>
          This product may have been archived or removed.
        </Text>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={16} color={COLORS.primary} strokeWidth={2.2} style={{ marginRight: 6 }} />
          <Text style={styles.backButtonText}>Back to Inventory</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Sort batches earliest expiry first (FEFO)
  const sortedBatches = (product?.batches || []).slice().sort((a, b) => {
    return a.expiration_date.localeCompare(b.expiration_date);
  });

  if (settingsLoading || (loading && !refreshing)) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </SafeAreaView>
    );
  }

  if (settingsError || (error && !loading)) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error Loading Product</Text>
          <Text style={styles.errorText}>{settingsError || error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => (settingsError ? reloadSettings() : loadProduct(true))}
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

      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 12 },
          ]}
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

          {/* Action Success / Error Toasts */}
          {actionSuccess && (
            <View style={styles.toastSuccess}>
              <Text style={styles.toastSuccessText}>{actionSuccess}</Text>
            </View>
          )}
          {actionError && (
            <View style={styles.toastError}>
              <Text style={styles.toastErrorText}>{actionError}</Text>
            </View>
          )}

          {/* Product Details Header Section (Clean layout against powdered white canvas) */}
          {product && (
            <View style={styles.prodHeaderSection}>
              {/* Product Title and Edit Product in the Same Row */}
              <View style={styles.productHeadingRow}>
                <Text style={styles.productTitle}>{product.name}</Text>
                {!product?.is_archived && (
                  <TouchableOpacity
                    style={styles.editProdBtn}
                    onPress={() =>
                      product && navigation.navigate('EditProduct', { productId: product.id })
                    }
                    disabled={saving}
                  >
                    <Edit size={13} color={COLORS.text} strokeWidth={2.2} style={{ marginRight: 5 }} />
                    <Text style={styles.editProdText}>Edit Product</Text>
                  </TouchableOpacity>
                )}
              </View>

              {product.barcode ? (
                <Text style={styles.barcodeLabel}>{product.barcode}</Text>
              ) : null}

              <View style={styles.metaPillsRow}>
                <View style={styles.metaPill}>
                  <Package size={13} color={COLORS.primary} strokeWidth={2} style={{ marginRight: 5 }} />
                  <Text style={styles.metaPillText}>
                    {product.category?.name || 'General Category'}
                  </Text>
                </View>

                <View style={styles.metaPill}>
                  <Text style={styles.metaPillPriceText}>
                    ₱{product.price.toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Status Pills */}
              {product.statuses.length > 0 && (
                <View style={styles.statusPillsRow}>
                  {product.statuses.map((s) => {
                    const b = getStatusBadge(s);
                    return (
                      <View
                        key={s}
                        style={[
                          styles.statusPillBadge,
                          { backgroundColor: b.bg, borderColor: b.border },
                        ]}
                      >
                        <Text style={[styles.statusPillText, { color: b.text }]}>
                          {b.label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Overview Stat Boxes - Vertical layout with prominent numbers and clean units */}
          {product && (
            <View style={styles.statsRow}>
              {/* Total Left */}
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIconBadge, { backgroundColor: COLORS.bgTint }]}>
                    <Package size={14} color={COLORS.primary} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.statLabel} numberOfLines={2}>
                    Total Left
                  </Text>
                </View>
                <Text
                  style={styles.statNumber}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {product.total_units.toLocaleString()}
                </Text>
                <Text style={styles.statUnit}>units</Text>
              </View>

              {/* Sellable FEFO */}
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#f0fdf4' }]}>
                    <ShieldCheck size={14} color={COLORS.primary} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.statLabel} numberOfLines={2}>
                    Sellable
                  </Text>
                </View>
                <Text
                  style={[styles.statNumber, { color: COLORS.primary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {product.sellable_units.toLocaleString()}
                </Text>
                <Text style={styles.statUnit}>units</Text>
              </View>

              {/* Batches */}
              <View style={styles.statCard}>
                <View style={styles.statHeader}>
                  <View style={[styles.statIconBadge, { backgroundColor: '#f8fafc' }]}>
                    <Layers size={14} color={COLORS.textMuted} strokeWidth={2.2} />
                  </View>
                  <Text style={styles.statLabel} numberOfLines={2}>
                    Batches
                  </Text>
                </View>
                <Text
                  style={styles.statNumber}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {product.batch_count.toLocaleString()}
                </Text>
                <Text style={styles.statUnit}>batches</Text>
              </View>
            </View>
          )}

        {/* Batches Section (Sorted by Expiration Date) */}
        <View style={styles.batchesSection}>
          <View style={styles.batchesHeaderRow}>
            <View>
              <Text style={styles.batchesSectionTitle}>Active Batches</Text>
              <Text style={styles.fefoNote}>Sorted: Earliest Expiry First</Text>
            </View>
            {product && !product.is_archived && (
              <TouchableOpacity
                style={styles.addBatchBtn}
                onPress={() => {
                  (navigation as any).navigate('ScanTab', {
                    screen: 'AddStockForm',
                    params: {
                      productId: product.id,
                      productName: product.name,
                      barcode: product.barcode || undefined,
                    },
                  });
                }}
                disabled={saving}
                accessibilityLabel="Add Batch"
                accessibilityRole="button"
              >
                <Plus size={14} color={COLORS.white} strokeWidth={2.4} style={{ marginRight: 4 }} />
                <Text style={styles.addBatchBtnText}>Add Batch</Text>
              </TouchableOpacity>
            )}
          </View>

          {sortedBatches.length === 0 ? (
            <View style={styles.emptyBatchesCard}>
              <Text style={styles.emptyBatchesText}>No active batches for this product.</Text>
            </View>
          ) : (
            sortedBatches.map((batch) => {
              const batchCode = `B-${batch.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
              const today = getTodayInManila();
              const bStatus = getBatchStatus(batch.expiration_date, batch.quantity_left, today, near_expiry_days);
              const badgeInfo = getBatchBadge(bStatus);

              return (
                <View key={batch.id} style={styles.batchCard}>
                  {/* Top: Batch Code & Status */}
                  <View style={styles.batchCardTop}>
                    <View style={styles.batchCodePill}>
                      <Text style={styles.batchCodeText}>{batchCode}</Text>
                    </View>

                    <View
                      style={[
                        styles.batchStatusBadge,
                        { backgroundColor: badgeInfo.bg, borderColor: badgeInfo.border },
                      ]}
                    >
                      <Text style={[styles.batchStatusText, { color: badgeInfo.text }]}>
                        {badgeInfo.label}
                      </Text>
                    </View>
                  </View>

                  {/* Quantity & Countdown */}
                  <View style={styles.batchQtyRow}>
                    <View>
                      <Text style={styles.batchQtyLabel}>Quantity Left</Text>
                      <Text style={styles.batchQtyNumber}>{batch.quantity_left} units</Text>
                    </View>
                    <View style={styles.expiryCol}>
                      <Text style={styles.expiryLabel}>Expiry Date</Text>
                      <Text style={styles.expiryDateText}>
                        {formatDisplayDate(batch.expiration_date)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.purchaseDateInfo}>
                    Received: {formatDisplayDate(batch.purchase_date)}
                  </Text>

                  {/* Action Buttons */}
                  <View style={styles.batchActionRow}>
                    <TouchableOpacity
                      style={styles.actionBtnSmall}
                      onPress={() => openQtyModal(batch)}
                      disabled={saving}
                    >
                      <Text style={styles.actionBtnSmallText}>Correct Qty</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionBtnSmall}
                      onPress={() => openDatesModal(batch)}
                      disabled={saving}
                    >
                      <Text style={styles.actionBtnSmallText}>Edit Dates</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtnSmall, styles.deleteBtnSmall]}
                      onPress={() => openDeleteBatchModal(batch)}
                      disabled={saving}
                    >
                      <Text style={styles.deleteBtnSmallText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Delete Product CTA */}
        {product && !product.is_archived && (
          <TouchableOpacity
            style={styles.deleteProductBtn}
            onPress={() => setDeleteProductModalVisible(true)}
            disabled={saving}
          >
            <Text style={styles.deleteProductBtnText}>Archive / Delete Product</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Correct Quantity Modal */}
      <Modal visible={qtyModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {qtyStep === 'input' ? 'Correct Batch Quantity' : 'Confirm Quantity Correction'}
            </Text>

            {fetchingBatch ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 16 }} />
            ) : qtyStep === 'input' ? (
              <>
                <Text style={styles.modalDesc}>
                  Enter the physically counted stock units for batch{' '}
                  {activeBatch && `B-${activeBatch.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`}.
                </Text>
                <TextInput
                  style={styles.modalInput}
                  keyboardType="numeric"
                  value={newQtyInput}
                  onChangeText={setNewQtyInput}
                  placeholder="0"
                />
                {qtyModalError && <Text style={styles.modalError}>{qtyModalError}</Text>}

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setQtyModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={handleQtySubmit}
                  >
                    <Text style={styles.modalPrimaryText}>Review</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  Change batch units from {activeBatch?.quantity_left} to{' '}
                  <Text style={{ fontWeight: 'bold' }}>{newQtyInput.trim()}</Text>?
                </Text>
                {qtyModalError && <Text style={styles.modalError}>{qtyModalError}</Text>}

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setQtyStep('input')}
                  >
                    <Text style={styles.modalCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={confirmQtyCorrection}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.modalPrimaryText}>Confirm</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Edit Dates Modal */}
      <Modal visible={datesModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {datesStep === 'input' ? 'Edit Batch Dates' : 'Confirm Date Change'}
            </Text>

            {datesStep === 'input' ? (
              <>
                <DateField
                  label="Purchase Date"
                  value={purchaseDateInput}
                  onChange={setPurchaseDateInput}
                  placeholder="YYYY-MM-DD"
                />

                <DateField
                  label="Expiration Date"
                  value={expirationDateInput}
                  onChange={setExpirationDateInput}
                  placeholder="YYYY-MM-DD"
                  warning={
                    isValidCalendarDate(expirationDateInput) && isDateInPast(expirationDateInput)
                      ? 'Warning: Expiration date is in the past'
                      : null
                  }
                />
                {datesModalError && <Text style={styles.modalError}>{datesModalError}</Text>}

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setDatesModalVisible(false)}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={handleDatesSubmit}
                  >
                    <Text style={styles.modalPrimaryText}>Review</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  Expiry Date determines batch deduction sequence. Update expiry to{' '}
                  <Text style={{ fontWeight: 'bold' }}>{expirationDateInput.trim()}</Text>?
                </Text>
                {datesModalError && <Text style={styles.modalError}>{datesModalError}</Text>}

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity
                    style={styles.modalCancelBtn}
                    onPress={() => setDatesStep('input')}
                  >
                    <Text style={styles.modalCancelText}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalPrimaryBtn}
                    onPress={confirmDatesUpdate}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color={COLORS.white} size="small" />
                    ) : (
                      <Text style={styles.modalPrimaryText}>Save Dates</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Delete Batch Confirmation Modal */}
      <Modal visible={deleteBatchModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Batch?</Text>
            <Text style={styles.modalDesc}>
              This will remove batch{' '}
              {activeBatch && `B-${activeBatch.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`}{' '}
              ({activeBatch?.quantity_left} units) from inventory.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteBatchModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: COLORS.danger }]}
                onPress={confirmDeleteBatch}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Product Confirmation Modal */}
      <Modal visible={deleteProductModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete Product?</Text>
            <Text style={styles.modalDesc}>
              If "{product?.name}" has recorded movement, it will be safely archived to preserve inventory history.
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteProductModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, { backgroundColor: COLORS.danger }]}
                onPress={confirmDeleteProduct}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} size="small" />
                ) : (
                  <Text style={styles.modalPrimaryText}>Archive / Delete</Text>
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
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  notFoundSub: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  backButtonText: {
    color: COLORS.white,
    fontWeight: '700',
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
    color: COLORS.dangerDark,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
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
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 36,
  },
  productHeadingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  editProdBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    flexShrink: 0,
    alignSelf: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  editProdText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  addBatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minHeight: 36,
  },
  addBatchBtnText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  toastSuccess: {
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  toastSuccessText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  toastError: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 14,
  },
  toastErrorText: {
    color: COLORS.dangerDark,
    fontSize: 12,
    fontWeight: '600',
  },
  prodHeaderSection: {
    marginBottom: 12,
  },
  productTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  barcodeLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
    fontFamily: FONTS.medium,
    marginBottom: 10,
  },
  metaPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.bgTint,
    borderWidth: 1,
    borderColor: '#d6f0b4',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  metaPillText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  metaPillPriceText: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  statusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusPillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 6,
  },
  statIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    fontSize: 12,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  statNumber: {
    fontSize: 19,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.text,
    textAlign: 'center',
    lineHeight: 23,
  },
  statUnit: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  batchesSection: {
    marginBottom: 24,
  },
  batchesHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchesSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  fefoNote: {
    fontSize: 10,
    color: COLORS.primary,
    fontWeight: '700',
  },
  emptyBatchesCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyBatchesText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  batchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  batchCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  batchCodePill: {
    backgroundColor: COLORS.bgWarm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  batchCodeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.text,
  },
  batchStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  batchStatusText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  batchQtyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  batchQtyLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  batchQtyNumber: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.text,
    marginTop: 2,
  },
  expiryCol: {
    alignItems: 'flex-end',
  },
  expiryLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
  },
  expiryDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 2,
  },
  purchaseDateInfo: {
    fontSize: 11,
    color: COLORS.textSubtle,
    marginBottom: 12,
  },
  batchActionRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
  },
  actionBtnSmall: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.bgWarm,
    alignItems: 'center',
  },
  actionBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
  },
  deleteBtnSmall: {
    backgroundColor: COLORS.dangerLight,
    borderColor: COLORS.dangerBorder,
  },
  deleteBtnSmallText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.dangerDark,
  },
  deleteProductBtn: {
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.white,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  deleteProductBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.danger,
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
    padding: 22,
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
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  modalInput: {
    backgroundColor: COLORS.bgWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 12,
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
    marginTop: 8,
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
  modalPrimaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalPrimaryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
});
