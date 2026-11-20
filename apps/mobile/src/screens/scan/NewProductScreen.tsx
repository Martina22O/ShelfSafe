/**
 * Screen: NewProductScreen
 * Create a new product and its initial batch atomically with real database data.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import DateField from '../../components/DateField';
import { getCategories, createProductWithBatch } from '../../services/inventory';
import { uploadProductPhoto, deleteProductPhoto, generateUUID } from '../../services/storage';
import ProductPhotoPicker from '../../components/ProductPhotoPicker';
import { Category } from '../../types/inventory';
import {
  getTodayInManila,
  isValidCalendarDate,
  isDateInPast,
} from '../../utils/date';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';
import KeyboardAwareScreen from '../../components/KeyboardAwareScreen';

type Props = NativeStackScreenProps<ScanStackParamList, 'NewProduct'>;

export default function NewProductScreen({ route, navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const initialBarcode = route.params?.barcode || '';
  const fromScan = Boolean(route.params?.fromScan && initialBarcode);
  const today = getTodayInManila();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form fields
  const [name, setName] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [barcode, setBarcode] = useState(initialBarcode);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [price, setPrice] = useState('0.00');
  const [lowStockLevel, setLowStockLevel] = useState('5');

  // First batch fields
  const [quantity, setQuantity] = useState('10');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expirationDate, setExpirationDate] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load real categories from database
  useEffect(() => {
    let isMounted = true;
    async function fetchCats() {
      setLoadingCategories(true);
      const res = await getCategories();
      if (isMounted) {
        if (res.kind === 'success') {
          setCategories(res.categories);
          if (res.categories.length > 0) {
            setSelectedCategoryId(res.categories[0].id);
          }
        }
        setLoadingCategories(false);
      }
    }
    fetchCats();
    return () => {
      isMounted = false;
    };
  }, []);

  const isPastExpiry = isValidCalendarDate(expirationDate) && isDateInPast(expirationDate);

  const handleSave = async () => {
    setErrorMessage(null);

    // Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Product name is required');
      return;
    }

    // Validate category
    if (!selectedCategoryId) {
      setErrorMessage('Please select a category');
      return;
    }

    // Validate price
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage('Price must be a valid non-negative number');
      return;
    }

    // Validate low stock level
    const lowStockNum = parseInt(lowStockLevel, 10);
    if (isNaN(lowStockNum) || lowStockNum < 0) {
      setErrorMessage('Low stock alert level must be a non-negative whole number');
      return;
    }

    // Validate quantity
    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum < 1) {
      setErrorMessage('Quantity must be a whole number of at least 1');
      return;
    }

    // Validate purchase date
    const pDate = purchaseDate.trim() || today;
    if (!isValidCalendarDate(pDate)) {
      setErrorMessage('Purchase date must be in valid YYYY-MM-DD format');
      return;
    }

    // Validate expiration date
    const expDate = expirationDate.trim();
    if (!expDate) {
      setErrorMessage('Expiration date is required for the first batch');
      return;
    }

    if (!isValidCalendarDate(expDate)) {
      setErrorMessage('Expiration date must be in valid YYYY-MM-DD format (e.g. 2026-12-31)');
      return;
    }

    if (expDate < pDate) {
      setErrorMessage('Expiration date cannot be earlier than purchase date');
      return;
    }

    setSaving(true);

    let uploadedStoragePath: string | null = null;
    const prospectiveId = generateUUID();

    if (photoUri) {
      const uploadRes = await uploadProductPhoto(photoUri, prospectiveId);
      if ('error' in uploadRes) {
        setErrorMessage(`Photo upload failed: ${uploadRes.error}. Please try again or remove the photo.`);
        setSaving(false);
        return;
      }
      uploadedStoragePath = uploadRes.storagePath;
    }

    const result = await createProductWithBatch({
      p_name: trimmedName,
      p_barcode: barcode.trim() || null,
      p_category_id: selectedCategoryId,
      p_price: priceNum,
      p_low_stock_level: lowStockNum,
      p_quantity: qtyNum,
      p_purchase_date: pDate,
      p_expiration_date: expDate,
      p_image_url: uploadedStoragePath,
    });

    if (result.kind === 'error') {
      // If product creation failed, clean up uploaded storage file
      if (uploadedStoragePath) {
        await deleteProductPhoto(uploadedStoragePath);
      }
      setSaving(false);
      setErrorMessage(result.message);
      return;
    }

    setSaving(false);

    // Success -> Navigate to AddStockDone
    navigation.navigate('AddStockDone', {
      units: qtyNum,
      batchCode: 'First Batch',
      expiryDate: expDate,
      productId: result.productId,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
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

        <Text style={[styles.screenSub, { marginTop: 4 }]}>
          Create product record and its initial delivery batch
        </Text>

        {/* Error Alert */}
        {errorMessage ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Product Details Section Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionHeader}>Product Details</Text>

          <Text style={styles.label}>Product Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Fresh Milk 1L"
            placeholderTextColor={COLORS.textMuted}
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (errorMessage) setErrorMessage(null);
            }}
            editable={!saving}
          />

          <ProductPhotoPicker
            photoUri={photoUri}
            onPhotoSelected={setPhotoUri}
            categoryName={categories.find((c) => c.id === selectedCategoryId)?.name}
            disabled={saving}
          />

          <Text style={styles.label}>Barcode (Optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="Scan or type barcode number"
            placeholderTextColor={COLORS.textMuted}
            value={barcode}
            onChangeText={(text) => {
              setBarcode(text);
              if (errorMessage) setErrorMessage(null);
            }}
            keyboardType="numeric"
            editable={!saving}
          />
          {fromScan ? (
            <Text style={styles.hintText}>
              Scanned barcode automatically populated.
            </Text>
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
                    style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                    onPress={() => setSelectedCategoryId(cat.id)}
                    disabled={saving}
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
                placeholder="0.00"
                placeholderTextColor={COLORS.textMuted}
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
                placeholder="5"
                placeholderTextColor={COLORS.textMuted}
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

        {/* First Batch Section Card */}
        <View style={styles.card}>
          <Text style={styles.cardSectionHeader}>First Batch Details</Text>

          <Text style={styles.label}>Quantity Received</Text>
          <TextInput
            style={styles.input}
            placeholder="10"
            placeholderTextColor={COLORS.textMuted}
            value={quantity}
            onChangeText={(text) => {
              setQuantity(text);
              if (errorMessage) setErrorMessage(null);
            }}
            keyboardType="numeric"
            editable={!saving}
          />

          {/* Purchase Date */}
          <DateField
            label="Purchase Date"
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
                Warning: The expiration date is already in the past!
              </Text>
            </View>
          ) : null}
        </View>

        {/* Action Button */}
        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.saveBtnText}>Save Product & Batch</Text>
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
  cardSectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
    marginBottom: 12,
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
  hintText: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
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
  pastExpiryBox: {
    marginTop: 8,
    backgroundColor: COLORS.dangerLight,
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pastExpiryText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.dangerDark,
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
    opacity: 0.6,
  },
});
