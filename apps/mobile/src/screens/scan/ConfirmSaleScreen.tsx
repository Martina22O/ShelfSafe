/**
 * Screen: ConfirmSaleScreen
 * Previews FEFO batch deductions and commits sale atomically item-by-item.
 * Handles partial failures and unclear network timeouts safely.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { useSaleCart } from '../../context/SaleCartContext';
import { previewSale, recordSale, undoSale } from '../../services/inventory';
import { PreviewSaleBatchDeduction } from '../../types/inventory';
import { formatDisplayDate } from '../../utils/date';

type Props = NativeStackScreenProps<ScanStackParamList, 'ConfirmSale'>;

interface PreviewMap {
  [productId: string]: PreviewSaleBatchDeduction[];
}

interface RecordedItem {
  productId: string;
  name: string;
  quantity: number;
  scanId: string;
}

interface FailedItem {
  productId: string;
  name: string;
  quantity: number;
  error: string;
}

export default function ConfirmSaleScreen({ navigation }: Props) {
  const { items, removeItem, clearCart } = useSaleCart();

  const [loadingPreviews, setLoadingPreviews] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deductionsMap, setDeductionsMap] = useState<PreviewMap>({});

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState<string>('');

  // Partial failure & unclear timeout states
  const [partialFailure, setPartialFailure] = useState<{
    recorded: RecordedItem[];
    failed: FailedItem[];
  } | null>(null);

  const [unknownFailure, setUnknownFailure] = useState<{
    recorded: RecordedItem[];
    unknownItem: { productId: string; name: string; quantity: number; error: string };
  } | null>(null);

  const [undoingRecorded, setUndoingRecorded] = useState(false);
  const [undoneSuccessMessage, setUndoneSuccessMessage] = useState<string | null>(null);

  // 1. Load previews on mount
  const loadPreviews = useCallback(async () => {
    if (items.length === 0) {
      setLoadingPreviews(false);
      return;
    }

    setLoadingPreviews(true);
    setPreviewError(null);

    const map: PreviewMap = {};

    for (const item of items) {
      const res = await previewSale(item.productId, item.quantity);
      if (res.kind === 'error') {
        setPreviewError(
          `Error previewing ${item.name}: ${res.message}`
        );
        setLoadingPreviews(false);
        return;
      }
      map[item.productId] = res.deductions;
    }

    setDeductionsMap(map);
    setLoadingPreviews(false);
  }, [items]);

  useEffect(() => {
    loadPreviews();
  }, [loadPreviews]);

  // 2. Block back navigation and hardware back button while saving
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isSaving) {
          return true; // Block hardware back
        }
        return false;
      }
    );

    const removeListener = navigation.addListener('beforeRemove', (e) => {
      if (isSaving) {
        e.preventDefault(); // Block gesture and header back
      }
    });

    return () => {
      backSubscription.remove();
      removeListener();
    };
  }, [isSaving, navigation]);

  // 3. Confirm sale execution
  const handleConfirmSale = async () => {
    if (isSaving || items.length === 0) return;

    setIsSaving(true);
    setPartialFailure(null);
    setUnknownFailure(null);

    const recorded: RecordedItem[] = [];
    const failed: FailedItem[] = [];
    let unknownItem: { productId: string; name: string; quantity: number; error: string } | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setSavingProgress(`Recording ${item.name} (${i + 1} of ${items.length})...`);

      const res = await recordSale(item.productId, item.quantity);

      if (res.kind === 'success') {
        recorded.push({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          scanId: res.salesScanId,
        });
        // Remove item from cart so it cannot be double-recorded
        removeItem(item.productId);
      } else if (res.kind === 'db_error') {
        // Clear database failure (e.g. stock changed concurrently)
        failed.push({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          error: res.message,
        });

        // Any remaining items were not attempted
        for (let j = i + 1; j < items.length; j++) {
          failed.push({
            productId: items[j].productId,
            name: items[j].name,
            quantity: items[j].quantity,
            error: 'Not processed due to previous item failure',
          });
        }
        break;
      } else {
        // Unknown network error / timeout
        unknownItem = {
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          error: res.message,
        };
        // Remove from cart to block immediate unverified retry
        removeItem(item.productId);
        break;
      }
    }

    setIsSaving(false);
    setSavingProgress('');

    // Handle Unclear Failure
    if (unknownItem) {
      setUnknownFailure({
        recorded,
        unknownItem,
      });
      return;
    }

    // Handle Partial Failure
    if (failed.length > 0) {
      setPartialFailure({
        recorded,
        failed,
      });
      return;
    }

    // Full Success: Reset navigation to SaleDone so Back cannot return here
    const totalCount = recorded.reduce((sum, r) => sum + r.quantity, 0);
    clearCart();

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'SaleDone',
          params: {
            count: totalCount,
            scanIds: recorded.map((r) => r.scanId),
            items: recorded.map((r) => ({
              productId: r.productId,
              name: r.name,
              quantity: r.quantity,
            })),
          },
        },
      ],
    });
  };

  // Undo recorded items in case of partial or unknown failure
  const handleUndoRecorded = async (recordedList: RecordedItem[]) => {
    setUndoingRecorded(true);
    setUndoneSuccessMessage(null);

    let allUndone = true;
    for (const r of recordedList) {
      const res = await undoSale(r.scanId);
      if (res.kind === 'error' && !res.isAlreadyUndone) {
        allUndone = false;
      }
    }

    setUndoingRecorded(false);
    if (allUndone) {
      setUndoneSuccessMessage(
        'Recorded items were successfully undone and restored to original batches.'
      );
    } else {
      setUndoneSuccessMessage(
        'Some items could not be undone. Please verify in History.'
      );
    }
  };

  // --- UNKNOWN FAILURE VIEW (Network / Timeout error) ---
  if (unknownFailure) {
    return (
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#856404' }}>
          Network Uncertainty
        </Text>
        <View
          style={{
            marginTop: 12,
            padding: 16,
            borderWidth: 1,
            borderColor: '#ffeeba',
            backgroundColor: '#fff3cd',
          }}
        >
          <Text style={{ fontWeight: 'bold', color: '#856404', fontSize: 16 }}>
            Not sure if this was recorded. Check History before trying again
          </Text>
          <Text style={{ marginTop: 8, color: '#333' }}>
            A network timeout occurred while attempting to record:
          </Text>
          <Text style={{ fontWeight: 'bold', marginTop: 4 }}>
            • {unknownFailure.unknownItem.name} ({unknownFailure.unknownItem.quantity} units)
          </Text>
          <Text style={{ color: 'gray', fontSize: 12, marginTop: 4 }}>
            Error details: {unknownFailure.unknownItem.error}
          </Text>
        </View>

        {/* Previously recorded items in this batch */}
        {unknownFailure.recorded.length > 0 && (
          <View style={{ marginTop: 16, padding: 12, borderWidth: 1, borderColor: '#ccc' }}>
            <Text style={{ fontWeight: 'bold' }}>Items recorded before timeout:</Text>
            {unknownFailure.recorded.map((r) => (
              <Text key={r.scanId} style={{ marginTop: 4 }}>
                • {r.name} ({r.quantity} units) [Scan ID: {r.scanId.slice(0, 8).toUpperCase()}]
              </Text>
            ))}

            {undoneSuccessMessage ? (
              <Text style={{ color: 'green', marginTop: 8, fontWeight: 'bold' }}>
                {undoneSuccessMessage}
              </Text>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Button
                  title={undoingRecorded ? 'Undoing...' : 'Undo recorded items'}
                  onPress={() => handleUndoRecorded(unknownFailure.recorded)}
                  disabled={undoingRecorded}
                  color="#d9534f"
                />
              </View>
            )}
          </View>
        )}

        <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
          <Button
            title="Open History"
            onPress={() => navigation.navigate('History')}
          />
          <Button
            title="Go to Cart"
            onPress={() => navigation.navigate('SaleList')}
            color="gray"
          />
        </View>
      </ScrollView>
    );
  }

  // --- PARTIAL FAILURE VIEW (Database error midway) ---
  if (partialFailure) {
    return (
      <ScrollView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#721c24' }}>
          Sale Stopped
        </Text>
        <Text style={{ color: 'gray', marginTop: 4 }}>
          One of the items failed to record. Sale execution was halted.
        </Text>

        {/* Failed Items */}
        <View
          style={{
            marginTop: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: '#f5c6cb',
            backgroundColor: '#f8d7da',
          }}
        >
          <Text style={{ fontWeight: 'bold', color: '#721c24' }}>Failed items:</Text>
          {partialFailure.failed.map((f) => (
            <View key={f.productId} style={{ marginTop: 6 }}>
              <Text style={{ fontWeight: 'bold' }}>
                • {f.name} ({f.quantity} units)
              </Text>
              <Text style={{ color: '#721c24', fontSize: 13 }}>
                Reason: {f.error}
              </Text>
            </View>
          ))}
        </View>

        {/* Recorded Items */}
        {partialFailure.recorded.length > 0 && (
          <View style={{ marginTop: 16, padding: 12, borderWidth: 1, borderColor: '#ccc' }}>
            <Text style={{ fontWeight: 'bold' }}>Items recorded before failure:</Text>
            {partialFailure.recorded.map((r) => (
              <Text key={r.scanId} style={{ marginTop: 4 }}>
                • {r.name} ({r.quantity} units) [Scan ID: {r.scanId.slice(0, 8).toUpperCase()}]
              </Text>
            ))}

            {undoneSuccessMessage ? (
              <Text style={{ color: 'green', marginTop: 8, fontWeight: 'bold' }}>
                {undoneSuccessMessage}
              </Text>
            ) : (
              <View style={{ marginTop: 12 }}>
                <Button
                  title={undoingRecorded ? 'Undoing...' : 'Undo recorded items'}
                  onPress={() => handleUndoRecorded(partialFailure.recorded)}
                  disabled={undoingRecorded}
                  color="#d9534f"
                />
              </View>
            )}
          </View>
        )}

        <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
          <Button
            title="Return to Cart to Fix"
            onPress={() => navigation.navigate('SaleList')}
          />
          <Button
            title="View History"
            onPress={() => navigation.navigate('History')}
            color="gray"
          />
        </View>
      </ScrollView>
    );
  }

  // --- NORMAL CONFIRM VIEW ---
  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Confirm Sale</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Review batch deduction plan before recording
      </Text>

      {/* Loading state indicator */}
      {loadingPreviews && (
        <View style={{ marginTop: 32, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 8, color: 'gray' }}>
            Calculating FEFO deductions...
          </Text>
        </View>
      )}

      {/* Preview Error banner */}
      {previewError && (
        <View
          style={{
            marginTop: 16,
            padding: 12,
            borderWidth: 1,
            borderColor: '#d9534f',
            backgroundColor: '#fdf7f7',
          }}
        >
          <Text style={{ color: '#d9534f', fontWeight: 'bold' }}>
            Cannot complete sale preview
          </Text>
          <Text style={{ color: '#333', marginTop: 4 }}>{previewError}</Text>
          <View style={{ marginTop: 12, gap: 8 }}>
            <Button
              title="Return to cart and adjust quantity"
              onPress={() => navigation.goBack()}
            />
            <Button
              title="Retry preview"
              onPress={loadPreviews}
              color="gray"
            />
          </View>
        </View>
      )}

      {/* Saving in progress banner */}
      {isSaving && (
        <View
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: '#e8f5e9',
            borderWidth: 1,
            borderColor: '#a5d6a7',
            alignItems: 'center',
          }}
        >
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 8, fontWeight: 'bold', color: '#1b5e20' }}>
            {savingProgress || 'Recording sale...'}
          </Text>
          <Text style={{ color: '#555', fontSize: 12, marginTop: 2 }}>
            Please wait. Do not close or exit the app.
          </Text>
        </View>
      )}

      {/* Deduction Plan for Cart Items */}
      {!loadingPreviews && !previewError && (
        <View style={{ marginTop: 16, gap: 12 }}>
          {items.map((item) => {
            const deductions = deductionsMap[item.productId] || [];
            return (
              <View
                key={item.productId}
                style={{
                  borderWidth: 1,
                  borderColor: '#ccc',
                  padding: 12,
                  backgroundColor: '#fff',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                  {item.name}
                </Text>
                <Text style={{ color: 'gray', marginTop: 2 }}>
                  Quantity to sell: {item.quantity}{' '}
                  {item.quantity === 1 ? 'unit' : 'units'} (₱
                  {(item.price * item.quantity).toFixed(2)})
                </Text>

                <View
                  style={{
                    marginTop: 8,
                    paddingLeft: 8,
                    borderLeftWidth: 2,
                    borderColor: '#4caf50',
                  }}
                >
                  <Text style={{ fontWeight: 'bold', fontSize: 13 }}>
                    Batches to be deducted (FEFO):
                  </Text>
                  {deductions.length === 0 ? (
                    <Text style={{ color: 'gray', fontStyle: 'italic', marginTop: 2 }}>
                      No batches calculated
                    </Text>
                  ) : (
                    deductions.map((d) => {
                      const code = `B - ${d.batch_id
                        .replace(/-/g, '')
                        .slice(0, 8)
                        .toUpperCase()}`;
                      return (
                        <Text key={d.batch_id} style={{ marginTop: 2, fontSize: 13 }}>
                          • Batch {code} (Exp: {formatDisplayDate(d.expiration_date)}) -{' '}
                          {d.quantity_to_deduct} {d.quantity_to_deduct === 1 ? 'unit' : 'units'}
                        </Text>
                      );
                    })
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Rules & Notes */}
      <View
        style={{
          marginTop: 20,
          padding: 12,
          backgroundColor: '#f0f0f0',
          borderWidth: 1,
          borderColor: '#e0e0e0',
        }}
      >
        <Text style={{ fontStyle: 'italic', color: '#555' }}>
          Note: Expired units are skipped
        </Text>
        <Text style={{ fontStyle: 'italic', color: '#555', marginTop: 4 }}>
          Note: This updates stock only. No payment is processed.
        </Text>
      </View>

      {/* Actions */}
      <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
        <Button
          title={isSaving ? 'Recording sale...' : 'Confirm sale'}
          onPress={handleConfirmSale}
          disabled={isSaving || loadingPreviews || Boolean(previewError) || items.length === 0}
        />
        <Button
          title="Back to Cart"
          onPress={() => navigation.goBack()}
          disabled={isSaving}
          color="gray"
        />
      </View>
    </ScrollView>
  );
}
