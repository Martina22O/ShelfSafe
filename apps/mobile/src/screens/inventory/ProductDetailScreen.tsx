/**
 * Screen: ProductDetailScreen
 * Reference: docs/design/02-inventory(2).png
 * Elements:
 * - Screen Name: Product Detail
 * - Back to Inventory navigation
 * - Product Header (Name, Barcode, Category, Price, "Edit" button)
 * - Summary cards (Total left, Sellable, Batches count)
 * - Batches section header
 * - Batch cards list:
 *   - Batch code
 *   - Bought date
 *   - Expiration date
 *   - Status badge (Expired / Good / Near Expiry)
 *   - Quantity left
 *   - Action links ("Correct quantity | Edit dates | Delete")
 */
import React from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InventoryStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<InventoryStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const productName = route.params?.productName || 'Coca-Cola 1.5L';

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Button title="← Back to Inventory" onPress={() => navigation.goBack()} />

      <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 12 }}>
        Product Detail
      </Text>

      {/* Header Info */}
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{productName}</Text>
          <Button title="Edit" onPress={() => {}} />
        </View>
        <Text style={{ color: 'gray' }}>Barcode: 4801981118502</Text>
        <Text style={{ color: 'gray' }}>Category: Beverages • Price: ₱75.00</Text>
      </View>

      {/* Summary Cards */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>34</Text>
          <Text style={{ color: 'gray' }}>Total left</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>30</Text>
          <Text style={{ color: 'gray' }}>Sellable</Text>
        </View>
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold' }}>2</Text>
          <Text style={{ color: 'gray' }}>Batches</Text>
        </View>
      </View>

      {/* Batches Breakdown */}
      <View style={{ marginTop: 24, marginBottom: 40 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Batches</Text>

        {/* Batch 1 (Expired) */}
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>B-EB318AA5</Text>
            <Text>4 of 4 left</Text>
          </View>
          <Text style={{ color: 'gray' }}>Bought: Sep 1, 2026</Text>
          <Text style={{ color: 'gray' }}>Exp: Sep 28, 2026</Text>
          <Text style={{ color: '#d9534f', marginTop: 2 }}>[Expired]</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button title="Correct quantity" onPress={() => {}} />
            <Button title="Edit dates" onPress={() => {}} />
            <Button title="Delete" onPress={() => {}} color="red" />
          </View>
        </View>

        {/* Batch 2 (Good) */}
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold' }}>B-E4718687</Text>
            <Text>30 of 30 left</Text>
          </View>
          <Text style={{ color: 'gray' }}>Bought: Sep 26, 2026</Text>
          <Text style={{ color: 'gray' }}>Exp: Mar 30, 2027</Text>
          <Text style={{ color: '#5cb85c', marginTop: 2 }}>[Good]</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button title="Correct quantity" onPress={() => {}} />
            <Button title="Edit dates" onPress={() => {}} />
            <Button title="Delete" onPress={() => {}} color="red" />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
