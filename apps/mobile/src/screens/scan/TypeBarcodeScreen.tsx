/**
 * Screen: TypeBarcodeScreen
 * Elements:
 * - Screen Name: Type Barcode
 * - Barcode number input
 * - "Find" button
 * - "Search product by name" button
 * - "Add a product with no barcode" button
 * - Routing to AddStockForm, NewProduct, or (in sell mode) SaleList
 */
import React, { useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'TypeBarcode'>;

export default function TypeBarcodeScreen({ route, navigation }: Props) {
  const mode = route.params?.mode || 'add';
  const [barcode, setBarcode] = useState('');

  const handleFind = () => {
    if (mode === 'sell') {
      navigation.navigate('SaleList');
    } else {
      navigation.navigate('AddStockForm', {
        barcode: barcode || '4801981118502',
        productName: 'Sample Product',
      });
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Type Barcode</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Enter barcode number manually
      </Text>

      <Text style={{ marginTop: 16 }}>Barcode number</Text>
      <TextInput
        style={{ borderWidth: 1, borderColor: '#ccc', padding: 8, marginTop: 4 }}
        placeholder="e.g. 4801981118502"
        value={barcode}
        onChangeText={setBarcode}
        keyboardType="numeric"
      />

      <View style={{ marginTop: 16 }}>
        <Button title="Find" onPress={handleFind} />
      </View>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Button
          title="Search product by name"
          onPress={() =>
            navigation.navigate('AddStockForm', {
              productName: 'Searched Product',
            })
          }
          color="gray"
        />

        {mode === 'add' ? (
          <Button
            title="Add a product with no barcode"
            onPress={() => navigation.navigate('NewProduct', { barcode: '' })}
            color="gray"
          />
        ) : null}
      </View>
    </View>
  );
}
