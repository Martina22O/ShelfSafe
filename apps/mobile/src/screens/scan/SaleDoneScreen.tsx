/**
 * Screen: SaleDoneScreen
 * Elements:
 * - Screen Name: Sale Recorded
 * - Confirmation ("N items recorded")
 * - "Undo" button (with confirmation)
 * - "Scan more" button
 * - "View history" button
 */
import React, { useState } from 'react';
import { View, Text, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'SaleDone'>;

export default function SaleDoneScreen({ route, navigation }: Props) {
  const count = route.params?.count || 3;
  const [undone, setUndone] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);

  const handleConfirmUndo = () => {
    setUndone(true);
    setConfirmingUndo(false);
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Sale Recorded</Text>
      <Text style={{ fontSize: 20, color: 'green', marginTop: 12 }}>
        {count} items recorded
      </Text>

      {undone ? (
        <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 16 }}>
          <Text style={{ color: 'orange', fontWeight: 'bold' }}>
            Sale was undone. Units restored to original batches.
          </Text>
        </View>
      ) : null}

      {confirmingUndo && !undone ? (
        <View style={{ borderWidth: 1, borderColor: '#d9534f', padding: 12, marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold', color: '#721c24' }}>
            Put {count} units back into the same batches?
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button title="Yes, undo" onPress={handleConfirmUndo} color="#d9534f" />
            <Button
              title="Cancel"
              onPress={() => setConfirmingUndo(false)}
              color="gray"
            />
          </View>
        </View>
      ) : null}

      <View style={{ marginTop: 32, gap: 12 }}>
        {!undone && !confirmingUndo ? (
          <Button
            title="Undo"
            onPress={() => setConfirmingUndo(true)}
            color="#d9534f"
          />
        ) : null}

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
    </View>
  );
}
