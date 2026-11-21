/**
 * Screen: TypeBarcodeScreen
 * Manual barcode entry, product search by name, and barcode-less item navigation.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  BackHandler,
  StyleSheet,
  Image,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Plus } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import {
  findProductByBarcode,
  searchProductsByName,
  getProductWithBatches,
  restoreProduct,
} from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { Product } from '../../types/inventory';
import { useSaleCart } from '../../context/SaleCartContext';
import { isValidRetailBarcode } from '../../utils/barcode';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';

type Props = NativeStackScreenProps<ScanStackParamList, 'TypeBarcode'>;

export default function TypeBarcodeScreen({ route, navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { near_expiry_days } = useStoreSettings();
  const mode = route.params?.mode || 'add';
  const { addItem } = useSaleCart();

  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Archived product restore state
  const [archivedProduct, setArchivedProduct] = useState<Product | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccessMessage, setRestoreSuccessMessage] = useState<string | null>(null);

  // Prevent back navigation while restoring
  useEffect(() => {
    const backAction = () => {
      if (restoring) return true;
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [restoring]);

  // Search by name state (open by default in sell mode to easily sell barcode-less items)
  const [showNameSearch, setShowNameSearch] = useState(mode === 'sell');
  const [nameQuery, setNameQuery] = useState('');
  const [searchingName, setSearchingName] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectingProductId, setSelectingProductId] = useState<string | null>(null);

  const handleFind = async () => {
    Keyboard.dismiss();
    const trimmed = barcode.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a barcode number');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const result = await findProductByBarcode(trimmed);

    if (result.kind === 'error') {
      setLoading(false);
      setErrorMessage(result.message);
      return;
    }

    if (result.kind === 'archived') {
      setLoading(false);
      setErrorMessage('This product is archived in your store.');
      setArchivedProduct(result.product);
      return;
    }

    if (mode === 'sell') {
      if (result.kind === 'not_found') {
        setLoading(false);
        setErrorMessage('This product is not in your inventory');
        return;
      }

      if (result.kind === 'found') {
        const batchRes = await getProductWithBatches(result.product.id, near_expiry_days);
        setLoading(false);

        if (batchRes.kind === 'error') {
          setErrorMessage(batchRes.message);
          return;
        }

        const sellableUnits = batchRes.kind === 'success' ? batchRes.data.sellable_units : 0;

        if (sellableUnits <= 0) {
          setErrorMessage('No sellable units for this product (expired or out of stock)');
          return;
        }

        const addRes = addItem({
          id: result.product.id,
          name: result.product.name,
          barcode: result.product.barcode || trimmed,
          price: result.product.price,
          sellable_units: sellableUnits,
        });

        if (!addRes.success) {
          setErrorMessage(addRes.message);
          return;
        }

        navigation.navigate('SaleList');
        return;
      }
    }

    // Add mode
    setLoading(false);
    if (result.kind === 'found') {
      navigation.navigate('AddStockForm', {
        productId: result.product.id,
        barcode: result.product.barcode || trimmed,
        productName: result.product.name,
      });
      return;
    }

    if (result.kind === 'not_found') {
      navigation.navigate('NewProduct', { barcode: trimmed });
      return;
    }
  };

  const handleSearchByName = async () => {
    Keyboard.dismiss();
    const query = nameQuery.trim();
    if (!query) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setSearchingName(true);
    setErrorMessage(null);
    setHasSearched(true);

    const res = await searchProductsByName(query);
    setSearchingName(false);

    if (res.kind === 'error') {
      setErrorMessage(res.message);
      return;
    }

    setSearchResults(res.products);
  };

  const handleSelectProduct = async (product: Product) => {
    if (mode === 'sell') {
      setSelectingProductId(product.id);
      setErrorMessage(null);
      const batchRes = await getProductWithBatches(product.id, near_expiry_days);
      setSelectingProductId(null);

      if (batchRes.kind === 'error') {
        setErrorMessage(batchRes.message);
        return;
      }

      const sellableUnits = batchRes.kind === 'success' ? batchRes.data.sellable_units : 0;

      if (sellableUnits <= 0) {
        setErrorMessage('No sellable units for this product (expired or out of stock)');
        return;
      }

      const addRes = addItem({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
        price: product.price,
        sellable_units: sellableUnits,
      });

      if (!addRes.success) {
        setErrorMessage(addRes.message);
        return;
      }

      navigation.navigate('SaleList');
      return;
    }

    // Add mode
    navigation.navigate('AddStockForm', {
      productId: product.id,
      barcode: product.barcode || '',
      productName: product.name,
    });
  };

  const isScanAction = mode === 'add' || mode === 'sell';

  return (
    <SafeAreaView
      style={[styles.container, isScanAction && { backgroundColor: COLORS.scanActionBg }]}
      edges={['left', 'right']}
    >
      <StatusBar style="dark" />
      <KeyboardAwareScreen
        contentContainerStyle={styles.scrollContent}
        bottomOffset={28}
      >
        {/* Decorative Wave Background */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        {/* Mode Badge Indicator (Native navigation bar provides single Back button) */}
        <View style={styles.header}>
          <View style={styles.modeBadge}>
            <Text style={styles.modeBadgeText}>
              {mode === 'add' ? 'Stock In Mode' : 'Record Sale Mode'}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>Manual Barcode Entry</Text>
        <Text style={styles.subtitle}>
          Enter retail numbers directly or search by item name
        </Text>

        {/* Notifications */}
        {restoreSuccessMessage ? (
          <View style={styles.successToast}>
            <Text style={styles.successToastText}>{restoreSuccessMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorToast}>
            <Text style={styles.errorToastText}>{errorMessage}</Text>
            {archivedProduct && (
              <TouchableOpacity
                style={styles.restorePromptBtn}
                onPress={() => setShowRestoreModal(true)}
              >
                <Text style={styles.restorePromptText}>Restore "{archivedProduct.name}"</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {/* Barcode Input Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Barcode Number</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. 4801981118502"
            placeholderTextColor={COLORS.textMuted}
            value={barcode}
            onChangeText={(text) => {
              setBarcode(text);
              if (errorMessage) setErrorMessage(null);
            }}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={handleFind}
            editable={!loading}
          />

          {barcode.trim().length > 0 && !isValidRetailBarcode(barcode.trim()) ? (
            <Text style={styles.warningNote}>
              Note: This barcode is non-standard, but will still be accepted.
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={handleFind}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {mode === 'add' ? 'Find Product to Stock' : 'Find Product to Sell'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search by Name Toggle Card */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => setShowNameSearch(!showNameSearch)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.cardSectionTitle}>Search by Product Name</Text>
              <Text style={styles.cardSectionSub}>
                Ideal for items without barcodes or worn-out labels
              </Text>
            </View>
            <Text style={styles.toggleArrow}>{showNameSearch ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {showNameSearch && (
            <View style={styles.searchSection}>
              <View style={styles.searchRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Type product name..."
                  placeholderTextColor={COLORS.textMuted}
                  value={nameQuery}
                  onChangeText={setNameQuery}
                  returnKeyType="search"
                  onSubmitEditing={handleSearchByName}
                />
                <TouchableOpacity
                  style={[styles.searchBtn, searchingName && styles.btnDisabled]}
                  onPress={handleSearchByName}
                  disabled={searchingName}
                >
                  {searchingName ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.searchBtnText}>Search</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Search Results */}
              {hasSearched && searchResults.length === 0 && !searchingName && (
                <Text style={styles.emptySearchText}>
                  No active products found matching "{nameQuery}"
                </Text>
              )}

              {searchResults.map((item) => {
                const isCurrentSelecting = selectingProductId === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    onPress={() => handleSelectProduct(item)}
                    disabled={isCurrentSelecting}
                    style={styles.resultItem}
                  >
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.resultName}>{item.name}</Text>
                      <Text style={styles.resultMeta}>
                        Barcode: {item.barcode || 'None'} • ₱{item.price.toFixed(2)}
                      </Text>
                    </View>
                    {isCurrentSelecting ? (
                      <ActivityIndicator size="small" color={COLORS.primary} />
                    ) : (
                      <View style={styles.selectActionRow}>
                        <Text style={styles.selectActionText}>
                          {mode === 'sell' ? 'Add to cart' : 'Select'}
                        </Text>
                        <ArrowRight size={14} color={COLORS.primary} strokeWidth={2} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Add Product without Barcode CTA (Stock-In Mode) */}
        {mode === 'add' && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate('NewProduct', { barcode: '' })}
            accessibilityRole="button"
          >
            <View style={styles.addNoBarcodeRow}>
              <Plus size={16} color={COLORS.primary} strokeWidth={2} />
              <Text style={styles.secondaryBtnText}>Add a product with no barcode</Text>
            </View>
          </TouchableOpacity>
        )}
      </KeyboardAwareScreen>

      {/* Restore Confirmation Modal */}
      <Modal
        visible={showRestoreModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!restoring) setShowRestoreModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Restore Product?</Text>
            <Text style={styles.modalSub}>
              Restore "{archivedProduct?.name}" back to your active store inventory?
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRestoreModal(false)}
                disabled={restoring}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={async () => {
                  if (!archivedProduct) return;
                  setRestoring(true);
                  const res = await restoreProduct(archivedProduct.id);
                  setRestoring(false);
                  setShowRestoreModal(false);

                  if (res.kind !== 'success') {
                    setErrorMessage(res.message);
                    return;
                  }

                  setRestoreSuccessMessage(
                    `"${archivedProduct.name}" restored! You can now add stock or record sales.`
                  );
                  setErrorMessage(null);
                  setArchivedProduct(null);
                }}
                disabled={restoring}
              >
                {restoring ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Text style={styles.modalConfirmText}>Yes, Restore</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 40,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  modeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primaryDark,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
  },
  successToast: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successToastText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.primaryDark,
  },
  errorToast: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorToastText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.danger,
  },
  restorePromptBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  restorePromptText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    minHeight: 48,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginBottom: 8,
  },
  warningNote: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.orangeDark,
    marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  cardSectionSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  toggleArrow: {
    fontSize: 14,
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  searchSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 14,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  searchBtn: {
    backgroundColor: COLORS.deepGreen,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  emptySearchText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 10,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  resultMeta: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  selectActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectActionText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  secondaryBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addNoBarcodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
  },
  modalSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 8,
    lineHeight: 18,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  modalConfirmBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  modalConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
});
