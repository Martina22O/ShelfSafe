/**
 * Screen: AddStockDoneScreen
 * Stock addition confirmation and routing to Scan another or View product in Inventory tab.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CheckCircle2, Plus } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ScanStackParamList, 'AddStockDone'>;

export default function AddStockDoneScreen({ route, navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
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
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <StatusBar style="dark" />
      <Image
        source={require('../../../assets/designs/screen-background.png')}
        style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
        resizeMode="stretch"
      />
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconCircle}>
          <CheckCircle2 size={36} color={COLORS.primary} strokeWidth={2.5} />
        </View>

        <Text style={styles.title}>Stock Added!</Text>
        <Text style={styles.unitsSubtitle}>
          +{units} {units === 1 ? 'unit' : 'units'} added to active inventory
        </Text>

        {/* Batch Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoCardTitle}>Batch Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Batch Reference:</Text>
            <Text style={styles.infoValue}>{batchCode}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Expiration Date:</Text>
            <Text style={[styles.infoValue, { color: COLORS.deepGreen }]}>{expiryDate}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.btnStack}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={handleScanAnother}
            accessibilityRole="button"
          >
            <View style={styles.btnRow}>
              <Plus size={18} color={COLORS.white} strokeWidth={2.5} />
              <Text style={styles.primaryBtnText}>Scan Another Item</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryBtn, !productId && styles.btnDisabled]}
            activeOpacity={0.8}
            onPress={handleViewProduct}
            disabled={!productId}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryBtnText}>View in Inventory</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  iconEmoji: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  unitsSubtitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginTop: 6,
  },
  infoCard: {
    width: '100%',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 24,
  },
  infoCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  btnStack: {
    width: '100%',
    marginTop: 32,
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.white,
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
  btnDisabled: {
    opacity: 0.5,
  },
});
