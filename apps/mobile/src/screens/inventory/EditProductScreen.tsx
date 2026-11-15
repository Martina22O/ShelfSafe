/**
 * Screen: EditProductScreen
 * Edit an existing product with validation, confirmation, and error handling.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  BackHandler,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, AlertCircle } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InventoryStackParamList } from '../../navigation/types';
import {
  getProductWithBatches,
  getCategories,
  updateProduct,
} from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { Category, ProductWithBatches } from '../../types/inventory';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<InventoryStackParamList, 'EditProduct'>;

export default function EditProductScreen({ route, navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { near_expiry_days } = useStoreSettings();
  const productId = route.params?.productId;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [initialProduct, setInitialProduct] = useState<ProductWithBatches | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [price, setPrice] = useState('0.00');
  const [lowStockLevel, setLowStockLevel] = useState('5');

  // Submission & Confirmation state
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Prevent back navigation while saving
  useEffect(() => {
    const backAction = () => {
      if (saving) return true; // Consume event and block back
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

  // Load product and categories on mount
  const loadData = async () => {
    if (!productId) {
      setLoadError('No product specified');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    const [prodRes, catRes] = await Promise.all([
      getProductWithBatches(productId, near_expiry_days),
      getCategories(),
    ]);

    if (prodRes.kind === 'error') {
      setLoadError(prodRes.message);
      setLoading(false);
      return;
    }

    if (prodRes.kind === 'not_found' || prodRes.data.is_archived) {
      setLoadError('This product no longer exists');
      setLoading(false);
      return;
    }

    const prod = prodRes.data;
    setInitialProduct(prod);
    setName(prod.name);
    setBarcode(prod.barcode || '');
    setSelectedCategoryId(prod.category_id || (catRes.kind === 'success' && catRes.categories[0]?.id) || null);
    setPrice(prod.price.toFixed(2));
    setLowStockLevel(prod.low_stock_level.toString());

    if (catRes.kind === 'success') {
      setCategories(catRes.categories);
    }
    setLoadingCategories(false);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [productId]);

  // Check if anything changed
  const trimmedName = name.trim();
  const trimmedBarcode = barcode.trim() || null;
  const initialBarcode = initialProduct?.barcode || null;
  const priceNum = parseFloat(price);
  const lowStockNum = Number(lowStockLevel);

  const isBarcodeChanged = Boolean(
    initialProduct && trimmedBarcode !== initialBarcode
  );

  const isUnchanged = Boolean(
    initialProduct &&
      trimmedName === initialProduct.name &&
      trimmedBarcode === initialBarcode &&
      selectedCategoryId === initialProduct.category_id &&
      !isNaN(priceNum) &&
      priceNum === initialProduct.price &&
      !isNaN(lowStockNum) &&
      lowStockNum === initialProduct.low_stock_level
  );

  const handleOpenConfirm = () => {
    setErrorMessage(null);

    // Validate like NewProduct
    if (!trimmedName) {
      setErrorMessage('Product name cannot be empty');
      return;
    }

    if (!selectedCategoryId) {
      setErrorMessage('Please select a category');
      return;
    }

    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage('Price must be a valid number greater than or equal to 0.00');
      return;
    }

    if (!Number.isInteger(lowStockNum) || lowStockNum < 0) {
      setErrorMessage('Low-stock level must be a whole number greater than or equal to 0');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await updateProduct({
      productId: productId!,
      name: trimmedName,
      barcode: trimmedBarcode,
      categoryId: selectedCategoryId!,
      price: priceNum,
      lowStockLevel: lowStockNum,
    });

    setSaving(false);

    if (res.kind === 'db_error') {
      setErrorMessage(res.message);
      return;
    }

    if (res.kind === 'network_timeout') {
      setErrorMessage(res.message);
      return;
    }

    // Success
    setSuccessMessage('Product updated successfully!');
    setTimeout(() => {
      navigation.goBack();
    }, 800);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <Text style={styles.errorTitle}>{loadError}</Text>
        <TouchableOpacity
          style={styles.backBtnAction}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
        >
          <ArrowLeft size={16} color={COLORS.primary} strokeWidth={2} />
          <Text style={styles.backBtnActionText}>Back to Inventory</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Background Decorative Wave */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        {/* Notifications */}
        {successMessage ? (
          <View style={styles.successBox}>
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.label}>Product Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errorMessage) setErrorMessage(null);
            }}
            editable={!saving}
          />

          <Text style={styles.label}>Barcode / SKU</Text>
          <TextInput
            style={styles.input}
            placeholder="No barcode"
            placeholderTextColor={COLORS.textMuted}
            value={barcode}
            onChangeText={(text) => {
              setBarcode(text);
              if (errorMessage) setErrorMessage(null);
            }}
            keyboardType="numeric"
            editable={!saving}
          />

          {isBarcodeChanged ? (
            <View style={styles.warningBox}>
              <AlertCircle size={16} color={COLORS.amberDark} strokeWidth={2} />
              <Text style={styles.warningText}>
                Warning: Changing the barcode will change which camera scans find this product.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Category</Text>
          {loadingCategories ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 8 }} />
          ) : (
            <View style={styles.categoryChipsRow}>
              {categories.map((cat) => {
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => {
                      if (!saving) setSelectedCategoryId(cat.id);
                    }}
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        isSelected && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.formRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Price (₱)</Text>
              <TextInput
                style={styles.input}
                value={price}
                onChangeText={(text) => {
                  setPrice(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>

            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Low Stock Level</Text>
              <TextInput
                style={styles.input}
                value={lowStockLevel}
                onChangeText={(text) => {
                  setLowStockLevel(text);
                  if (errorMessage) setErrorMessage(null);
                }}
                keyboardType="numeric"
                editable={!saving}
              />
            </View>
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.saveBtn, (saving || isUnchanged) && styles.btnDisabled]}
            onPress={handleOpenConfirm}
            disabled={saving || isUnchanged}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save Product Changes</Text>
            )}
          </TouchableOpacity>

          {isUnchanged && !saving ? (
            <Text style={styles.unchangedHint}>No changes made yet</Text>
          ) : null}
        </View>

        {/* Confirmation Modal */}
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => {
            if (!saving) setShowConfirmModal(false);
          }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>Save these changes?</Text>
              <Text style={styles.modalSub}>
                Are you sure you want to update the details for "{trimmedName}"?
              </Text>

              <View style={styles.previewBox}>
                <Text style={styles.previewRow}>• Name: {trimmedName}</Text>
                <Text style={styles.previewRow}>• Barcode: {trimmedBarcode || 'None'}</Text>
                <Text style={styles.previewRow}>• Price: ₱{priceNum.toFixed(2)}</Text>
                <Text style={styles.previewRow}>• Low-stock level: {lowStockNum} units</Text>
              </View>

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowConfirmModal(false)}
                  disabled={saving}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirmBtn}
                  onPress={handleConfirmSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Text style={styles.modalConfirmText}>Yes, Save</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.danger,
    textAlign: 'center',
  },
  backBtnAction: {
    marginTop: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnActionText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
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
  topNav: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  successBox: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.primaryDark,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.danger,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  warningBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    backgroundColor: COLORS.amberLight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.amberDark,
  },
  categoryChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  categoryChip: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  categoryChipActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primaryDark,
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  categoryChipTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  formRow: {
    flexDirection: 'row',
  },
  actionSection: {
    marginTop: 8,
    marginBottom: 40,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  unchangedHint: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
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
    marginTop: 6,
    lineHeight: 18,
  },
  previewBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  previewRow: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  modalBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
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
