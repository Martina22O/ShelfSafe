/**
 * Screen: AddStockFormScreen
 * Elements:
 * - Screen Name: Add Stock
 * - Product summary card (name, barcode, category, price, total units, number of batches)
 * - Quantity input (rule: quantity at least 1)
 * - Purchase date input (default today)
 * - Expiration date input (rules: expiration not before purchase date, warn if already past)
 * - Note ("This creates a new batch")
 * - "Save batch" button
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'AddStockForm'>;

export default function AddStockFormScreen({ route, navigation }: Props) {
  const barcode = route.params?.barcode || '4801981118502';
  const productName = route.params?.productName || 'Coca-Cola 1.5L';

  const today = new Date().toISOString().split('T')[0];
  const [quantity, setQuantity] = useState('10');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expirationDate, setExpirationDate] = useState('2026-12-31');
  const [error, setError] = useState<string | null>(null);

  const isExpired = expirationDate < today;

  const handleSaveBatch = () => {
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      setError('Quantity must be at least 1');
      return;
    }
    if (expirationDate < purchaseDate) {
      setError('Expiration date cannot be before purchase date');
      return;
    }

    navigation.navigate('AddStockDone', {
      units: qty,
      batchCode: 'B-NEWBATCH',
      expiryDate: expirationDate,
    });
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Add Stock</Text>

      {/* Product Summary Card */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{productName}</Text>
        <Text style={{ color: 'gray' }}>Barcode: {barcode}</Text>
        <Text style={{ color: 'gray' }}>Category: Beverages • Price: ₱75.00</Text>
        <Text style={{ marginTop: 4 }}>
          Total units: 34 • Number of batches: 2
        </Text>
      </View>

      {/* Form Fields */}
      <View style={{ marginTop: 16 }}>
        {error ? <Text style={{ color: 'red', marginBottom: 8 }}>{error}</Text> : null}

        <Text style={{ fontWeight: 'bold' }}>Quantity</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="Enter quantity (at least 1)"
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Purchase date</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="YYYY-MM-DD"
          value={purchaseDate}
          onChangeText={setPurchaseDate}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Expiration date</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="YYYY-MM-DD"
          value={expirationDate}
          onChangeText={setExpirationDate}
        />

        {isExpired ? (
          <Text style={{ color: '#d9534f', marginTop: 4, fontWeight: 'bold' }}>
            Warning: The expiration date is already past!
          </Text>
        ) : null}

        <Text style={{ color: 'gray', fontStyle: 'italic', marginTop: 16 }}>
          Note: This creates a new batch
        </Text>

        <View style={{ marginTop: 24, marginBottom: 40 }}>
          <Button title="Save batch" onPress={handleSaveBatch} />
        </View>
      </View>
    </ScrollView>
  );
}
