/**
 * Screen: SaleListScreen
 * Displays items currently in the cart with quantity steppers and stock validation.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Image,
  useWindowDimensions,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, ShoppingCart, AlertCircle, Plus } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { useSaleCart } from '../../context/SaleCartContext';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ScanStackParamList, 'SaleList'>;

export default function SaleListScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { items, updateQuantity, removeItem, clearCart } = useSaleCart();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editingQuantities, setEditingQuantities] = useState<Record<string, string>>({});

  const handleQuantityChange = (productId: string, text: string, sellableUnits: number) => {
    // Strip non-numeric characters (prevents negatives, decimals, symbols)
    const sanitized = text.replace(/[^0-9]/g, '');

    // Allow user to temporarily empty the input while actively typing
    if (sanitized === '') {
      setEditingQuantities((prev) => ({ ...prev, [productId]: '' }));
      return;
    }

    const parsed = parseInt(sanitized, 10);
    if (isNaN(parsed) || parsed < 1) {
      setEditingQuantities((prev) => ({ ...prev, [productId]: sanitized }));
      return;
    }

    // Enforce sellable stock limit: clamp immediately to available stock
    const clamped = Math.min(parsed, sellableUnits);
    setEditingQuantities((prev) => ({ ...prev, [productId]: String(clamped) }));
    updateQuantity(productId, clamped);
  };

  const handleFinishEditing = (productId: string, sellableUnits: number) => {
    const rawVal = editingQuantities[productId];
    if (rawVal === undefined) return;

    const parsed = parseInt(rawVal, 10);
    // If empty, non-numeric, or zero, normalize to 1
    if (isNaN(parsed) || parsed < 1) {
      updateQuantity(productId, 1);
    } else {
      const clamped = Math.min(parsed, sellableUnits);
      updateQuantity(productId, clamped);
    }

    // Clear editing buffer so the input mirrors the finalized numeric quantity
    setEditingQuantities((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const handleStepChange = (productId: string, nextQty: number, sellableUnits: number) => {
    setEditingQuantities((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    const clamped = Math.max(1, Math.min(nextQty, sellableUnits));
    updateQuantity(productId, clamped);
  };

  const handleCancelSale = () => {
    if (items.length === 0) {
      clearCart();
      navigation.navigate('ScanChooser');
      return;
    }

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
    <SafeAreaView style={[styles.container, { backgroundColor: COLORS.scanActionBg }]} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Background Decorative Wave */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        <Text style={[styles.screenSub, { marginTop: 4 }]}>
          Scanned products awaiting checkout review
        </Text>

        {/* Empty State */}
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <ShoppingCart size={44} color={COLORS.textTertiary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>Your cart is empty</Text>
            <Text style={styles.emptySub}>
              Scan barcodes or search by product name to add items to this sale session.
            </Text>
            <View style={styles.emptyBtnStack}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
              >
                <Text style={styles.primaryBtnText}>Scan Products</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('TypeBarcode', { mode: 'sell' })}
              >
                <Text style={styles.secondaryBtnText}>Type Barcode / Search Name</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {/* Cart Items List */}
            <View style={styles.itemsList}>
              {items.map((item) => {
                const isOver = item.quantity > item.sellableUnits;
                return (
                  <View
                    key={item.productId}
                    style={[styles.itemCard, isOver && styles.itemCardError]}
                  >
                    <View style={styles.itemHeaderRow}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.itemName}>{item.name}</Text>
                        <Text style={styles.itemBarcode}>
                          Barcode: {item.barcode || 'None'}
                        </Text>
                      </View>
                      <Text style={styles.itemSubtotal}>
                        ₱{(item.price * item.quantity).toFixed(2)}
                      </Text>
                    </View>

                    <Text style={styles.unitPriceText}>
                      ₱{item.price.toFixed(2)} each • {item.sellableUnits} units sellable
                    </Text>

                    {/* Quantity Stepper & Remove */}
                    <View style={styles.stepperRow}>
                      <View style={styles.stepperGroup}>
                        <TouchableOpacity
                          style={[
                            styles.stepBtn,
                            item.quantity <= 1 && styles.stepBtnDisabled,
                          ]}
                          onPress={() =>
                            handleStepChange(
                              item.productId,
                              item.quantity - 1,
                              item.sellableUnits
                            )
                          }
                          disabled={item.quantity <= 1}
                          accessibilityRole="button"
                          accessibilityLabel={`Decrease quantity of ${item.name}`}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>

                        <TextInput
                          style={[
                            styles.stepQtyInput,
                            isOver && styles.stepQtyInputError,
                          ]}
                          value={
                            editingQuantities[item.productId] !== undefined
                              ? editingQuantities[item.productId]
                              : String(item.quantity)
                          }
                          onChangeText={(text) =>
                            handleQuantityChange(
                              item.productId,
                              text,
                              item.sellableUnits
                            )
                          }
                          onBlur={() =>
                            handleFinishEditing(
                              item.productId,
                              item.sellableUnits
                            )
                          }
                          onSubmitEditing={() => {
                            Keyboard.dismiss();
                            handleFinishEditing(
                              item.productId,
                              item.sellableUnits
                            );
                          }}
                          keyboardType="number-pad"
                          returnKeyType="done"
                          selectTextOnFocus
                          maxLength={5}
                          accessibilityRole="spinbutton"
                          accessibilityLabel={`${item.name} quantity input`}
                        />

                        <TouchableOpacity
                          style={[
                            styles.stepBtn,
                            item.quantity >= item.sellableUnits &&
                              styles.stepBtnDisabled,
                          ]}
                          onPress={() =>
                            handleStepChange(
                              item.productId,
                              item.quantity + 1,
                              item.sellableUnits
                            )
                          }
                          disabled={item.quantity >= item.sellableUnits}
                          accessibilityRole="button"
                          accessibilityLabel={`Increase quantity of ${item.name}`}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeItem(item.productId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${item.name}`}
                      >
                        <Text style={styles.removeBtnText}>Remove</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Inline Stock Warning */}
                    {isOver && (
                      <View style={styles.overStockAlert}>
                        <AlertCircle size={14} color={COLORS.dangerDark} strokeWidth={2} />
                        <Text style={styles.overStockAlertText}>
                          Only {item.sellableUnits} sellable units available
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Cart Summary Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Amount</Text>
                <Text style={styles.summaryAmount}>₱{totalAmount.toFixed(2)}</Text>
              </View>
              <Text style={styles.summarySub}>
                {totalUnits} total unit{totalUnits === 1 ? '' : 's'} across {items.length} product{items.length === 1 ? '' : 's'}
              </Text>
            </View>

            {/* Fallback inline confirmation */}
            {showCancelConfirm && (
              <View style={styles.cancelConfirmBox}>
                <Text style={styles.cancelConfirmText}>
                  Discard this sale? All items in your cart will be removed.
                </Text>
                <View style={styles.cancelConfirmBtnRow}>
                  <TouchableOpacity
                    style={styles.cancelConfirmYesBtn}
                    onPress={() => {
                      clearCart();
                      navigation.navigate('ScanChooser');
                    }}
                  >
                    <Text style={styles.cancelConfirmYesText}>Yes, discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.cancelConfirmNoBtn}
                    onPress={() => setShowCancelConfirm(false)}
                  >
                    <Text style={styles.cancelConfirmNoText}>Keep Cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Actions */}
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  (hasExceededStock || items.length === 0) && styles.btnDisabled,
                ]}
                onPress={() => navigation.navigate('ConfirmSale')}
                disabled={hasExceededStock || items.length === 0}
                accessibilityRole="button"
              >
                <View style={styles.primaryBtnRow}>
                  <Text style={styles.primaryBtnText}>
                    Review Sale
                  </Text>
                  <ArrowRight size={16} color={COLORS.white} strokeWidth={2} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
                accessibilityRole="button"
              >
                <View style={styles.secondaryBtnRow}>
                  <Plus size={16} color={COLORS.text} strokeWidth={2} />
                  <Text style={styles.secondaryBtnText}>Scan More Items</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.discardBtn}
                onPress={handleCancelSale}
              >
                <Text style={styles.discardBtnText}>Discard Sale</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 40,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topNav: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
    letterSpacing: -0.4,
  },
  screenSub: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
    lineHeight: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyBtnStack: {
    marginTop: 20,
    gap: 12,
    width: '100%',
  },
  itemsList: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemCardError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerLight,
  },
  itemHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  itemBarcode: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  itemSubtotal: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  unitPriceText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  stepperRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  stepperGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepBtnText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  stepQtyInput: {
    minWidth: 48,
    height: 36,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  stepQtyInputError: {
    borderColor: COLORS.danger,
    backgroundColor: '#fff8f8',
  },
  removeBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minHeight: 36,
    justifyContent: 'center',
  },
  removeBtnText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },
  overStockAlert: {
    marginTop: 10,
    backgroundColor: COLORS.dangerLight,
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overStockAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.danger,
  },
  primaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  summaryAmount: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.primary,
  },
  summarySub: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  cancelConfirmBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  cancelConfirmText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.dangerDark,
  },
  cancelConfirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelConfirmYesBtn: {
    backgroundColor: COLORS.danger,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelConfirmYesText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  cancelConfirmNoBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cancelConfirmNoText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  actionButtonsContainer: {
    marginTop: 20,
    gap: 12,
    marginBottom: 40,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  secondaryBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  discardBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 44,
  },
  discardBtnText: {
    fontSize: 14,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
});
