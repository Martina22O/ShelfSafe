/**
 * Screen: ScanChooserScreen
 * Reference: Mobile Brand Styling
 * Elements:
 * - Screen Name: Scan & Action Chooser
 * - Brand cards for "Add stock" and "Record sold items"
 * - Quick link to "View History"
 */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Package, ShoppingCart, ClipboardList, ArrowRight } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ScanStackParamList, 'ScanChooser'>;

export default function ScanChooserScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);

  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log('[ShelfSafe PWA Diagnostic] 4. Target screen (ScanChooserScreen) MOUNTED');
    }
    return () => {
      if (Platform.OS === 'web') {
        console.log('[ShelfSafe PWA Diagnostic] 5. Target screen (ScanChooserScreen) UNMOUNTED');
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <Image
        source={require('../../../assets/designs/screen-background.png')}
        style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
        resizeMode="stretch"
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header (Stack header says Scan; body provides clear instructional context) */}
        <View style={styles.header}>
          <Text style={styles.title}>Inventory Actions</Text>
          <Text style={styles.subtitle}>
            Select an action to stock in new deliveries or record sold items
          </Text>
        </View>

        {/* Action Options */}
        <View style={styles.actionsContainer}>
          {/* Add Stock Card */}
          <TouchableOpacity
            style={[styles.actionCard, { borderColor: COLORS.primaryLight }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ScanBarcode', { mode: 'add' })}
          >
            <View style={[styles.iconCircle, { backgroundColor: COLORS.primaryLight }]}>
              <Package size={24} color={COLORS.primary} strokeWidth={2} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Stock In</Text>
              <Text style={styles.actionSubtitle}>
                Scan barcode or enter product details to add new stock batches
              </Text>
            </View>
            <ArrowRight size={18} color={COLORS.primary} strokeWidth={2} />
          </TouchableOpacity>

          {/* Record Sold Items Card */}
          <TouchableOpacity
            style={[styles.actionCard, { borderColor: COLORS.amberBorder }]}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ScanBarcode', { mode: 'sell' })}
          >
            <View style={[styles.iconCircle, { backgroundColor: COLORS.amberLight }]}>
              <ShoppingCart size={24} color={COLORS.amberDark} strokeWidth={2} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Record Sold Items</Text>
              <Text style={styles.actionSubtitle}>
                Scan items at checkout to automatically deduct earliest-expiring batches
              </Text>
            </View>
            <ArrowRight size={18} color={COLORS.amberDark} strokeWidth={2} />
          </TouchableOpacity>

          {/* View History Button */}
          <TouchableOpacity
            style={styles.historyBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('History')}
          >
            <ClipboardList size={18} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.historyBtnText}>View Scan & Sales History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
  actionsContainer: {
    gap: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  iconEmoji: {
    fontSize: 22,
  },
  actionTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  actionSubtitle: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 3,
    lineHeight: 18,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textMuted,
    marginLeft: 8,
  },
  historyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 50,
    marginTop: 4,
  },
  historyEmoji: {
    fontSize: 16,
    marginRight: 8,
  },
  historyBtnText: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
});
