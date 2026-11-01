/**
 * Screen: AddStockFormScreen
 * Add stock batch to an existing product with validation and summary.
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

type Props = NativeStackScreenProps<ScanStackParamList, 'AddStockForm'>;

export default function AddStockFormScreen({ route, navigation }: Props) {
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
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0056b3" />
        <Text style={{ marginTop: 12 }}>Loading product details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Add Stock</Text>

      {/* Product Summary Card */}
      {productData ? (
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{productData.name}</Text>
          <Text style={{ color: 'gray' }}>Barcode: {productData.barcode || 'No barcode'}</Text>
          <Text style={{ color: 'gray' }}>
            Category: {productData.category?.name || 'Uncategorized'} • Price: ₱{productData.price.toFixed(2)}
          </Text>
          <Text style={{ marginTop: 6, fontWeight: 'bold' }}>
            Total units: {productData.total_units} • Sellable: {productData.sellable_units} • Batches: {productData.batch_count}
          </Text>
        </View>
      ) : (
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{paramProductName || 'Product'}</Text>
          <Text style={{ color: 'gray' }}>Barcode: {paramBarcode || 'No barcode'}</Text>
        </View>
      )}

      {/* Error Message Display */}
      {errorMessage ? (
        <View style={{ marginTop: 12, padding: 8, backgroundColor: '#f8d7da' }}>
          <Text style={{ color: '#721c24', fontWeight: 'bold' }}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Form Fields */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Quantity</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="Enter quantity (at least 1)"
          value={quantity}
          onChangeText={(text) => {
            setQuantity(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="numeric"
          editable={!saving}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Purchase date</Text>
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

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Expiration date</Text>
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

        <Text style={{ color: 'gray', fontStyle: 'italic', marginTop: 16 }}>
          Note: This creates a new batch
        </Text>

        <View style={{ marginTop: 24, marginBottom: 40 }}>
          {saving ? (
            <ActivityIndicator size="small" color="#0056b3" />
          ) : (
            <Button
              title="Save batch"
              onPress={handleSaveBatch}
              disabled={saving || !productData}
            />
          )}
        </View>
      </View>
    </ScrollView>
  );
}
