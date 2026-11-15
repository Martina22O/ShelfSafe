/**
 * Screen: SaleDoneScreen
 * Displays summary of recorded items with multi-scan batch undo capability.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CheckCircle2, Undo2 } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { undoSale } from '../../services/inventory';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ScanStackParamList, 'SaleDone'>;

interface UndoStatus {
  scanId: string;
  name?: string;
  quantity?: number;
  success: boolean;
  error?: string;
}

export default function SaleDoneScreen({ route, navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const count = route.params?.count || 0;
  const scanIds = route.params?.scanIds || [];
  const items = route.params?.items || [];

  const [undone, setUndone] = useState(false);
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [undoing, setUndoing] = useState(false);
  const [undoResults, setUndoResults] = useState<UndoStatus[] | null>(null);

  const handleExecuteUndo = async () => {
    setUndoing(true);
    setConfirmingUndo(false);

    const results: UndoStatus[] = [];
    let hasFailures = false;

    for (let i = 0; i < scanIds.length; i++) {
      const scanId = scanIds[i];
      const matchingItem = items[i];
      const res = await undoSale(scanId);

      if (res.kind === 'success' || res.isAlreadyUndone) {
        results.push({
          scanId,
          name: matchingItem?.name,
          quantity: matchingItem?.quantity,
          success: true,
        });
      } else {
        hasFailures = true;
        results.push({
          scanId,
          name: matchingItem?.name,
          quantity: matchingItem?.quantity,
          success: false,
          error: res.message,
        });
      }
    }

    setUndoing(false);
    setUndoResults(results);

    if (!hasFailures) {
      setUndone(true);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Decorative Wave Background */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        {/* Header Success Box */}
        <View style={styles.headerBox}>
          <View style={styles.iconCircle}>
            <CheckCircle2 size={36} color={COLORS.primary} strokeWidth={2.5} />
          </View>
          <Text style={styles.title}>Sale Recorded</Text>
          <Text style={styles.countText}>
            {count} {count === 1 ? 'unit' : 'units'} deducted from earliest expiring batches
          </Text>
        </View>

        {/* Item Summary List Card */}
        {items.length > 0 && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryCardTitle}>Recorded Items</Text>
            {items.map((item, idx) => (
              <View key={idx} style={styles.itemRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.itemNameText}>
                  {item.name} —{' '}
                  <Text style={styles.itemQtyText}>
                    {item.quantity} {item.quantity === 1 ? 'unit' : 'units'}
                  </Text>
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Undone State Banner */}
        {undone && (
          <View style={styles.undoneBanner}>
            <Text style={styles.undoneBannerTitle}>Sale Undone</Text>
            <Text style={styles.undoneBannerSub}>
              Units have been successfully restored back into their original batches.
            </Text>
          </View>
        )}

        {/* Partial Undo Results Report (if some failed) */}
        {undoResults && !undone && (
          <View style={styles.undoReportCard}>
            <Text style={styles.undoReportTitle}>Undo Results</Text>
            {undoResults.map((u, i) => (
              <Text key={i} style={styles.undoReportRow}>
                • {u.name || 'Item'} ({u.quantity} units):{' '}
                {u.success ? 'Restored' : `Failed (${u.error})`}
              </Text>
            ))}
          </View>
        )}

        {/* Undo Confirmation or Button */}
        {!undone && (
          <View style={styles.undoSection}>
            {confirmingUndo ? (
              <View style={styles.confirmUndoBox}>
                <Text style={styles.confirmUndoTitle}>
                  Undo this entire recorded sale?
                </Text>
                <Text style={styles.confirmUndoSub}>
                  Stock will be restored into the exact batches it was deducted from.
                </Text>
                <View style={styles.confirmUndoBtnRow}>
                  <TouchableOpacity
                    style={styles.confirmUndoYesBtn}
                    onPress={handleExecuteUndo}
                    disabled={undoing}
                  >
                    {undoing ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.confirmUndoYesText}>Yes, Undo Sale</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.confirmUndoNoBtn}
                    onPress={() => setConfirmingUndo(false)}
                    disabled={undoing}
                  >
                    <Text style={styles.confirmUndoNoText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.undoPromptBtn}
                onPress={() => setConfirmingUndo(true)}
                accessibilityRole="button"
              >
                <View style={styles.undoPromptRow}>
                  <Undo2 size={16} color={COLORS.dangerDark} strokeWidth={2} />
                  <Text style={styles.undoPromptText}>Need to undo this sale?</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionBtnStack}>
          <TouchableOpacity
            style={styles.primaryBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ScanChooser')}
          >
            <Text style={styles.primaryBtnText}>Start New Scan Session</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('History')}
          >
            <Text style={styles.secondaryBtnText}>View Sales History</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bgWarm,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerBox: {
    alignItems: 'center',
    marginVertical: 20,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 2,
    borderColor: COLORS.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconEmoji: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
    letterSpacing: -0.4,
  },
  countText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
    marginTop: 6,
  },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  summaryCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 6,
  },
  bullet: {
    color: COLORS.primary,
    fontSize: 14,
    marginRight: 6,
  },
  itemNameText: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    flex: 1,
  },
  itemQtyText: {
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  undoneBanner: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  undoneBannerTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
  },
  undoneBannerSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 4,
  },
  undoReportCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  undoReportTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.danger,
    marginBottom: 6,
  },
  undoReportRow: {
    fontSize: 12,
    color: COLORS.text,
    marginTop: 2,
  },
  undoSection: {
    marginBottom: 20,
  },
  confirmUndoBox: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  confirmUndoTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },
  confirmUndoSub: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  confirmUndoBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  confirmUndoYesBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmUndoYesText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  confirmUndoNoBtn: {
    backgroundColor: COLORS.canvas,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmUndoNoText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  undoPromptBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  undoPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  undoPromptText: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.danger,
    textDecorationLine: 'underline',
  },
  actionBtnStack: {
    gap: 12,
    marginTop: 10,
  },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
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
  secondaryBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
});
