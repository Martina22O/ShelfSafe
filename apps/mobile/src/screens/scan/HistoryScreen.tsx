/**
 * Screen: HistoryScreen
 * Displays sales history deductions using get_sale_history RPC with real-time undo.
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
import { useFocusEffect } from '@react-navigation/native';
import { getSaleHistory, undoSale } from '../../services/inventory';
import { SaleHistoryRecord } from '../../types/inventory';
import { formatManilaDateTime } from '../../utils/date';

const RefreshControlComponent = RefreshControl as any;

export default function HistoryScreen() {
  const [sales, setSales] = useState<SaleHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Undo confirmation state
  const [confirmingSaleId, setConfirmingSaleId] = useState<string | null>(null);
  const [undoingSaleId, setUndoingSaleId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadHistory = async (isMounted = true) => {
    setError(null);
    const res = await getSaleHistory(50);

    if (!isMounted) return;

    if (res.kind === 'error') {
      setError(res.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setSales(res.history);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      loadHistory(isMounted);
      return () => {
        isMounted = false;
      };
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    setActionMessage(null);
    loadHistory(true);
  };

  const handleExecuteUndo = async (sale: SaleHistoryRecord) => {
    setUndoingSaleId(sale.sales_scan_id);
    setActionMessage(null);

    const res = await undoSale(sale.sales_scan_id);

    setUndoingSaleId(null);
    setConfirmingSaleId(null);

    if (res.kind === 'error') {
      if (res.isAlreadyUndone) {
        setActionMessage('This sale has already been undone.');
      } else {
        setActionMessage(`Undo failed: ${res.message}`);
      }
      loadHistory(true);
      return;
    }

    setActionMessage(
      `Sale for ${sale.product_name || 'item'} undone. Units restored to batches.`
    );
    loadHistory(true);
  };

  return (
    <ScrollView
      style={{ flex: 1, padding: 16 }}
      refreshControl={
        <RefreshControlComponent refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sales History</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Deductions made from sold-item scans
      </Text>

      {/* Global Action Banner (success / already undone notification) */}
      {actionMessage && (
        <View
          style={{
            marginTop: 12,
            padding: 10,
            backgroundColor: '#e8f4fd',
            borderWidth: 1,
            borderColor: '#b8daff',
          }}
        >
          <Text style={{ color: '#004085', fontWeight: 'bold' }}>
            {actionMessage}
          </Text>
        </View>
      )}

      {/* Loading state indicator */}
      {loading && !refreshing && (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#2e7d32" />
          <Text style={{ marginTop: 8, color: 'gray' }}>
            Loading sales history...
          </Text>
        </View>
      )}

      {/* Error state banner */}
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
            Unable to load sales history
          </Text>
          <Text style={{ color: '#333', marginTop: 4 }}>{error}</Text>
          <View style={{ marginTop: 12 }}>
            <Button
              title="Retry"
              onPress={() => {
                setLoading(true);
                loadHistory(true);
              }}
            />
          </View>
        </View>
      )}

      {/* Sales List or Empty State */}
      {!loading && !error && (
        <View style={{ marginTop: 16, marginBottom: 40 }}>
          {sales.length === 0 ? (
            <View style={{ marginTop: 32, padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#555' }}>
                No sales yet
              </Text>
              <Text style={{ color: 'gray', marginTop: 4, textAlign: 'center' }}>
                Sales recorded using the Scan tab will appear here.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {sales.map((sale) => {
                const isConfirming = confirmingSaleId === sale.sales_scan_id;
                const isCurrentlyUndoing = undoingSaleId === sale.sales_scan_id;

                const batchesFormatted =
                  sale.batch_breakdown.length > 0
                    ? sale.batch_breakdown
                        .map(
                          (b) =>
                            `B - ${b.batch_id
                              .replace(/-/g, '')
                              .slice(0, 8)
                              .toUpperCase()} (${b.quantity} ${
                              b.quantity === 1 ? 'unit' : 'units'
                            })`
                        )
                        .join(', ')
                    : 'N/A';

                return (
                  <View
                    key={sale.sales_scan_id}
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
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                          {sale.product_name || 'Unknown Product'}
                        </Text>
                        {sale.product_barcode && (
                          <Text style={{ color: 'gray', fontSize: 12 }}>
                            Barcode: {sale.product_barcode}
                          </Text>
                        )}
                      </View>

                      {sale.is_undone ? (
                        <Text style={{ color: 'orange', fontWeight: 'bold' }}>
                          [Undone]
                        </Text>
                      ) : (
                        <Text style={{ color: 'green', fontWeight: 'bold' }}>
                          [Recorded]
                        </Text>
                      )}
                    </View>

                    <Text style={{ marginTop: 6, fontWeight: '500' }}>
                      Quantity: {sale.total_quantity}{' '}
                      {sale.total_quantity === 1 ? 'unit' : 'units'}
                      {sale.product_price > 0 &&
                        ` (₱${(sale.product_price * sale.total_quantity).toFixed(2)})`}
                    </Text>

                    <Text style={{ color: 'gray', marginTop: 2, fontSize: 13 }}>
                      Time: {formatManilaDateTime(sale.created_at)}
                    </Text>

                    <Text style={{ color: 'gray', marginTop: 2, fontSize: 13 }}>
                      Batches used: {batchesFormatted}
                    </Text>

                    {/* Inline Confirmation for Undo */}
                    {isConfirming && !sale.is_undone && (
                      <View
                        style={{
                          marginTop: 12,
                          padding: 10,
                          backgroundColor: '#fff3cd',
                          borderWidth: 1,
                          borderColor: '#ffeeba',
                        }}
                      >
                        <Text style={{ fontWeight: 'bold', color: '#856404' }}>
                          Put {sale.total_quantity}{' '}
                          {sale.total_quantity === 1 ? 'unit' : 'units'} back into the same batches?
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                          <Button
                            title={isCurrentlyUndoing ? 'Undoing...' : 'Confirm Undo'}
                            onPress={() => handleExecuteUndo(sale)}
                            disabled={isCurrentlyUndoing}
                            color="#d9534f"
                          />
                          <Button
                            title="Cancel"
                            onPress={() => setConfirmingSaleId(null)}
                            disabled={isCurrentlyUndoing}
                            color="gray"
                          />
                        </View>
                      </View>
                    )}

                    {/* Undo Trigger Button (Undone sales have no Undo button) */}
                    {!sale.is_undone && !isConfirming && (
                      <View style={{ marginTop: 10, alignItems: 'flex-start' }}>
                        <Button
                          title="Undo sale"
                          onPress={() => setConfirmingSaleId(sale.sales_scan_id)}
                          color="#d9534f"
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
