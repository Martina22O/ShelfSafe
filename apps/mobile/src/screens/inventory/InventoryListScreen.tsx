/**
 * Screen: InventoryListScreen
 * Reference: docs/design/02-inventory(1,3,4).png
 * Real data integration with Supabase, client-side filtering, and category grouping.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { InventoryStackParamList } from '../../navigation/types';
import { getInventory, getCategories } from '../../services/inventory';
import { ProductWithBatches, Category, ProductStockStatus } from '../../types/inventory';

const RefreshControlComponent = RefreshControl as any;

type Props = NativeStackScreenProps<InventoryStackParamList, 'InventoryList'>;

const STATUS_FILTERS = ['All Stocks', 'Low Stock', 'Near Expiry', 'Expired'] as const;
type StatusFilterType = (typeof STATUS_FILTERS)[number];

export default function InventoryListScreen({ navigation }: Props) {
  const [allProducts, setAllProducts] = useState<ProductWithBatches[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterType>('All Stocks');

  const loadData = async (isMounted = true) => {
    setError(null);
    const [invRes, catRes] = await Promise.all([
      getInventory(),
      getCategories(),
    ]);

    if (!isMounted) return;

    if (invRes.kind === 'error') {
      setError(invRes.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setAllProducts(invRes.products);

    if (catRes.kind === 'success') {
      setCategories(catRes.categories);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      loadData(isMounted);
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  // The header always shows total counts for all non-archived products
  const totalProducts = allProducts.length;
  const totalUnits = allProducts.reduce((sum, p) => sum + p.total_units, 0);

  // Category filter choices: "All Categories" + real categories from DB
  const categoryOptions = [
    'All Categories',
    ...categories.map((c) => c.name),
  ];

  // Client-side filtering combining category, stock status, and search query
  const filteredProducts = allProducts.filter((product) => {
    // 1. Category Filter
    if (selectedCategory !== 'All Categories') {
      const prodCategoryName = product.category?.name || 'Uncategorized';
      if (prodCategoryName !== selectedCategory) {
        return false;
      }
    }

    // 2. Stock Status Filter
    if (selectedStatus === 'Low Stock') {
      if (!product.statuses.includes('Low stock')) return false;
    } else if (selectedStatus === 'Near Expiry') {
      if (!product.statuses.includes('Near expiry')) return false;
    } else if (selectedStatus === 'Expired') {
      if (!product.statuses.includes('Has expired stock')) return false;
    }

    // 3. Search Filter (name or barcode, case-insensitive)
    const query = search.trim().toLowerCase();
    if (query) {
      const matchName = product.name.toLowerCase().includes(query);
      const matchBarcode = product.barcode
        ? product.barcode.toLowerCase().includes(query)
        : false;
      if (!matchName && !matchBarcode) {
        return false;
      }
    }

    return true;
  });

  // Group filtered products by category
  const groupedByCategory: Record<string, ProductWithBatches[]> = {};
  for (const product of filteredProducts) {
    const catName = product.category?.name || 'Uncategorized';
    if (!groupedByCategory[catName]) {
      groupedByCategory[catName] = [];
    }
    groupedByCategory[catName].push(product);
  }
  const groupedCategoryNames = Object.keys(groupedByCategory);

  const getBadgeStyle = (status: ProductStockStatus) => {
    switch (status) {
      case 'Has expired stock':
        return { color: '#d9534f', label: '[Has expired stock]' };
      case 'Low stock':
        return { color: '#f0ad4e', label: '[Low stock]' };
      case 'Near expiry':
        return { color: '#e67e22', label: '[Near expiry]' };
      case 'In Stock':
      default:
        return { color: '#2e7d32', label: '[In Stock]' };
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, padding: 16 }}
      refreshControl={
        <RefreshControlComponent refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Inventory</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        {totalProducts} products • {totalUnits} units
      </Text>

      {/* Search Input */}
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: '#ccc',
          padding: 8,
          marginTop: 12,
          backgroundColor: '#fff',
        }}
        placeholder="Search name or barcode"
        value={search}
        onChangeText={setSearch}
      />

      {/* Categories Filter Selector */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Categories</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 8 }}
        >
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {categoryOptions.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
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
                    {isSelected ? `• ${cat}` : cat}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Stock Status Filter Selector */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Stock status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {STATUS_FILTERS.map((status) => {
            const isSelected = selectedStatus === status;
            return (
              <TouchableOpacity
                key={status}
                onPress={() => setSelectedStatus(status)}
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
                  {isSelected ? `• ${status}` : status}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Loading state indicator */}
      {loading && !refreshing && (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 8, color: 'gray' }}>Loading inventory...</Text>
        </View>
      )}

      {/* Error state */}
      {error && !loading && (
        <View
          style={{
            marginTop: 20,
            padding: 16,
            borderWidth: 1,
            borderColor: '#d9534f',
            backgroundColor: '#fdf7f7',
          }}
        >
          <Text style={{ color: '#d9534f', fontWeight: 'bold' }}>
            Unable to load inventory
          </Text>
          <Text style={{ color: '#333', marginTop: 4 }}>{error}</Text>
          <View style={{ marginTop: 12 }}>
            <Button
              title="Retry"
              onPress={() => {
                setLoading(true);
                loadData(true);
              }}
            />
          </View>
        </View>
      )}

      {/* Product list or Empty states */}
      {!loading && !error && (
        <View style={{ marginTop: 24, marginBottom: 40 }}>
          {/* Case 1: No products in DB at all */}
          {allProducts.length === 0 ? (
            <View style={{ marginTop: 24, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#555' }}>
                No products in inventory
              </Text>
              <Text style={{ color: 'gray', marginTop: 4, textAlign: 'center' }}>
                You have not added any stock yet. Use the Scan tab to add products.
              </Text>
            </View>
          ) : filteredProducts.length === 0 ? (
            /* Case 2: Filter/search yielded 0 matches */
            <View style={{ marginTop: 24, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#555' }}>
                No products match
              </Text>
              <Text style={{ color: 'gray', marginTop: 4 }}>
                Try another search or filter
              </Text>
            </View>
          ) : (
            /* Case 3: Display grouped product cards */
            groupedCategoryNames.map((catName) => (
              <View key={catName} style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                  {catName}
                </Text>
                <View style={{ gap: 10 }}>
                  {groupedByCategory[catName].map((product) => {
                    const batchText =
                      product.sellable_units < product.total_units
                        ? `${product.batch_count} ${
                            product.batch_count === 1 ? 'batch' : 'batches'
                          } • ${product.sellable_units} sellable`
                        : `${product.batch_count} ${
                            product.batch_count === 1 ? 'batch' : 'batches'
                          }`;

                    return (
                      <TouchableOpacity
                        key={product.id}
                        activeOpacity={0.7}
                        onPress={() =>
                          navigation.navigate('ProductDetail', {
                            productId: product.id,
                            productName: product.name,
                          })
                        }
                        style={{
                          borderWidth: 1,
                          borderColor: '#ccc',
                          padding: 12,
                          backgroundColor: '#fff',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                          }}
                        >
                          <Text
                            style={{
                              fontWeight: 'bold',
                              fontSize: 16,
                              flex: 1,
                              marginRight: 8,
                            }}
                          >
                            {product.name}
                          </Text>
                          <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                            ₱{product.price.toFixed(2)}
                          </Text>
                        </View>

                        <Text style={{ color: 'gray', marginTop: 2 }}>
                          Barcode: {product.barcode || 'N/A'}
                        </Text>

                        <Text style={{ marginTop: 4 }}>
                          <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                            {product.total_units}
                          </Text>{' '}
                          units ({batchText})
                        </Text>

                        {/* Status badges */}
                        <View
                          style={{
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                            gap: 6,
                            marginTop: 6,
                          }}
                        >
                          {product.statuses.map((status) => {
                            const badge = getBadgeStyle(status);
                            return (
                              <Text
                                key={status}
                                style={{
                                  color: badge.color,
                                  fontWeight: '600',
                                  fontSize: 13,
                                }}
                              >
                                {badge.label}
                              </Text>
                            );
                          })}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}
