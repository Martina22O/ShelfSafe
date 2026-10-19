/**
 * Screen: AddStockDoneScreen
 * Elements:
 * - Screen Name: Stock Added
 * - Confirmation ("Added X units")
 * - Batch code and expiration date display
 * - "Scan another" button
 * - "View product" button
 */
import React from 'react';
import { View, Text, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'AddStockDone'>;

export default function AddStockDoneScreen({ route, navigation }: Props) {
  const units = route.params?.units || 10;
  const batchCode = route.params?.batchCode || 'B-NEWBATCH';
  const expiryDate = route.params?.expiryDate || '2026-12-31';

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Stock Added</Text>
      <Text style={{ fontSize: 20, color: 'green', marginTop: 12 }}>
        Added {units} units
      </Text>

      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Batch code: {batchCode}</Text>
        <Text style={{ marginTop: 4, color: 'gray' }}>Expiry date: {expiryDate}</Text>
      </View>

      <View style={{ marginTop: 32, gap: 12 }}>
        <Button
          title="Scan another"
          onPress={() => navigation.navigate('ScanBarcode', { mode: 'add' })}
        />
        <Button
          title="View product"
          onPress={() => navigation.navigate('ScanChooser')}
          color="gray"
        />
      </View>
    </View>
  );
}
