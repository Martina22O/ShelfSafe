/**
 * Screen: EditProductScreen
 * Edit an existing product with validation, confirmation, and error handling.
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  ActivityIndicator,
  Modal,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InventoryStackParamList } from '../../navigation/types';
import {
  getProductWithBatches,
  getCategories,
  updateProduct,
} from '../../services/inventory';
import { Category, ProductWithBatches } from '../../types/inventory';

type Props = NativeStackScreenProps<InventoryStackParamList, 'EditProduct'>;

export default function EditProductScreen({ route, navigation }: Props) {
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
      getProductWithBatches(productId),
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
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={{ marginTop: 8, color: 'gray' }}>Loading product details...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#d9534f' }}>
          {loadError}
        </Text>
        <View style={{ marginTop: 16 }}>
          <Button title="← Back to Inventory" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Button
        title="← Back to Product"
        onPress={() => navigation.goBack()}
        disabled={saving}
      />

      <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 12 }}>
        Edit Product
      </Text>
      <Text style={{ color: 'gray', marginTop: 2 }}>
        Update details for {initialProduct?.name}
      </Text>

      {/* Success Banner */}
      {successMessage ? (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: '#2e7d32',
            backgroundColor: '#edf7ed',
          }}
        >
          <Text style={{ color: '#2e7d32', fontWeight: 'bold' }}>
            {successMessage}
          </Text>
        </View>
      ) : null}

      {/* Error Banner */}
      {errorMessage ? (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            borderWidth: 1,
            borderColor: '#d9534f',
            backgroundColor: '#fdf7f7',
          }}
        >
          <Text style={{ color: '#d9534f', fontWeight: 'bold' }}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* Form Fields */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Product name</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4, backgroundColor: '#fff' }}
          placeholder="e.g. Milk 1L"
          value={name}
          onChangeText={(text) => {
            setName(text);
            if (errorMessage) setErrorMessage(null);
          }}
          editable={!saving}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 14 }}>Barcode</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4, backgroundColor: '#fff' }}
          placeholder="Optional if barcode-less"
          value={barcode}
          onChangeText={(text) => {
            setBarcode(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="default"
          editable={!saving}
        />

        {/* Warning if barcode is modified */}
        {isBarcodeChanged ? (
          <View
            style={{
              marginTop: 6,
              padding: 8,
              borderWidth: 1,
              borderColor: '#f0ad4e',
              backgroundColor: '#fffcf5',
            }}
          >
            <Text style={{ color: '#8a6d3b', fontSize: 13 }}>
              Warning: Changing the barcode will change which barcode scans find this product.
            </Text>
          </View>
        ) : null}

        <Text style={{ fontWeight: 'bold', marginTop: 14 }}>Category</Text>
        {loadingCategories ? (
          <ActivityIndicator size="small" color="#2e7d32" style={{ marginVertical: 8 }} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {categories.map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => {
                    if (!saving) setSelectedCategoryId(cat.id);
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: isSelected ? '#2e7d32' : '#ccc',
                    backgroundColor: isSelected ? '#2e7d32' : '#fff',
                  }}
                >
                  <Text
                    style={{
                      color: isSelected ? '#fff' : '#000',
                      fontWeight: isSelected ? 'bold' : 'normal',
                    }}
                  >
                    {isSelected ? `• ${cat.name}` : cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={{ fontWeight: 'bold', marginTop: 14 }}>Price (₱)</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4, backgroundColor: '#fff' }}
          placeholder="0.00"
          value={price}
          onChangeText={(text) => {
            setPrice(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="numeric"
          editable={!saving}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 14 }}>Low-stock alert level</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4, backgroundColor: '#fff' }}
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

      {/* Action Buttons */}
      <View style={{ marginTop: 24, marginBottom: 40, gap: 10 }}>
        <Button
          title={saving ? 'Saving changes...' : 'Save Product Changes'}
          onPress={handleOpenConfirm}
          disabled={saving || isUnchanged}
          color="#2e7d32"
        />
        {isUnchanged && !saving ? (
          <Text style={{ color: 'gray', fontSize: 13, textAlign: 'center' }}>
            No changes made yet
          </Text>
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
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              padding: 20,
              borderRadius: 6,
              width: '100%',
              maxWidth: 360,
              borderWidth: 1,
              borderColor: '#ccc',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Save these changes?</Text>
            <Text style={{ color: '#444', marginTop: 8 }}>
              Are you sure you want to update the details for "{trimmedName}"?
            </Text>

            <View style={{ marginTop: 12, padding: 8, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee' }}>
              <Text style={{ fontSize: 13 }}>• Name: {trimmedName}</Text>
              <Text style={{ fontSize: 13 }}>• Barcode: {trimmedBarcode || 'None'}</Text>
              <Text style={{ fontSize: 13 }}>• Price: ₱{priceNum.toFixed(2)}</Text>
              <Text style={{ fontSize: 13 }}>• Low-stock level: {lowStockNum}</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
              <Button
                title="Cancel"
                onPress={() => setShowConfirmModal(false)}
                disabled={saving}
                color="gray"
              />
              <Button
                title={saving ? 'Saving...' : 'Yes, Save'}
                onPress={handleConfirmSave}
                disabled={saving}
                color="#2e7d32"
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
