/**
 * Screen: ConfirmSaleScreen
 * Elements:
 * - Screen Name: Confirm Sale
 * - For each item: product, quantity, and batches to be deducted (batch code, expiry, units)
 * - Note ("Expired units are skipped")
 * - Note ("This updates stock only. No payment is processed.")
 * - "Confirm sale" button
 * - "Back" button
 */
import React from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'ConfirmSale'>;

export default function ConfirmSaleScreen({ navigation }: Props) {
  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Confirm Sale</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Review batch deduction plan before recording
      </Text>

      {/* Item 1 Deduction Plan */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Coca-Cola 1.5L</Text>
        <Text style={{ color: 'gray' }}>Quantity to sell: 2 units</Text>

        <View style={{ marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderColor: '#4caf50' }}>
          <Text style={{ fontWeight: 'bold' }}>Batches to be deducted (FEFO):</Text>
          <Text>• Batch B-E4718687 (Exp: Mar 30, 2027) - 2 units</Text>
        </View>
      </View>

      {/* Item 2 Deduction Plan */}
      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 12, marginTop: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Skyflakes 250g</Text>
        <Text style={{ color: 'gray' }}>Quantity to sell: 1 unit</Text>

        <View style={{ marginTop: 8, paddingLeft: 8, borderLeftWidth: 2, borderColor: '#4caf50' }}>
          <Text style={{ fontWeight: 'bold' }}>Batches to be deducted (FEFO):</Text>
          <Text>• Batch B-99739E25 (Exp: Oct 21, 2026) - 1 unit</Text>
        </View>
      </View>

      {/* Rules & Notes */}
      <View style={{ marginTop: 20, padding: 12, backgroundColor: '#f0f0f0' }}>
        <Text style={{ fontStyle: 'italic', color: '#555' }}>
          Note: Expired units are skipped
        </Text>
        <Text style={{ fontStyle: 'italic', color: '#555', marginTop: 4 }}>
          Note: This updates stock only. No payment is processed.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
        <Button
          title="Confirm sale"
          onPress={() => navigation.navigate('SaleDone', { count: 3 })}
        />
        <Button
          title="Back"
          onPress={() => navigation.goBack()}
          color="gray"
        />
      </View>
    </ScrollView>
  );
}
