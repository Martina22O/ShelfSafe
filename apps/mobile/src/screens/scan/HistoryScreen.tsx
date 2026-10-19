/**
 * Screen: HistoryScreen
 * Elements:
 * - Screen Name: Sales History
 * - List of sales (product, quantity, time, batches used, "Undone" label)
 * - Undo trigger with confirmation prompt ("Put N units back into the same batches?")
 */
import React, { useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';

interface SaleRecord {
  id: string;
  product: string;
  quantity: number;
  time: string;
  batchesUsed: string;
  isUndone: boolean;
}

export default function HistoryScreen() {
  const [sales, setSales] = useState<SaleRecord[]>([
    {
      id: 'sale-1',
      product: 'Coca-Cola 1.5L',
      quantity: 2,
      time: '10 minutes ago',
      batchesUsed: 'B-E4718687 (2 units)',
      isUndone: false,
    },
    {
      id: 'sale-2',
      product: 'Skyflakes 250g',
      quantity: 1,
      time: '25 minutes ago',
      batchesUsed: 'B-99739E25 (1 unit)',
      isUndone: true,
    },
  ]);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const confirmUndo = (id: string) => {
    setSales((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isUndone: true } : s))
    );
    setConfirmingId(null);
  };

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sales History</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Deductions made from sold-item scans
      </Text>

      <View style={{ marginTop: 16, gap: 12, marginBottom: 40 }}>
        {sales.map((sale) => (
          <View key={sale.id} style={{ borderWidth: 1, borderColor: '#ccc', padding: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{sale.product}</Text>
              {sale.isUndone ? (
                <Text style={{ color: 'orange', fontWeight: 'bold' }}>[Undone]</Text>
              ) : (
                <Text style={{ color: 'green', fontWeight: 'bold' }}>[Recorded]</Text>
              )}
            </View>

            <Text style={{ marginTop: 4 }}>Quantity: {sale.quantity} units</Text>
            <Text style={{ color: 'gray' }}>Time: {sale.time}</Text>
            <Text style={{ color: 'gray' }}>Batches used: {sale.batchesUsed}</Text>

            {confirmingId === sale.id && !sale.isUndone ? (
              <View style={{ marginTop: 12, padding: 8, backgroundColor: '#fff3cd' }}>
                <Text style={{ fontWeight: 'bold', color: '#856404' }}>
                  Put {sale.quantity} units back into the same batches?
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <Button
                    title="Confirm Undo"
                    onPress={() => confirmUndo(sale.id)}
                    color="#d9534f"
                  />
                  <Button
                    title="Cancel"
                    onPress={() => setConfirmingId(null)}
                    color="gray"
                  />
                </View>
              </View>
            ) : null}

            {!sale.isUndone && confirmingId !== sale.id ? (
              <View style={{ marginTop: 12, alignItems: 'flex-start' }}>
                <Button
                  title="Undo sale"
                  onPress={() => setConfirmingId(sale.id)}
                  color="#d9534f"
                />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
