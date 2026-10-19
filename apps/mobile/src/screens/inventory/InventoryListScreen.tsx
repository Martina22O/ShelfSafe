/**
 * Screen: InventoryListScreen
 * Reference: docs/design/02-inventory(1,3,4).png
 * Elements:
 * - Screen Name: Inventory
 * - Header count ("7 products • 206 units")
 * - Search bar ("Search name or barcode")
 * - Categories filter selector (All Categories, Beverages, Biscuits, Dairy products, Medicines, Condiments, Noodles, Canned Goods)
 * - Stock status filter selector (All Stocks, Low Stock, Near Expiry, Expired)
 * - Product cards grouped by category
 * - Product item card elements (name, barcode, price, unit count, batch count, status badge)
 * - Empty match state placeholder ("No products match / Try another search or filter")
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { InventoryStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<InventoryStackParamList, 'InventoryList'>;

const CATEGORIES = [
  'All Categories',
  'Beverages',
  'Biscuits',
  'Dairy products',
  'Medicines',
  'Condiments',
  'Noodles',
  'Canned Goods',
];

const STATUS_FILTERS = ['All Stocks', 'Low Stock', 'Near Expiry', 'Expired'];

export default function InventoryListScreen({ navigation }: Props) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState('All Stocks');

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Inventory</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>7 products • 206 units</Text>

      {/* Search Input */}
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 12 }}
        placeholder="Search name or barcode"
        value={search}
        onChangeText={setSearch}
      />

      {/* Categories Filter */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Categories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                title={selectedCategory === cat ? `• ${cat}` : cat}
                onPress={() => setSelectedCategory(cat)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Stock Status Filter */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Stock status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {STATUS_FILTERS.map((status) => (
            <Button
              key={status}
              title={selectedStatus === status ? `• ${status}` : status}
              onPress={() => setSelectedStatus(status)}
            />
          ))}
        </View>
      </View>

      {/* Sample Product Cards */}
      <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Beverages</Text>
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Coca-Cola 1.5L</Text>
            <Text style={{ fontWeight: 'bold' }}>₱75.00</Text>
          </View>
          <Text style={{ color: 'gray' }}>Barcode: 4801981118502</Text>
          <Text style={{ marginTop: 4 }}>34 units (2 batches • 30 sellable)</Text>
          <Text style={{ color: '#d9534f', marginTop: 2 }}>[Has expired stock]</Text>
          <View style={{ marginTop: 8 }}>
            <Button
              title="View Product Details"
              onPress={() =>
                navigation.navigate('ProductDetail', {
                  productName: 'Coca-Cola 1.5L',
                })
              }
            />
          </View>
        </View>

        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Biscuits</Text>
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 16 }}>Skyflakes 250g</Text>
            <Text style={{ fontWeight: 'bold' }}>₱34.00</Text>
          </View>
          <Text style={{ color: 'gray' }}>Barcode: 4800016544306</Text>
          <Text style={{ marginTop: 4 }}>3 units (1 batch)</Text>
          <Text style={{ color: '#f0ad4e', marginTop: 2 }}>[Low stock] [Near expiry]</Text>
          <View style={{ marginTop: 8 }}>
            <Button
              title="View Product Details"
              onPress={() =>
                navigation.navigate('ProductDetail', {
                  productName: 'Skyflakes 250g',
                })
              }
            />
          </View>
        </View>

        {/* Empty Search State placeholder */}
        <View style={{ marginTop: 16, padding: 16, alignItems: 'center' }}>
          <Text style={{ color: 'gray' }}>No products match</Text>
          <Text style={{ color: 'gray', fontSize: 12 }}>Try another search or filter</Text>
        </View>
      </View>
    </ScrollView>
  );
}
