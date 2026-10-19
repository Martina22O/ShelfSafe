/**
 * Screen: AddStockDoneScreen
 * Stock addition confirmation and routing to Scan another or View product in Inventory tab.
 */
import React from 'react';
import { View, Text, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'AddStockDone'>;

export default function AddStockDoneScreen({ route, navigation }: Props) {
  const units = route.params?.units || 0;
  const batchCode = route.params?.batchCode || 'New Delivery Batch';
  const expiryDate = route.params?.expiryDate || 'N/A';
  const productId = route.params?.productId;

  const handleScanAnother = () => {
    navigation.navigate('ScanBarcode', { mode: 'add' });
  };

  const handleViewProduct = () => {
    // Navigate to the Inventory tab's ProductDetail screen with the product id
    const parent = navigation.getParent();
    if (parent) {
      (parent as any).navigate('InventoryTab', {
        screen: 'ProductDetail',
        params: { productId },
      });
    } else {
      (navigation as any).navigate('InventoryTab', {
        screen: 'ProductDetail',
        params: { productId },
      });
    }
  };

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Stock Added</Text>
      <Text style={{ fontSize: 20, color: 'green', marginTop: 12 }}>
        Added {units} units
      </Text>

      <View style={{ borderWidth: 1, borderColor: '#ccc', padding: 16, marginTop: 16 }}>
        <Text style={{ fontWeight: 'bold' }}>Batch: {batchCode}</Text>
        <Text style={{ marginTop: 4, color: 'gray' }}>Expiry date: {expiryDate}</Text>
      </View>

      <View style={{ marginTop: 32, gap: 12 }}>
        <Button title="Scan another" onPress={handleScanAnother} />
        <Button
          title="View product"
          onPress={handleViewProduct}
          color="gray"
          disabled={!productId}
        />
      </View>
    </View>
  );
}
