/**
 * Screen: ProductDetailScreen
 * Reference: docs/design/02-inventory(2).png
 * Displays product details, summary cards, and batch breakdown using real Supabase data.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { InventoryStackParamList } from '../../navigation/types';
import { getProductWithBatches } from '../../services/inventory';
import { ProductWithBatches, ProductStockStatus } from '../../types/inventory';
import { formatDisplayDate, getBatchStatus, BatchStockStatus } from '../../utils/date';

const RefreshControlComponent = RefreshControl as any;

type Props = NativeStackScreenProps<InventoryStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const productId = route.params?.productId;
  const initialName = route.params?.productName;

  const [product, setProduct] = useState<ProductWithBatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProduct = async (isMounted = true) => {
    if (!productId) {
      setError('No product specified');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    const res = await getProductWithBatches(productId);

    if (!isMounted) return;

    if (res.kind === 'error') {
      setError(res.message);
      setProduct(null);
    } else if (res.kind === 'not_found') {
      setError('Product not found in active inventory');
      setProduct(null);
    } else {
      setProduct(res.data);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      loadProduct(isMounted);
      return () => {
        isMounted = false;
      };
    }, [productId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadProduct(true);
  };

  const getProductBadgeStyle = (status: ProductStockStatus) => {
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

  const getBatchBadgeStyle = (status: BatchStockStatus) => {
    switch (status) {
      case 'Sold out':
        return { color: 'gray', label: '[Sold out]' };
      case 'Expired':
        return { color: '#d9534f', label: '[Expired]' };
      case 'Near Expiry':
        return { color: '#e67e22', label: '[Near Expiry]' };
      case 'Good':
      default:
        return { color: '#2e7d32', label: '[Good]' };
    }
  };

  // Sort batches earliest expiry first
  const sortedBatches = (product?.batches || []).slice().sort((a, b) => {
    return a.expiration_date.localeCompare(b.expiration_date);
  });

  return (
    <ScrollView
      style={{ flex: 1, padding: 16 }}
      refreshControl={
        <RefreshControlComponent refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Button title="← Back to Inventory" onPress={() => navigation.goBack()} />

      <Text style={{ fontSize: 24, fontWeight: 'bold', marginTop: 12 }}>
        Product Detail
      </Text>

      {/* Loading state indicator */}
      {loading && !refreshing && (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 8, color: 'gray' }}>
            Loading product details...
          </Text>
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
            Unable to load product
          </Text>
          <Text style={{ color: '#333', marginTop: 4 }}>{error}</Text>
          <View style={{ marginTop: 12 }}>
            <Button
              title="Retry"
              onPress={() => {
                setLoading(true);
                loadProduct(true);
              }}
            />
          </View>
        </View>
      )}

      {/* Product Content */}
      {!loading && !error && product && (
        <>
          {/* Header Info */}
          <View style={{ marginTop: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 20,
                  fontWeight: 'bold',
                  flex: 1,
                  marginRight: 8,
                }}
              >
                {product.name}
              </Text>
              <Button title="Edit" disabled={true} onPress={() => {}} />
            </View>

            <Text style={{ color: 'gray', marginTop: 2 }}>
              Barcode: {product.barcode || 'N/A'}
            </Text>
            <Text style={{ color: 'gray', marginTop: 2 }}>
              Category: {product.category?.name || 'Uncategorized'} • Price: ₱
              {product.price.toFixed(2)}
            </Text>

            {/* Status Badges */}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 6,
                marginTop: 6,
              }}
            >
              {product.statuses.map((status) => {
                const badge = getProductBadgeStyle(status);
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
          </View>

          {/* Summary Cards */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                padding: 12,
                flex: 1,
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                {product.total_units}
              </Text>
              <Text style={{ color: 'gray' }}>Total left</Text>
            </View>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                padding: 12,
                flex: 1,
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                {product.sellable_units}
              </Text>
              <Text style={{ color: 'gray' }}>Sellable</Text>
            </View>
            <View
              style={{
                borderWidth: 1,
                borderColor: '#ccc',
                padding: 12,
                flex: 1,
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                {product.batch_count}
              </Text>
              <Text style={{ color: 'gray' }}>Batches</Text>
            </View>
          </View>

          {/* Batches Breakdown */}
          <View style={{ marginTop: 24, marginBottom: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Batches</Text>

            {sortedBatches.length === 0 ? (
              <Text style={{ color: 'gray', marginTop: 8 }}>
                No active batches for this product.
              </Text>
            ) : (
              sortedBatches.map((batch) => {
                const batchCode = `B - ${batch.id
                  .replace(/-/g, '')
                  .slice(0, 8)
                  .toUpperCase()}`;
                const batchStatus = getBatchStatus(
                  batch.expiration_date,
                  batch.quantity_left
                );
                const badge = getBatchBadgeStyle(batchStatus);

                return (
                  <View
                    key={batch.id}
                    style={{
                      borderWidth: 1,
                      borderColor: '#ccc',
                      padding: 12,
                      marginTop: 10,
                      backgroundColor: '#fff',
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Text style={{ fontWeight: 'bold', fontSize: 15 }}>
                        {batchCode}
                      </Text>
                      <Text style={{ fontWeight: '500' }}>
                        {batch.quantity_left} left
                      </Text>
                    </View>

                    <Text style={{ color: 'gray', marginTop: 4 }}>
                      Bought: {formatDisplayDate(batch.purchase_date)}
                    </Text>
                    <Text style={{ color: 'gray' }}>
                      Exp: {formatDisplayDate(batch.expiration_date)}
                    </Text>

                    <Text
                      style={{
                        color: badge.color,
                        fontWeight: '600',
                        marginTop: 4,
                      }}
                    >
                      {badge.label}
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <Button
                        title="Correct quantity"
                        disabled={true}
                        onPress={() => {}}
                      />
                      <Button
                        title="Edit dates"
                        disabled={true}
                        onPress={() => {}}
                      />
                      <Button
                        title="Delete"
                        disabled={true}
                        onPress={() => {}}
                        color="red"
                      />
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}
