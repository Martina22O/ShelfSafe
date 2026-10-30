/**
 * Screen: SaleDoneScreen
 * Displays summary of recorded items with multi-scan batch undo capability.
 */
import React, { useState } from 'react';
import { View, Text, Button, ScrollView, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { undoSale } from '../../services/inventory';

type Props = NativeStackScreenProps<ScanStackParamList, 'SaleDone'>;

interface UndoStatus {
  scanId: string;
  name?: string;
  quantity?: number;
  success: boolean;
  error?: string;
}

export default function SaleDoneScreen({ route, navigation }: Props) {
  const count = route.params?.count || 0;
  const scanIds = route.params?.scanIds || [];
  const items = route.params?.items || [];

  const [undone, setUndone] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoResults, setUndoResults] = useState<UndoStatus[] | null>(null);

  const handleExecuteUndo = async () => {
    setUndoing(true);
    setConfirmingUndo(false);

    const results: UndoStatus[] = [];
    let hasFailures = false;

    for (let i = 0; i < scanIds.length; i++) {
      const scanId = scanIds[i];
      const matchingItem = items[i];
      const res = await undoSale(scanId);

      if (res.kind === 'success' || res.isAlreadyUndone) {
        results.push({
          scanId,
          name: matchingItem?.name,
          quantity: matchingItem?.quantity,
          success: true,
        });
      } else {
        hasFailures = true;
        results.push({
          scanId,
          name: matchingItem?.name,
          quantity: matchingItem?.quantity,
          success: false,
          error: res.message,
        });
      }
    }

    setUndoing(false);
    setUndoResults(results);

    if (!hasFailures) {
      setUndone(true);
    }
  };

  return (
    <ScrollView style={{ flex: 1, padding: 24 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sale Recorded</Text>
      <Text style={{ fontSize: 20, color: 'green', marginTop: 8 }}>
        {count} {count === 1 ? 'item' : 'items'} recorded
      </Text>

      {/* Item Summary List */}
      {items.length > 0 && (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#ccc',
            padding: 12,
            marginTop: 16,
            backgroundColor: '#fff',
          }}
        >
          <Text style={{ fontWeight: 'bold', marginBottom: 6 }}>
            Recorded items:
          </Text>
          {items.map((item, idx) => (
            <Text key={idx} style={{ marginTop: 2, color: '#333' }}>
              • {item.name} - {item.quantity}{' '}
              {item.quantity === 1 ? 'unit' : 'units'}
            </Text>
          ))}
        </View>
      )}

      {/* Undone state banner */}
      {undone && (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#4caf50',
            backgroundColor: '#e8f5e9',
            padding: 14,
            marginTop: 16,
          }}
        >
          <Text style={{ color: '#2e7d32', fontWeight: 'bold', fontSize: 16 }}>
            Sale undone
          </Text>
          <Text style={{ color: '#333', marginTop: 4 }}>
            Units were restored back into their original batches.
          </Text>
        </View>
      )}

      {/* Partial Undo Results Report (if some failed) */}
      {undoResults && !undone && (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#d9534f',
            backgroundColor: '#fdf7f7',
            padding: 12,
            marginTop: 16,
          }}
        >
          <Text style={{ fontWeight: 'bold', color: '#721c24' }}>
            Undo Results:
          </Text>
          {undoResults.map((r, idx) => (
            <Text
              key={idx}
              style={{
                marginTop: 4,
                color: r.success ? 'green' : '#721c24',
              }}
            >
              • {r.name || 'Item'} ({r.quantity || 1} units):{' '}
              {r.success ? 'Undone successfully' : `Failed: ${r.error}`}
            </Text>
          ))}
        </View>
      )}

      {/* Undo Confirmation Box */}
      {confirmingUndo && !undone && (
        <View
          style={{
            borderWidth: 1,
            borderColor: '#d9534f',
            padding: 14,
            marginTop: 16,
            backgroundColor: '#fff3cd',
          }}
        >
          <Text style={{ fontWeight: 'bold', color: '#721c24', fontSize: 15 }}>
            Put {count} {count === 1 ? 'unit' : 'units'} back into the same batches?
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <Button
              title="Yes, undo"
              onPress={handleExecuteUndo}
              color="#d9534f"
            />
            <Button
              title="Cancel"
              onPress={() => setConfirmingUndo(false)}
              color="gray"
            />
          </View>
        </View>
      )}

      {/* Undoing Progress */}
      {undoing && (
        <View style={{ marginTop: 16, alignItems: 'center' }}>
          <ActivityIndicator size="small" color="#d9534f" />
          <Text style={{ color: 'gray', marginTop: 6 }}>
            Restoring units back to batches...
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={{ marginTop: 32, gap: 12, marginBottom: 40 }}>
        {!undone && !confirmingUndo && !undoing && scanIds.length > 0 && (
          <Button
            title="Undo"
            onPress={() => setConfirmingUndo(true)}
            color="#d9534f"
          />
        )}

        <Button
          title="Scan more"
          onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
        />

        <Button
          title="View history"
          onPress={() => navigation.navigate('History')}
          color="gray"
        />
      </View>
    </ScrollView>
  );
}
