/**
 * Screen: SaleListScreen
 * Displays items currently in the cart with quantity steppers and stock validation.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  Image,
  useWindowDimensions,
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
                            updateQuantity(item.productId, item.quantity - 1)
                          }
                          disabled={item.quantity <= 1}
                        >
                          <Text style={styles.stepBtnText}>−</Text>
                        </TouchableOpacity>

                        <Text style={styles.stepQtyText}>{item.quantity}</Text>

                        <TouchableOpacity
                          style={[
                            styles.stepBtn,
                            item.quantity >= item.sellableUnits &&
                              styles.stepBtnDisabled,
                          ]}
                          onPress={() =>
                            updateQuantity(item.productId, item.quantity + 1)
                          }
                          disabled={item.quantity >= item.sellableUnits}
                        >
                          <Text style={styles.stepBtnText}>+</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeItem(item.productId)}
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
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
    marginBottom: 16,
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
  },
  emptySub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtnStack: {
    marginTop: 20,
    gap: 10,
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
    fontSize: 12,
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
    width: 32,
    height: 32,
    borderRadius: 8,
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
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  stepQtyText: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    minWidth: 26,
    textAlign: 'center',
    color: COLORS.text,
  },
  removeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  removeBtnText: {
    fontSize: 12,
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
    gap: 10,
    marginBottom: 40,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
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
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  discardBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  discardBtnText: {
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
});
