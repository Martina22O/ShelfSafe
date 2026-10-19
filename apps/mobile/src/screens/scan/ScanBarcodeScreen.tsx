/**
 * Screen: ScanBarcodeScreen
 * Elements:
 * - Screen Name: Scan Barcode
 * - Mode parameter: mode = "add" | "sell"
 * - Camera area with a viewfinder frame (placeholder, no scanner logic)
 * - Hint text ("Align barcode within the frame to scan")
 * - "Type barcode instead" button
 * - Camera-permission-denied state placeholder ("Allow camera" / "Type barcode instead")
 * - Note: No Upload Photo (photo recognition is not included)
 * - Flow simulation buttons for placeholder navigation
 */
import React, { useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanBarcode'>;

export default function ScanBarcodeScreen({ route, navigation }: Props) {
  const { mode } = route.params;
  const [permissionDenied, setPermissionDenied] = useState(false);

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Scan Barcode</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Mode: {mode === 'add' ? 'Add Stock' : 'Record Sold Items'}
      </Text>

      {/* Camera Viewfinder Area */}
      <View
        style={{
          height: 240,
          backgroundColor: '#333',
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 16,
          borderWidth: 2,
          borderColor: '#4caf50',
        }}
      >
        <View
          style={{
            width: 180,
            height: 120,
            borderWidth: 2,
            borderColor: '#fff',
            borderStyle: 'dashed',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', textAlign: 'center' }}>
            [Camera Frame Placeholder]
          </Text>
        </View>
      </View>

      <Text style={{ textAlign: 'center', color: 'gray', marginTop: 8 }}>
        Align barcode within the frame to scan
      </Text>

      <View style={{ marginTop: 16 }}>
        <Button
          title="Type barcode instead"
          onPress={() => navigation.navigate('TypeBarcode', { mode })}
        />
      </View>

      {/* Camera Permission Denied State Placeholder */}
      <View style={{ marginTop: 24, borderWidth: 1, borderColor: '#ccc', padding: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Camera Permission State</Text>
        <Text style={{ marginTop: 4, color: 'gray' }}>
          Simulated status: {permissionDenied ? 'Permission Denied' : 'Permission Granted'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button
            title={permissionDenied ? 'Grant camera' : 'Simulate Denied'}
            onPress={() => setPermissionDenied(!permissionDenied)}
            color={permissionDenied ? '#5cb85c' : '#d9534f'}
          />
        </View>

        {permissionDenied ? (
          <View style={{ marginTop: 12, padding: 12, backgroundColor: '#f8d7da' }}>
            <Text style={{ color: '#721c24', fontWeight: 'bold' }}>
              Camera permission is required to scan.
            </Text>
            <View style={{ marginTop: 8, gap: 8 }}>
              <Button
                title="Allow camera"
                onPress={() => setPermissionDenied(false)}
              />
              <Button
                title="Type barcode instead"
                onPress={() => navigation.navigate('TypeBarcode', { mode })}
              />
            </View>
          </View>
        ) : null}
      </View>

      {/* Placeholder Flow Navigation Triggers */}
      <View style={{ marginTop: 24, borderWidth: 1, borderColor: '#e0e0e0', padding: 16, marginBottom: 40 }}>
        <Text style={{ fontWeight: 'bold' }}>Simulate Scan Result</Text>
        {mode === 'add' ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            <Button
              title="Barcode Found → AddStockForm"
              onPress={() =>
                navigation.navigate('AddStockForm', {
                  barcode: '4801981118502',
                  productName: 'Coca-Cola 1.5L',
                })
              }
            />
            <Button
              title="Barcode Not Found → NewProduct"
              onPress={() =>
                navigation.navigate('NewProduct', { barcode: '1234567890123' })
              }
            />
          </View>
        ) : (
          <View style={{ marginTop: 8 }}>
            <Button
              title="Item Scanned → SaleList"
              onPress={() => navigation.navigate('SaleList')}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
