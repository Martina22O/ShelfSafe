/**
 * Screen: SaleListScreen
 * Elements:
 * - Screen Name: Items for Sale
 * - Items scanned so far (product, price, sellable units, quantity stepper, remove)
 * - Inline error if quantity > sellable units ("Only N sellable units")
 * - "Scan More" button (navigates back to ScanBarcode with mode = 'sell')
 * - "Review sale" button (navigates to ConfirmSale)
 */
import React, { useState } from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ScanStackParamList, 'SaleList'>;

interface ScannedItem {
  id: string;
  name: string;
  price: number;
  sellableUnits: number;
  quantity: number;
}

export default function SaleListScreen({ navigation }: Props) {
  const [items, setItems] = useState<ScannedItem[]>([
    {
      id: '1',
      name: 'Coca-Cola 1.5L',
      price: 75,
      sellableUnits: 30,
      quantity: 2,
    },
    {
      id: '2',
      name: 'Skyflakes 250g',
      price: 34,
      sellableUnits: 3,
      quantity: 1,
    },
  ]);

  const updateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const hasExceededStock = items.some(
    (item) => item.quantity > item.sellableUnits
  );

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Items for Sale</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Scanned products awaiting review
      </Text>

      {/* Scanned Items */}
      <View style={{ marginTop: 16, gap: 12 }}>
        {items.map((item) => {
          const isOver = item.quantity > item.sellableUnits;
          return (
            <View
              key={item.id}
              style={{
                borderWidth: 1,
                borderColor: isOver ? '#d9534f' : '#ccc',
                padding: 12,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontWeight: 'bold', fontSize: 16 }}>{item.name}</Text>
                <Text>₱{(item.price * item.quantity).toFixed(2)}</Text>
              </View>
              <Text style={{ color: 'gray' }}>
                ₱{item.price.toFixed(2)} each • {item.sellableUnits} sellable units
              </Text>

              {/* Quantity Stepper & Remove */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: 12,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Button
                    title=" - "
                    onPress={() => updateQuantity(item.id, -1)}
                  />
                  <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                    {item.quantity}
                  </Text>
                  <Button
                    title=" + "
                    onPress={() => updateQuantity(item.id, 1)}
                  />
                </View>

                <Button
                  title="Remove"
                  onPress={() => removeItem(item.id)}
                  color="#d9534f"
                />
              </View>

              {/* Inline Stock Warning */}
              {isOver ? (
                <Text style={{ color: '#d9534f', marginTop: 8, fontWeight: 'bold' }}>
                  Only {item.sellableUnits} sellable units
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Actions */}
      <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
        {/* Requirement 5: "Scan More" button goes back to ScanBarcode(sell) */}
        <Button
          title="Scan More"
          onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
        />

        <Button
          title="Review sale"
          onPress={() => navigation.navigate('ConfirmSale')}
          disabled={hasExceededStock || items.length === 0}
        />
      </View>
    </ScrollView>
  );
}
