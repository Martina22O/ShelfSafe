/**
 * Screen: TypeBarcodeScreen
 * Manual barcode entry, product search by name, and barcode-less item navigation.
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
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

type Props = NativeStackScreenProps<ScanStackParamList, 'TypeBarcode'>;

export default function TypeBarcodeScreen({ route, navigation }: Props) {
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
      setErrorMessage('This product is archived');
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
          setErrorMessage('No sellable units for this product');
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
        setErrorMessage('No sellable units for this product');
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

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Type Barcode</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Mode: {mode === 'add' ? 'Add Stock' : 'Record Sold Items'}
      </Text>

      {restoreSuccessMessage ? (
        <View style={{ marginTop: 12, padding: 10, borderWidth: 1, borderColor: '#2e7d32', backgroundColor: '#edf7ed' }}>
          <Text style={{ color: '#2e7d32', fontWeight: 'bold' }}>{restoreSuccessMessage}</Text>
        </View>
      ) : null}

      {errorMessage ? (
        <View style={{ marginTop: 12, padding: 10, borderWidth: 1, borderColor: '#d9534f', backgroundColor: '#fdf7f7' }}>
          <Text style={{ color: '#d9534f', fontWeight: 'bold' }}>{errorMessage}</Text>
          {archivedProduct && (
            <View style={{ marginTop: 10 }}>
              <Button
                title={restoring ? 'Restoring...' : 'Restore Product'}
                disabled={restoring}
                onPress={() => setShowRestoreModal(true)}
                color="#2e7d32"
              />
            </View>
          )}
        </View>
      ) : null}

      {/* Barcode Input Section */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Barcode number</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4, backgroundColor: '#fff' }}
          placeholder="e.g. 4801981118502"
          value={barcode}
          onChangeText={(text) => {
            setBarcode(text);
            if (errorMessage) setErrorMessage(null);
          }}
          keyboardType="numeric"
          editable={!loading}
        />

        <View style={{ marginTop: 12 }}>
          {loading ? (
            <ActivityIndicator size="small" color="#0056b3" />
          ) : (
            <Button title="Find" onPress={handleFind} />
          )}
        </View>
      </View>

      {/* Action Options */}
      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          title={showNameSearch ? 'Hide search by name' : 'Search product by name'}
          onPress={() => setShowNameSearch(!showNameSearch)}
          color="gray"
        />

        {showNameSearch ? (
          <View style={{ borderWidth: 1, borderColor: '#ddd', padding: 12, marginTop: 4, backgroundColor: '#fff' }}>
            <Text style={{ fontWeight: 'bold' }}>Search by product name</Text>
            {mode === 'sell' && (
              <Text style={{ color: 'gray', fontSize: 12, marginTop: 2 }}>
                Use this to sell barcode-less products or items that cannot be scanned.
              </Text>
            )}
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 6 }}
              placeholder="Type product name..."
              value={nameQuery}
              onChangeText={setNameQuery}
            />
            <View style={{ marginTop: 8 }}>
              {searchingName ? (
                <ActivityIndicator size="small" color="#0056b3" />
              ) : (
                <Button title="Search" onPress={handleSearchByName} />
              )}
            </View>

            {/* Search results list */}
            {hasSearched && searchResults.length === 0 && !searchingName ? (
              <Text style={{ color: 'gray', marginTop: 8, fontStyle: 'italic' }}>
                No active products found matching "{nameQuery}"
              </Text>
            ) : null}

            {searchResults.map((item) => {
              const isCurrentSelecting = selectingProductId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleSelectProduct(item)}
                  disabled={isCurrentSelecting}
                  style={{
                    borderBottomWidth: 1,
                    borderColor: '#eee',
                    paddingVertical: 10,
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                      <Text style={{ color: 'gray', fontSize: 13 }}>
                        Barcode: {item.barcode || 'None'} • ₱{item.price.toFixed(2)}
                      </Text>
                    </View>
                    {isCurrentSelecting ? (
                      <ActivityIndicator size="small" color="#0056b3" />
                    ) : (
                      <Text style={{ color: '#0056b3', fontWeight: 'bold' }}>
                        {mode === 'sell' ? 'Add to cart →' : 'Select →'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {mode === 'add' ? (
          <Button
            title="Add a product with no barcode"
            onPress={() => navigation.navigate('NewProduct', { barcode: '' })}
            color="gray"
          />
        ) : null}
      </View>

      {/* Restore Confirmation Modal */}
      <Modal
        visible={showRestoreModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!restoring) setShowRestoreModal(false);
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
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Restore Product?</Text>
            <Text style={{ color: '#333', marginTop: 10, fontSize: 14 }}>
              Restore "{archivedProduct?.name}" to active inventory?
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button
                title="Cancel"
                onPress={() => setShowRestoreModal(false)}
                disabled={restoring}
                color="gray"
              />
              <Button
                title={restoring ? 'Restoring...' : 'Yes, Restore'}
                onPress={async () => {
                  if (!archivedProduct) return;
                  setRestoring(true);
                  const res = await restoreProduct(archivedProduct.id);
                  setRestoring(false);
                  setShowRestoreModal(false);

                  if (res.kind === 'db_error') {
                    setErrorMessage(res.message);
                    return;
                  }
                  if (res.kind === 'network_timeout') {
                    setErrorMessage(res.message);
                    return;
                  }

                  setRestoreSuccessMessage(`"${archivedProduct.name}" restored! You can now add stock or record sales.`);
                  setErrorMessage(null);
                  setArchivedProduct(null);
                }}
                disabled={restoring}
                color="#2e7d32"
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
