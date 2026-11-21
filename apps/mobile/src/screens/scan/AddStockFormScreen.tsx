/**
 * Screen: AddStockFormScreen
 * Add stock batch to an existing product with validation and summary.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Image,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import DateField from '../../components/DateField';
import {
  getProductWithBatches,
  findProductByBarcode,
  addStock,
} from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { ProductWithBatches } from '../../types/inventory';
import {
  getTodayInManila,
  isValidCalendarDate,
  isDateInPast,
} from '../../utils/date';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';

type Props = NativeStackScreenProps<ScanStackParamList, 'AddStockForm'>;

export default function AddStockFormScreen({ route, navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { near_expiry_days } = useStoreSettings();
  const paramProductId = route.params?.productId;
  const paramBarcode = route.params?.barcode;
  const paramProductName = route.params?.productName;

  const today = getTodayInManila();

  const [loadingProduct, setLoadingProduct] = useState(true);
  const [productData, setProductData] = useState<ProductWithBatches | null>(null);

  const [quantity, setQuantity] = useState('10');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expirationDate, setExpirationDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      setLoadingProduct(true);
      setErrorMessage(null);

      let targetId = paramProductId;

      if (!targetId && paramBarcode) {
        const findRes = await findProductByBarcode(paramBarcode);
        if (findRes.kind === 'found') {
          targetId = findRes.product.id;
        } else if (findRes.kind === 'archived') {
          if (isMounted) {
            setErrorMessage('This product is archived');
            setLoadingProduct(false);
          }
          return;
        } else if (findRes.kind === 'error') {
          if (isMounted) {
            setErrorMessage(findRes.message);
            setLoadingProduct(false);
          }
          return;
        }
      }

      if (!targetId) {
        if (isMounted) {
          setErrorMessage('Product not found or not specified');
          setLoadingProduct(false);
        }
        return;
      }

      const res = await getProductWithBatches(targetId, near_expiry_days);
      if (!isMounted) return;

      if (res.kind === 'success') {
        setProductData(res.data);
      } else if (res.kind === 'error') {
        setErrorMessage(res.message);
      } else {
        setErrorMessage('Product not found');
      }
      setLoadingProduct(false);
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [paramProductId, paramBarcode]);

  // Expiration in the past warning
  const isPastExpiry = isValidCalendarDate(expirationDate) && isDateInPast(expirationDate);

  const handleSaveBatch = async () => {
    Keyboard.dismiss();
    if (!productData) {
      setErrorMessage('Product data not loaded');
      return;
    }

    setErrorMessage(null);

    // Validate quantity: whole number >= 1
    const qtyNum = Number(quantity);
    if (!Number.isInteger(qtyNum) || qtyNum < 1) {
      setErrorMessage('Quantity must be a whole number of at least 1');
      return;
    }

    // Validate purchase date: real calendar date
    const pDate = purchaseDate.trim() || today;
    if (!isValidCalendarDate(pDate)) {
      setErrorMessage('Purchase date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }

    // Validate expiration date: real calendar date
    const expDate = expirationDate.trim();
    if (!expDate) {
      setErrorMessage('Expiration date is required');
      return;
    }

    if (!isValidCalendarDate(expDate)) {
      setErrorMessage('Expiration date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-12-31)');
      return;
    }

    // Expiration date cannot be before purchase date
    if (expDate < pDate) {
      setErrorMessage('Expiration date cannot be earlier than purchase date');
      return;
    }

    // Call add_stock with double-tap prevention
    setSaving(true);
    const result = await addStock({
      p_product_id: productData.id,
      p_quantity: qtyNum,
      p_purchase_date: pDate,
      p_expiration_date: expDate,
    });
    setSaving(false);

    if (result.kind === 'error') {
      setErrorMessage(result.message);
      return;
    }

    // Success -> Navigate to AddStockDone
    navigation.navigate('AddStockDone', {
      units: qtyNum,
      batchCode: 'New Delivery Batch',
      expiryDate: expDate,
      productId: productData.id,
    });
  };

  if (loadingProduct) {
    return (
      <SafeAreaView style={[styles.centerContainer, { backgroundColor: COLORS.scanActionBg }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading product details...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.scanActionBg }]} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <KeyboardAwareScreen
        contentContainerStyle={styles.scrollContent}
        bottomOffset={28}
      >
        {/* Background Decorative Wave */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        {/* Product Summary Card */}
        {productData ? (
          <View style={styles.productCard}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>
                {productData.category?.name || 'General Product'}
              </Text>
            </View>
            <Text style={styles.productName}>{productData.name}</Text>
            <View style={styles.prodMetaRow}>
              <Text style={styles.metaLabel}>Barcode: {productData.barcode || 'None'}</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaLabel}>Current Units: {productData.total_units}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.productCard}>
            <Text style={styles.productName}>{paramProductName || 'Product'}</Text>
            <Text style={styles.metaLabel}>Barcode: {paramBarcode || 'No barcode'}</Text>
          </View>
        )}

        {/* Error Alert Banner */}
        {errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Batch Form Card */}
        <View style={styles.formCard}>
          {/* Quantity */}
          <Text style={[styles.label, { marginTop: 0 }]}>Quantity Received</Text>
          <TextInput
            style={[styles.input, { marginBottom: 14 }]}
            placeholder="Enter quantity (at least 1)"
            placeholderTextColor={COLORS.textMuted}
            value={quantity}
            onChangeText={(text) => {
              setQuantity(text);
              if (errorMessage) setErrorMessage(null);
            }}
            keyboardType="numeric"
            returnKeyType="done"
            onSubmitEditing={Keyboard.dismiss}
            editable={!saving}
          />

          {/* Purchase Date */}
          <DateField
            label="Purchase / Delivery Date"
            value={purchaseDate}
            onChange={(val) => {
              setPurchaseDate(val);
              if (errorMessage) setErrorMessage(null);
            }}
            editable={!saving}
          />

          {/* Expiration Date */}
          <DateField
            label="Expiration Date"
            value={expirationDate}
            onChange={(val) => {
              setExpirationDate(val);
              if (errorMessage) setErrorMessage(null);
            }}
            editable={!saving}
          />

          {isPastExpiry ? (
            <View style={styles.pastExpiryBox}>
              <AlertCircle size={16} color={COLORS.amberDark} strokeWidth={2} />
              <Text style={styles.pastExpiryText}>
                Warning: This expiration date is already in the past!
              </Text>
            </View>
          ) : null}

          <Text style={styles.formNote}>
            Note: This creates a separate dated batch. When sales are recorded, units will automatically be deducted from the batch that expires first.
          </Text>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.saveBtn, (saving || !productData) && styles.btnDisabled]}
            onPress={handleSaveBatch}
            disabled={saving || !productData}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save Batch Stock</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAwareScreen>
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
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
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
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  productName: {
    fontSize: 17,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  prodMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  metaLabel: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  metaDot: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginHorizontal: 8,
  },
  errorBanner: {
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
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
    marginTop: 10,
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
  },
  pastExpiryBox: {
    marginTop: 8,
    backgroundColor: COLORS.dangerLight,
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pastExpiryText: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.dangerDark,
    flex: 1,
  },
  formNote: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    marginTop: 16,
    lineHeight: 18,
  },
  saveBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  btnDisabled: {
    opacity: 0.6,
  },
});
