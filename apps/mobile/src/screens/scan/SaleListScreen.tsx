/**
 * Screen: SaleListScreen
 * Displays items currently in the cart with quantity steppers and stock validation.
 */
import React, { useState } from 'react';
import { View, Text, Button, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { useSaleCart } from '../../context/SaleCartContext';

type Props = NativeStackScreenProps<ScanStackParamList, 'SaleList'>;

export default function SaleListScreen({ navigation }: Props) {
  const { items, updateQuantity, removeItem, clearCart } = useSaleCart();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancelSale = () => {
    if (items.length === 0) {
      clearCart();
      navigation.navigate('ScanChooser');
      return;
    }

    // Confirmation before discarding active cart
    Alert.alert(
      'Discard this sale?',
      'All items in your cart will be removed.',
      [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard sale',
          style: 'destructive',
          onPress: () => {
            clearCart();
            navigation.navigate('ScanChooser');
          },
        },
      ]
    );
  };

  const hasExceededStock = items.some(
    (item) => item.quantity > item.sellableUnits
  );

  const totalAmount = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <ScrollView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Items for Sale</Text>
      <Text style={{ color: 'gray', marginTop: 4 }}>
        Scanned products awaiting review
      </Text>

      {/* Empty State */}
      {items.length === 0 ? (
        <View style={{ marginTop: 40, padding: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#555' }}>
            Your cart is empty
          </Text>
          <Text style={{ color: 'gray', marginTop: 6, textAlign: 'center' }}>
            Scan barcodes or search by product name to add items to this sale.
          </Text>
          <View style={{ marginTop: 24, gap: 12, width: '100%' }}>
            <Button
              title="Scan Products"
              onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
            />
            <Button
              title="Type Barcode / Search Name"
              onPress={() => navigation.navigate('TypeBarcode', { mode: 'sell' })}
              color="gray"
            />
          </View>
        </View>
      ) : (
        <>
          {/* Cart Items List */}
          <View style={{ marginTop: 16, gap: 12 }}>
            {items.map((item) => {
              const isOver = item.quantity > item.sellableUnits;
              return (
                <View
                  key={item.productId}
                  style={{
                    borderWidth: 1,
                    borderColor: isOver ? '#d9534f' : '#ccc',
                    backgroundColor: '#fff',
                    padding: 12,
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
                        {item.name}
                      </Text>
                      <Text style={{ color: 'gray', marginTop: 2 }}>
                        Barcode: {item.barcode || 'None'}
                      </Text>
                    </View>
                    <Text style={{ fontWeight: 'bold', fontSize: 16 }}>
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>

                  <Text style={{ color: 'gray', marginTop: 4 }}>
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
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                      }}
                    >
                      <Button
                        title=" - "
                        onPress={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        disabled={item.quantity <= 1}
                      />
                      <Text style={{ fontSize: 18, fontWeight: 'bold', minWidth: 24, textAlign: 'center' }}>
                        {item.quantity}
                      </Text>
                      <Button
                        title=" + "
                        onPress={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        disabled={item.quantity >= item.sellableUnits}
                      />
                    </View>

                    <Button
                      title="Remove"
                      onPress={() => removeItem(item.productId)}
                      color="#d9534f"
                    />
                  </View>

                  {/* Inline Stock Warning */}
                  {isOver && (
                    <Text
                      style={{
                        color: '#d9534f',
                        marginTop: 8,
                        fontWeight: 'bold',
                      }}
                    >
                      Only {item.sellableUnits} sellable units
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Cart Summary */}
          <View
            style={{
              marginTop: 16,
              padding: 12,
              borderWidth: 1,
              borderColor: '#eee',
              backgroundColor: '#f9f9f9',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: 'bold' }}>Total</Text>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#2e7d32' }}>
                ₱{totalAmount.toFixed(2)}
              </Text>
            </View>
            <Text style={{ color: 'gray', marginTop: 2 }}>
              {totalUnits} total units • {items.length} items
            </Text>
          </View>

          {/* Fallback inline confirmation if Alert is dismissed */}
          {showCancelConfirm && (
            <View
              style={{
                marginTop: 12,
                padding: 12,
                borderWidth: 1,
                borderColor: '#d9534f',
                backgroundColor: '#fff3cd',
              }}
            >
              <Text style={{ fontWeight: 'bold', color: '#721c24' }}>
                Discard this sale? All items in your cart will be removed.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <Button
                  title="Yes, discard"
                  onPress={() => {
                    clearCart();
                    navigation.navigate('ScanChooser');
                  }}
                  color="#d9534f"
                />
                <Button
                  title="Cancel"
                  onPress={() => setShowCancelConfirm(false)}
                  color="gray"
                />
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={{ marginTop: 24, gap: 12, marginBottom: 40 }}>
            <Button
              title="Review sale"
              onPress={() => navigation.navigate('ConfirmSale')}
              disabled={hasExceededStock || items.length === 0}
            />

            <Button
              title="Scan More"
              onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
            />

            <Button
              title="Cancel sale"
              onPress={handleCancelSale}
              color="#888"
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}
