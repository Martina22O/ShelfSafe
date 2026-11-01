/**
 * Screen: ProductDetailScreen
 * Reference: docs/design/02-inventory(2).png
 * Displays product details, summary cards, and batch breakdown using real Supabase data.
 * Enables product editing, quantity correction, batch date edits, and batch/product removal.
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  BackHandler,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { InventoryStackParamList } from '../../navigation/types';
import {
  getProductWithBatches,
  getBatch,
  correctBatchQuantity,
  updateBatchDates,
  removeBatch,
  removeProduct,
} from '../../services/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { ProductWithBatches, ProductStockStatus, Batch } from '../../types/inventory';
import {
  formatDisplayDate,
  getTodayInManila,
  getBatchStatus,
  BatchStockStatus,
  isValidCalendarDate,
  isDateInPast,
} from '../../utils/date';

const RefreshControlComponent = RefreshControl as any;

type Props = NativeStackScreenProps<InventoryStackParamList, 'ProductDetail'>;

export default function ProductDetailScreen({ route, navigation }: Props) {
  const {
    near_expiry_days,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useStoreSettings();
  const productId = route.params?.productId;

  const [product, setProduct] = useState<ProductWithBatches | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [productNotFound, setProductNotFound] = useState(false);

  // Status banners
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Correct Quantity Modal State
  const [qtyModalVisible, setQtyModalVisible] = useState(false);
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [fetchingBatch, setFetchingBatch] = useState(false);
  const [newQtyInput, setNewQtyInput] = useState('');
  const [qtyStep, setQtyStep] = useState<'input' | 'confirm'>('input');
  const [qtyModalError, setQtyModalError] = useState<string | null>(null);

  // Edit Dates Modal State
  const [datesModalVisible, setDatesModalVisible] = useState(false);
  const [purchaseDateInput, setPurchaseDateInput] = useState('');
  const [expirationDateInput, setExpirationDateInput] = useState('');
  const [datesStep, setDatesStep] = useState<'input' | 'confirm'>('input');
  const [datesModalError, setDatesModalError] = useState<string | null>(null);

  // Delete Batch Modal State
  const [deleteBatchModalVisible, setDeleteBatchModalVisible] = useState(false);

  // Delete Product Modal State
  const [deleteProductModalVisible, setDeleteProductModalVisible] = useState(false);

  // Prevent hardware back navigation during active saving
  useEffect(() => {
    const backAction = () => {
      if (saving) return true; // block back navigation
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

  const loadProduct = async (isMounted = true) => {
    if (settingsLoading || settingsError) return;
    if (!productId) {
      setProductNotFound(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setError(null);
    const res = await getProductWithBatches(productId, near_expiry_days);

    if (!isMounted) return;

    if (res.kind === 'error') {
      if (/not found|access denied/i.test(res.message)) {
        setProductNotFound(true);
      } else {
        setError(res.message);
      }
      setProduct(null);
    } else if (res.kind === 'not_found' || res.data.is_archived) {
      setProductNotFound(true);
      setProduct(null);
    } else {
      setProductNotFound(false);
      setProduct(res.data);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (!settingsLoading && !settingsError) {
        loadProduct(isMounted);
      }
      return () => {
        isMounted = false;
      };
    }, [productId, settingsLoading, settingsError, near_expiry_days])
  );

  useEffect(() => {
    if (!settingsLoading && !settingsError) {
      loadProduct(true);
    }
  }, [near_expiry_days, settingsLoading, settingsError]);

  const onRefresh = () => {
    setRefreshing(true);
    setActionSuccess(null);
    setActionError(null);
    loadProduct(true);
  };

  // --- BATCH ACTION HANDLERS ---

  // 1. Open Correct Quantity Dialog (Re-fetches batch first)
  const openCorrectQuantity = async (batch: Batch) => {
    setActionSuccess(null);
    setActionError(null);
    setQtyModalError(null);
    setQtyStep('input');
    setActiveBatch(batch);
    setNewQtyInput(batch.quantity_left.toString());
    setQtyModalVisible(true);
    setFetchingBatch(true);

    const fresh = await getBatch(batch.id);
    setFetchingBatch(false);
    if (fresh.kind === 'success') {
      setActiveBatch(fresh.batch);
      setNewQtyInput(fresh.batch.quantity_left.toString());
    }
  };

  const handleQtyInputSubmit = () => {
    setQtyModalError(null);
    const trimmed = newQtyInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      setQtyModalError('Quantity must be a whole number between 0 and 100,000');
      return;
    }
    const val = Number(trimmed);
    if (val < 0 || val > 100000) {
      setQtyModalError('Quantity must be a whole number between 0 and 100,000');
      return;
    }
    setQtyStep('confirm');
  };

  const handleConfirmQuantityCorrection = async () => {
    if (!activeBatch) return;
    setSaving(true);
    setQtyModalError(null);

    const qty = Number(newQtyInput.trim());
    const res = await correctBatchQuantity(activeBatch.id, qty);
    setSaving(false);

    if (res.kind === 'db_error') {
      setQtyModalError(res.message);
      setQtyStep('input');
      return;
    }

    if (res.kind === 'network_timeout') {
      setQtyModalVisible(false);
      setActionError(res.message);
      loadProduct(true);
      return;
    }

    // Success
    setQtyModalVisible(false);
    setActionSuccess(`Quantity updated from ${activeBatch.quantity_left} to ${qty}.`);
    loadProduct(true);
  };

  // 2. Open Edit Dates Dialog (Re-fetches batch first)
  const openEditDates = async (batch: Batch) => {
    setActionSuccess(null);
    setActionError(null);
    setDatesModalError(null);
    setDatesStep('input');
    setActiveBatch(batch);
    setPurchaseDateInput(batch.purchase_date);
    setExpirationDateInput(batch.expiration_date);
    setDatesModalVisible(true);
    setFetchingBatch(true);

    const fresh = await getBatch(batch.id);
    setFetchingBatch(false);
    if (fresh.kind === 'success') {
      setActiveBatch(fresh.batch);
      setPurchaseDateInput(fresh.batch.purchase_date);
      setExpirationDateInput(fresh.batch.expiration_date);
    }
  };

  const handleDatesInputSubmit = () => {
    setDatesModalError(null);
    const pDate = purchaseDateInput.trim();
    const eDate = expirationDateInput.trim();

    if (!isValidCalendarDate(pDate)) {
      setDatesModalError('Purchase date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }
    if (!isValidCalendarDate(eDate)) {
      setDatesModalError('Expiration date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }
    if (eDate < pDate) {
      setDatesModalError('Expiration date cannot be earlier than purchase date');
      return;
    }

    setDatesStep('confirm');
  };

  const handleConfirmDateUpdate = async () => {
    if (!activeBatch) return;
    setSaving(true);
    setDatesModalError(null);

    const pDate = purchaseDateInput.trim();
    const eDate = expirationDateInput.trim();

    const res = await updateBatchDates(activeBatch.id, pDate, eDate);
    setSaving(false);

    if (res.kind === 'db_error') {
      setDatesModalError(res.message);
      setDatesStep('input');
      return;
    }

    if (res.kind === 'network_timeout') {
      setDatesModalVisible(false);
      setActionError(res.message);
      loadProduct(true);
      return;
    }

    // Success
    setDatesModalVisible(false);
    setActionSuccess('Batch dates updated successfully.');
    loadProduct(true);
  };

  // 3. Delete Batch
  const openDeleteBatch = (batch: Batch) => {
    setActionSuccess(null);
    setActionError(null);
    setActiveBatch(batch);
    setDeleteBatchModalVisible(true);
  };

  const handleConfirmDeleteBatch = async () => {
    if (!activeBatch) return;
    setSaving(true);
    const res = await removeBatch(activeBatch.id);
    setSaving(false);
    setDeleteBatchModalVisible(false);

    if (res.kind === 'db_error') {
      setActionError(res.message);
      return;
    }

    if (res.kind === 'network_timeout') {
      setActionError(res.message);
      loadProduct(true);
      return;
    }

    const actionText = res.data.status === 'deleted' ? 'Deleted' : 'Archived';
    setActionSuccess(`Batch ${actionText}.`);
    loadProduct(true);
  };

  // 4. Delete Product
  const handleConfirmDeleteProduct = async () => {
    if (!product) return;
    setSaving(true);
    const res = await removeProduct(product.id);
    setSaving(false);
    setDeleteProductModalVisible(false);

    if (res.kind === 'db_error') {
      setActionError(res.message);
      return;
    }

    if (res.kind === 'network_timeout') {
      setActionError(res.message);
      loadProduct(true);
      return;
    }

    const actionText = res.data.status === 'deleted' ? 'Deleted' : 'Archived';
    setActionSuccess(`Product ${actionText}.`);
    // Navigate back to Inventory
    setTimeout(() => {
      navigation.navigate('InventoryList');
    }, 600);
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

  // If product not found (deleted, archived, or other user's)
  if (productNotFound && !loading) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#555', textAlign: 'center' }}>
          This product no longer exists
        </Text>
        <Text style={{ color: 'gray', marginTop: 8, textAlign: 'center' }}>
          It may have been deleted, archived, or removed.
        </Text>
        <View style={{ marginTop: 20 }}>
          <Button title="← Back to Inventory" onPress={() => navigation.goBack()} />
        </View>
      </View>
    );
  }

  // Sort batches earliest expiry first
  const sortedBatches = (product?.batches || []).slice().sort((a, b) => {
    return a.expiration_date.localeCompare(b.expiration_date);
  });

  if (settingsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={{ marginTop: 12, color: 'gray' }}>Loading store settings...</Text>
      </View>
    );
  }

  if (settingsError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d9534f', textAlign: 'center' }}>
          Failed to load store settings
        </Text>
        <Text style={{ color: 'gray', marginTop: 8, textAlign: 'center' }}>
          {settingsError}
        </Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Retry" onPress={reloadSettings} color="#2e7d32" />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, padding: 16 }}
      refreshControl={
        <RefreshControlComponent refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Button
        title="← Back to Inventory"
        onPress={() => navigation.goBack()}
        disabled={saving}
      />

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

      {/* Success Banner */}
      {actionSuccess ? (
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
            {actionSuccess}
          </Text>
        </View>
      ) : null}

      {/* Action Error Banner */}
      {actionError ? (
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
            {actionError}
          </Text>
        </View>
      ) : null}

      {/* Fetch Error state */}
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
              disabled={saving}
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
              {!product.is_archived && (
                <Button
                  title="Edit"
                  disabled={saving}
                  onPress={() =>
                    navigation.navigate('EditProduct', { productId: product.id })
                  }
                />
              )}
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
          <View style={{ marginTop: 24, marginBottom: 20 }}>
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
                const today = getTodayInManila();
                const batchStatus = getBatchStatus(
                  batch.expiration_date,
                  batch.quantity_left,
                  today,
                  near_expiry_days
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

                    {/* Batch Actions: hidden when product is archived */}
                    {!product.is_archived && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                        <Button
                          title="Correct quantity"
                          disabled={saving}
                          onPress={() => openCorrectQuantity(batch)}
                        />
                        <Button
                          title="Edit dates"
                          disabled={saving}
                          onPress={() => openEditDates(batch)}
                        />
                        <Button
                          title="Delete"
                          disabled={saving}
                          onPress={() => openDeleteBatch(batch)}
                          color="#d9534f"
                        />
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Delete Product Zone: hidden when archived */}
          {!product.is_archived && (
            <View
              style={{
                marginTop: 20,
                marginBottom: 40,
                padding: 16,
                borderWidth: 1,
                borderColor: '#ccc',
                backgroundColor: '#fff',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333' }}>
                Remove Product
              </Text>
              <Text style={{ color: 'gray', marginTop: 4, marginBottom: 12 }}>
                Delete or archive this entire product and its inventory
              </Text>
              <Button
                title={saving ? 'Processing...' : 'Delete Product'}
                disabled={saving}
                onPress={() => setDeleteProductModalVisible(true)}
                color="#d9534f"
              />
            </View>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* 1. CORRECT QUANTITY MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={qtyModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setQtyModalVisible(false);
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
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Correct Quantity</Text>
            <Text style={{ color: 'gray', marginTop: 4, fontSize: 13 }}>
              Use this when the real count on the shelf is different.
            </Text>

            {fetchingBatch && (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#2e7d32" />
                <Text style={{ fontSize: 12, color: 'gray', marginTop: 4 }}>
                  Fetching current batch count...
                </Text>
              </View>
            )}

            {qtyModalError && (
              <View
                style={{
                  marginTop: 10,
                  padding: 8,
                  borderWidth: 1,
                  borderColor: '#d9534f',
                  backgroundColor: '#fdf7f7',
                }}
              >
                <Text style={{ color: '#d9534f', fontSize: 13 }}>{qtyModalError}</Text>
              </View>
            )}

            {!fetchingBatch && activeBatch && qtyStep === 'input' && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontWeight: '500' }}>
                  Current count: <Text style={{ fontWeight: 'bold' }}>{activeBatch.quantity_left}</Text>
                </Text>
                <Text style={{ fontWeight: 'bold', marginTop: 10 }}>New Quantity (0 - 100,000)</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 8,
                    marginTop: 4,
                    backgroundColor: '#fff',
                  }}
                  keyboardType="numeric"
                  value={newQtyInput}
                  onChangeText={(text) => {
                    setNewQtyInput(text);
                    if (qtyModalError) setQtyModalError(null);
                  }}
                  editable={!saving}
                  placeholder="0"
                />

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <Button
                    title="Cancel"
                    onPress={() => setQtyModalVisible(false)}
                    disabled={saving}
                    color="gray"
                  />
                  <Button
                    title="Next"
                    onPress={handleQtyInputSubmit}
                    disabled={saving}
                    color="#2e7d32"
                  />
                </View>
              </View>
            )}

            {!fetchingBatch && activeBatch && qtyStep === 'confirm' && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold' }}>Confirm change?</Text>
                <Text style={{ marginTop: 8, fontSize: 14 }}>
                  Change batch quantity from{' '}
                  <Text style={{ fontWeight: 'bold' }}>{activeBatch.quantity_left}</Text> to{' '}
                  <Text style={{ fontWeight: 'bold', color: '#2e7d32' }}>{newQtyInput.trim()}</Text>?
                </Text>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <Button
                    title="Back"
                    onPress={() => setQtyStep('input')}
                    disabled={saving}
                    color="gray"
                  />
                  <Button
                    title={saving ? 'Saving...' : 'Yes, Correct'}
                    onPress={handleConfirmQuantityCorrection}
                    disabled={saving}
                    color="#2e7d32"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 2. EDIT DATES MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={datesModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setDatesModalVisible(false);
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
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Edit Batch Dates</Text>
            <Text style={{ color: 'gray', marginTop: 4, fontSize: 13 }}>
              Update purchase and expiration dates
            </Text>

            {fetchingBatch && (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#2e7d32" />
                <Text style={{ fontSize: 12, color: 'gray', marginTop: 4 }}>
                  Fetching current batch dates...
                </Text>
              </View>
            )}

            {datesModalError && (
              <View
                style={{
                  marginTop: 10,
                  padding: 8,
                  borderWidth: 1,
                  borderColor: '#d9534f',
                  backgroundColor: '#fdf7f7',
                }}
              >
                <Text style={{ color: '#d9534f', fontSize: 13 }}>{datesModalError}</Text>
              </View>
            )}

            {!fetchingBatch && activeBatch && datesStep === 'input' && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontWeight: 'bold' }}>Purchase Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 8,
                    marginTop: 4,
                    backgroundColor: '#fff',
                  }}
                  value={purchaseDateInput}
                  onChangeText={(text) => {
                    setPurchaseDateInput(text);
                    if (datesModalError) setDatesModalError(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  editable={!saving}
                />

                <Text style={{ fontWeight: 'bold', marginTop: 10 }}>Expiration Date (YYYY-MM-DD)</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: '#ccc',
                    padding: 8,
                    marginTop: 4,
                    backgroundColor: '#fff',
                  }}
                  value={expirationDateInput}
                  onChangeText={(text) => {
                    setExpirationDateInput(text);
                    if (datesModalError) setDatesModalError(null);
                  }}
                  placeholder="YYYY-MM-DD"
                  editable={!saving}
                />

                {/* Warning if expiry is in past */}
                {isValidCalendarDate(expirationDateInput.trim()) &&
                  isDateInPast(expirationDateInput.trim()) && (
                    <View
                      style={{
                        marginTop: 8,
                        padding: 6,
                        borderWidth: 1,
                        borderColor: '#f0ad4e',
                        backgroundColor: '#fffcf5',
                      }}
                    >
                      <Text style={{ color: '#8a6d3b', fontSize: 12 }}>
                        Warning: This expiration date is in the past. Stock in this batch will be marked as expired.
                      </Text>
                    </View>
                  )}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <Button
                    title="Cancel"
                    onPress={() => setDatesModalVisible(false)}
                    disabled={saving}
                    color="gray"
                  />
                  <Button
                    title="Next"
                    onPress={handleDatesInputSubmit}
                    disabled={saving}
                    color="#2e7d32"
                  />
                </View>
              </View>
            )}

            {!fetchingBatch && activeBatch && datesStep === 'confirm' && (
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold' }}>Confirm Date Changes?</Text>

                <View style={{ marginTop: 8, padding: 8, backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#eee' }}>
                  <Text style={{ fontSize: 13 }}>
                    • Purchase Date: {activeBatch.purchase_date} →{' '}
                    <Text style={{ fontWeight: 'bold' }}>{purchaseDateInput.trim()}</Text>
                  </Text>
                  <Text style={{ fontSize: 13, marginTop: 4 }}>
                    • Expiration Date: {activeBatch.expiration_date} →{' '}
                    <Text style={{ fontWeight: 'bold' }}>{expirationDateInput.trim()}</Text>
                  </Text>
                </View>

                {isDateInPast(expirationDateInput.trim()) && (
                  <Text style={{ color: '#8a6d3b', fontSize: 12, marginTop: 6 }}>
                    Note: Batch will be marked as expired.
                  </Text>
                )}

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                  <Button
                    title="Back"
                    onPress={() => setDatesStep('input')}
                    disabled={saving}
                    color="gray"
                  />
                  <Button
                    title={saving ? 'Saving...' : 'Yes, Update'}
                    onPress={handleConfirmDateUpdate}
                    disabled={saving}
                    color="#2e7d32"
                  />
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 3. DELETE BATCH MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={deleteBatchModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setDeleteBatchModalVisible(false);
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
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d9534f' }}>Delete Batch?</Text>
            <Text style={{ color: '#333', marginTop: 10, fontSize: 14 }}>
              If this batch was never used it will be deleted. If it already has sales history it will be archived instead, so past stock changes can still be traced.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button
                title="Cancel"
                onPress={() => setDeleteBatchModalVisible(false)}
                disabled={saving}
                color="gray"
              />
              <Button
                title={saving ? 'Processing...' : 'Confirm'}
                onPress={handleConfirmDeleteBatch}
                disabled={saving}
                color="#d9534f"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* 4. DELETE PRODUCT MODAL */}
      {/* ========================================================================= */}
      <Modal
        visible={deleteProductModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!saving) setDeleteProductModalVisible(false);
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
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#d9534f' }}>Delete Product?</Text>
            <Text style={{ color: '#333', marginTop: 10, fontSize: 14 }}>
              If this product was never used it will be deleted. If it already has sales history it will be archived instead, so past stock changes can still be traced.
            </Text>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <Button
                title="Cancel"
                onPress={() => setDeleteProductModalVisible(false)}
                disabled={saving}
                color="gray"
              />
              <Button
                title={saving ? 'Deleting...' : 'Confirm'}
                onPress={handleConfirmDeleteProduct}
                disabled={saving}
                color="#d9534f"
              />
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
