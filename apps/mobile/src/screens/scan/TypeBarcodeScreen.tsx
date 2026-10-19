/**
 * Screen: TypeBarcodeScreen
 * Manual barcode entry, product search by name, and barcode-less item navigation.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { findProductByBarcode, searchProductsByName } from '../../services/inventory';
import { Product } from '../../types/inventory';

type Props = NativeStackScreenProps<ScanStackParamList, 'TypeBarcode'>;

export default function TypeBarcodeScreen({ route, navigation }: Props) {
  const mode = route.params?.mode || 'add';
  const [barcode, setBarcode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search by name state
  const [showNameSearch, setShowNameSearch] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [searchingName, setSearchingName] = useState(false);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleFind = async () => {
    const trimmed = barcode.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a barcode number');
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    if (mode === 'sell') {
      setLoading(false);
      navigation.navigate('SaleList');
      return;
    }

    const result = await findProductByBarcode(trimmed);
    setLoading(false);

    if (result.kind === 'error') {
      setErrorMessage(result.message);
      return;
    }

    if (result.kind === 'archived') {
      setErrorMessage('This product is archived');
      return;
    }

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

  const handleSelectProduct = (product: Product) => {
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
        Enter barcode number manually
      </Text>

      {errorMessage ? (
        <View style={{ marginTop: 12, padding: 8, backgroundColor: '#f8d7da' }}>
          <Text style={{ color: '#721c24', fontWeight: 'bold' }}>{errorMessage}</Text>
        </View>
      ) : null}

      {/* Barcode Input Section */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Barcode number</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
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
          <View style={{ borderWidth: 1, borderColor: '#ddd', padding: 12, marginTop: 4 }}>
            <Text style={{ fontWeight: 'bold' }}>Search by product name</Text>
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

            {searchResults.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelectProduct(item)}
                style={{
                  borderBottomWidth: 1,
                  borderColor: '#eee',
                  paddingVertical: 10,
                }}
              >
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                <Text style={{ color: 'gray', fontSize: 13 }}>
                  Barcode: {item.barcode || 'None'} • ₱{item.price.toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}
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
    </ScrollView>
  );
}
