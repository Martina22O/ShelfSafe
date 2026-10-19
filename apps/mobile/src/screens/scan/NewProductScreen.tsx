/**
 * Screen: NewProductScreen
 * Elements:
 * - Screen Name: New Product
 * - Product Name input
 * - Barcode input (prefilled or empty)
 * - Category picker (the 7 categories: Beverages, Canned Goods, Biscuits and Snacks, Noodles, Condiments, Dairy Products, Over-the-Counter Medicines)
 * - Price input
 * - Low-stock level input
 * - First batch fields:
 *   - Quantity
 *   - Purchase date
 *   - Expiration date
 * - "Save product" button
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'NewProduct'>;

const CATEGORIES = [
  'Beverages',
  'Canned Goods',
  'Biscuits and Snacks',
  'Noodles',
  'Condiments',
  'Dairy Products',
  'Over-the-Counter Medicines',
];

export default function NewProductScreen({ route, navigation }: Props) {
  const initialBarcode = route.params?.barcode || '';
  const today = new Date().toISOString().split('T')[0];

  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState(initialBarcode);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [price, setPrice] = useState('0.00');
  const [lowStockLevel, setLowStockLevel] = useState('5');

  // First batch fields
  const [quantity, setQuantity] = useState('10');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expirationDate, setExpirationDate] = useState('2026-12-31');

  const handleSave = () => {
    navigation.navigate('AddStockDone', {
      units: parseInt(quantity, 10) || 10,
      batchCode: 'B-FIRSTBATCH',
      expiryDate: expirationDate,
    });
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>New Product</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Create a new product with its first delivery batch
      </Text>

      {/* Product Details */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Product name</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="e.g. Milk 1L"
          value={name}
          onChangeText={setName}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Barcode</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="Optional if barcode-less"
          value={barcode}
          onChangeText={setBarcode}
          keyboardType="numeric"
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              title={category === cat ? `• ${cat}` : cat}
              onPress={() => setCategory(cat)}
            />
          ))}
        </View>

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Price (₱)</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="0.00"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        <Text style={{ fontWeight: 'bold', marginTop: 12 }}>Low-stock alert level</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="5"
          value={lowStockLevel}
          onChangeText={setLowStockLevel}
          keyboardType="numeric"
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
          onChangeText={setQuantity}
          keyboardType="numeric"
        />

        <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Purchase date</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="YYYY-MM-DD"
          value={purchaseDate}
          onChangeText={setPurchaseDate}
        />

        <Text style={{ fontWeight: 'bold', marginTop: 8 }}>Expiration date</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
          placeholder="YYYY-MM-DD"
          value={expirationDate}
          onChangeText={setExpirationDate}
        />
      </View>

      <View style={{ marginTop: 24, marginBottom: 40 }}>
        <Button title="Save product" onPress={handleSave} />
      </View>
    </ScrollView>
  );
}
