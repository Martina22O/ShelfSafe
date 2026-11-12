/**
 * Screen: NewProductScreen
 * Create a new product and its initial batch atomically with real database data.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { getCategories, createProductWithBatch } from '../../services/inventory';
import { Category } from '../../types/inventory';
import {
  getTodayInManila,
  isValidCalendarDate,
  isDateInPast,
} from '../../utils/date';

type Props = NativeStackScreenProps<ScanStackParamList, 'NewProduct'>;

export default function NewProductScreen({ route, navigation }: Props) {
  const initialBarcode = route.params?.barcode || '';
  const fromScan = Boolean(route.params?.fromScan && initialBarcode);
  const today = getTodayInManila();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form fields
  const [name, setName] = useState('');
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
    async function load() {
      setLoadingCategories(true);
      const res = await getCategories();
      setLoadingCategories(false);

      if (res.kind === 'success' && res.categories.length > 0) {
        setCategories(res.categories);
        setSelectedCategoryId(res.categories[0].id);
      } else if (res.kind === 'error') {
        setErrorMessage(res.message);
      }
    }
    load();
  }, []);

  const isPastExpiry = isValidCalendarDate(expirationDate) && isDateInPast(expirationDate);

  const handleSave = async () => {
    setErrorMessage(null);

    // 1. Validate name
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Product name cannot be empty');
      return;
    }

    // 2. Validate category
    if (!selectedCategoryId) {
      setErrorMessage('Please select a category');
      return;
    }

    // 3. Validate price: number >= 0
    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setErrorMessage('Price must be a valid number greater than or equal to 0.00');
      return;
    }

    // 4. Validate low-stock level: whole number >= 0
    const lowStockNum = Number(lowStockLevel);
    if (!Number.isInteger(lowStockNum) || lowStockNum < 0) {
      setErrorMessage('Low-stock level must be a whole number greater than or equal to 0');
      return;
    }

    // 5. Validate first batch quantity: whole number >= 1
    const qtyNum = Number(quantity);
    if (!Number.isInteger(qtyNum) || qtyNum < 1) {
      setErrorMessage('Quantity must be a whole number of at least 1');
      return;
    }

    // 6. Validate purchase date: real calendar date
    const pDate = purchaseDate.trim() || today;
    if (!isValidCalendarDate(pDate)) {
      setErrorMessage('Purchase date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }

    // 7. Validate expiration date: real calendar date
    const expDate = expirationDate.trim();
    if (!expDate) {
      setErrorMessage('Expiration date is required');
      return;
    }

    if (!isValidCalendarDate(expDate)) {
      setErrorMessage('Expiration date must be a valid calendar date in YYYY-MM-DD format (e.g. 2026-12-31)');
      return;
    }

    // 8. Expiration cannot be before purchase date
    if (expDate < pDate) {
      setErrorMessage('Expiration date cannot be earlier than purchase date');
      return;
    }

    // Execute atomic creation with double-tap prevention
    setSaving(true);
    const result = await createProductWithBatch({
      p_name: trimmedName,
      p_category_id: selectedCategoryId,
      p_price: priceNum,
      p_quantity: qtyNum,
      p_expiration_date: expDate,
      p_barcode: barcode.trim() || null,
      p_low_stock_level: lowStockNum,
      p_purchase_date: pDate,
    });
    setSaving(false);

    if (result.kind === 'error') {
      setErrorMessage(result.message);
      return;
    }

    // Success -> Navigate to AddStockDone
    navigation.navigate('AddStockDone', {
      units: qtyNum,
      batchCode: 'First Batch',
      expiryDate: expDate,
      productId: result.productId,
    });
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>New Product</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Create a new product with its first delivery batch
      </Text>

      {/* Error Message */}
      {errorMessage ? (
        <View style={{ marginTop: 12, padding: 8, backgroundColor: '#f8d7da' }}>
          <Text style={{ color: '#721c24', fontWeight: 'bold' }}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Product Details Section */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Product name</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="e.g. Milk 1L"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errorMessage) setErrorMessage(null);
          }}
          editable={!saving}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Barcode</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="Optional if barcode-less"
          value={barcode}
          onChangeText={(text) => {
            setBarcode(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="numeric"
          editable={!saving}
        />
        {fromScan ? (
          <Text style={{ color: 'gray', fontSize: 12, marginTop: 4 }}>
            Check that this matches the barcode on the package.
          </Text>
        ) : null}

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Category</Text>
        {loadingCategories ? (
          <ActivityIndicator size="small" color="#0056b3" style={{ marginVertical: 8 }} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {categories.map((cat) => (
              <Button
                key={cat.id}
                title={selectedCategoryId === cat.id ? `• ${cat.name}` : cat.name}
                onPress={() => setSelectedCategoryId(cat.id)}
                color={selectedCategoryId === cat.id ? '#0056b3' : 'gray'}
                disabled={saving}
              />
            ))}
          </View>
        )}

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Price (₱)</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="0.00"
          value={price}
          onChangeText={(text) => {
            setPrice(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="numeric"
          editable={!saving}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Low-stock alert level</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="5"
          value={lowStockLevel}
          onChangeText={(text) => {
            setLowStockLevel(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="numeric"
          editable={!saving}
        />
      </View>

      {/* First Batch Section */}
      <View style={{ marginTop: 24, borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>First Batch Details</Text>

        <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Quantity</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="10"
          value={quantity}
          onChangeText={(text) => {
            setQuantity(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="numeric"
          editable={!saving}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Purchase date</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="YYYY-MM-DD"
          value={purchaseDate}
          onChangeText={(text) => {
            setPurchaseDate(text);
            if (errorMessage) setErrorMessage(null);
          }}
          editable={!saving}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Expiration date</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="YYYY-MM-DD"
          value={expirationDate}
          onChangeText={(text) => {
            setExpirationDate(text);
            if (errorMessage) setErrorMessage(null);
          }}
          editable={!saving}
        />

        {isPastExpiry ? (
          <Text style={{ color: '#d9534f', marginTop: 4, fontWeight: 'bold' }}>
            Warning: The expiration date is already past!
          </Text>
        ) : null}
      </View>

      <View style={{ marginTop: 24, marginBottom: 40 }}>
        {saving ? (
          <ActivityIndicator size="small" color="#0056b3" />
        ) : (
          <Button title="Save product" onPress={handleSave} disabled={saving} />
        )}
      </View>
    </ScrollView>
  );
}
