/**
 * Screen: ConfirmSaleScreen
 * Previews FEFO batch deductions and commits sale atomically item-by-item.
 * Handles partial failures and unclear network timeouts safely.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ShieldCheck, Package } from 'lucide-react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScanStackParamList } from '../../navigation/types';
import { useSaleCart } from '../../context/SaleCartContext';
import { previewSale, recordSale, undoSale } from '../../services/inventory';
import { PreviewSaleBatchDeduction } from '../../types/inventory';
import { formatDisplayDate } from '../../utils/date';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

type Props = NativeStackScreenProps<ScanStackParamList, 'ConfirmSale'>;

interface PreviewMap {
  [productId: string]: PreviewSaleBatchDeduction[];
}

interface RecordedItem {
  productId: string;
  name: string;
  quantity: number;
  scanId: string;
}

interface FailedItem {
  productId: string;
  name: string;
  quantity: number;
  error: string;
}

export default function ConfirmSaleScreen({ navigation }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const { items, removeItem, clearCart } = useSaleCart();

  const [loadingPreviews, setLoadingPreviews] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [deductionsMap, setDeductionsMap] = useState<PreviewMap>({});

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState<string>('');

  // Partial failure & unclear timeout states
  const [partialFailure, setPartialFailure] = useState<{
    recorded: RecordedItem[];
    failed: FailedItem[];
  } | null>(null);

  const [unknownFailure, setUnknownFailure] = useState<{
    recorded: RecordedItem[];
    unknownItem: { productId: string; name: string; quantity: number; error: string };
  } | null>(null);

  const [undoingRecorded, setUndoingRecorded] = useState(false);
  const [undoneSuccessMessage, setUndoneSuccessMessage] = useState<string | null>(null);

  // 1. Load previews on mount
  const loadPreviews = useCallback(async () => {
    if (items.length === 0) {
      setLoadingPreviews(false);
      return;
    }

    setLoadingPreviews(true);
    setPreviewError(null);

    const map: PreviewMap = {};

    for (const item of items) {
      const res = await previewSale(item.productId, item.quantity);
      if (res.kind === 'error') {
        setPreviewError(
          `Error previewing ${item.name}: ${res.message}`
        );
        setLoadingPreviews(false);
        return;
      }
      map[item.productId] = res.deductions;
    }

    setDeductionsMap(map);
    setLoadingPreviews(false);
  }, [items]);

  useEffect(() => {
    loadPreviews();
  }, [loadPreviews]);

  // 2. Block back navigation and hardware back button while saving
  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (isSaving) {
          return true; // Block hardware back
        }
        return false;
      }
    );

    const removeListener = navigation.addListener('beforeRemove', (e) => {
      if (isSaving) {
        e.preventDefault(); // Block gesture and header back
      }
    });

    return () => {
      backSubscription.remove();
      removeListener();
    };
  }, [isSaving, navigation]);

  // 3. Confirm sale execution
  const handleConfirmSale = async () => {
    if (isSaving || items.length === 0) return;

    setIsSaving(true);
    setPartialFailure(null);
    setUnknownFailure(null);

    const recorded: RecordedItem[] = [];
    const failed: FailedItem[] = [];
    let unknownItem: { productId: string; name: string; quantity: number; error: string } | null = null;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      setSavingProgress(`Recording ${item.name} (${i + 1} of ${items.length})...`);

      const res = await recordSale(item.productId, item.quantity);

      if (res.kind === 'success') {
        recorded.push({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          scanId: res.salesScanId,
        });
        // Remove item from cart so it cannot be double-recorded
        removeItem(item.productId);
      } else if (res.kind === 'db_error') {
        // Clear database failure (e.g. stock changed concurrently)
        failed.push({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          error: res.message,
        });

        // Any remaining items were not attempted
        for (let j = i + 1; j < items.length; j++) {
          failed.push({
            productId: items[j].productId,
            name: items[j].name,
            quantity: items[j].quantity,
            error: 'Not processed due to previous item failure',
          });
        }
        break;
      } else {
        // Unknown network error / timeout
        unknownItem = {
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          error: res.message,
        };
        // Remove from cart to block immediate unverified retry
        removeItem(item.productId);
        break;
      }
    }

    setIsSaving(false);
    setSavingProgress('');

    // Handle Unclear Failure
    if (unknownItem) {
      setUnknownFailure({
        recorded,
        unknownItem,
      });
      return;
    }

    // Handle Partial Failure
    if (failed.length > 0) {
      setPartialFailure({
        recorded,
        failed,
      });
      return;
    }

    // Full Success: Reset navigation to SaleDone so Back cannot return here
    const totalCount = recorded.reduce((sum, r) => sum + r.quantity, 0);
    clearCart();

    navigation.reset({
      index: 0,
      routes: [
        {
          name: 'SaleDone',
          params: {
            count: totalCount,
            scanIds: recorded.map((r) => r.scanId),
            items: recorded.map((r) => ({
              productId: r.productId,
              name: r.name,
              quantity: r.quantity,
            })),
          },
        },
      ],
    });
  };

  // Undo recorded items in case of partial or unknown failure
  const handleUndoRecorded = async (recordedList: RecordedItem[]) => {
    setUndoingRecorded(true);
    setUndoneSuccessMessage(null);

    let allUndone = true;
    for (const r of recordedList) {
      const res = await undoSale(r.scanId);
      if (res.kind === 'error' && !res.isAlreadyUndone) {
        allUndone = false;
      }
    }

    setUndoingRecorded(false);
    if (allUndone) {
      setUndoneSuccessMessage(
        'Recorded items were successfully undone and restored to original batches.'
      );
    } else {
      setUndoneSuccessMessage(
        'Some items could not be undone. Please verify in History.'
      );
    }
  };

  // --- UNKNOWN FAILURE VIEW (Network / Timeout error) ---
  if (unknownFailure) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.errorHeaderTitle}>Network Uncertainty</Text>

          <View style={styles.warningBox}>
            <Text style={styles.warningBoxTitle}>
              Not sure if this was recorded. Check History before trying again
            </Text>
            <Text style={styles.warningBoxSub}>
              A network timeout occurred while attempting to record:
            </Text>
            <Text style={styles.warningItemBold}>
              • {unknownFailure.unknownItem.name} ({unknownFailure.unknownItem.quantity} units)
            </Text>
            <Text style={styles.warningDetail}>
              Error details: {unknownFailure.unknownItem.error}
            </Text>
          </View>

          {unknownFailure.recorded.length > 0 && (
            <View style={styles.partialCard}>
              <Text style={styles.partialCardTitle}>Items recorded before timeout:</Text>
              {unknownFailure.recorded.map((r) => (
                <Text key={r.scanId} style={styles.partialRow}>
                  • {r.name} ({r.quantity} units) [Scan ID: {r.scanId.slice(0, 8).toUpperCase()}]
                </Text>
              ))}

              {undoneSuccessMessage ? (
                <Text style={styles.undoneSuccessText}>
                  {undoneSuccessMessage}
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => handleUndoRecorded(unknownFailure.recorded)}
                  disabled={undoingRecorded}
                >
                  <Text style={styles.undoBtnText}>
                    {undoingRecorded ? 'Undoing...' : 'Undo recorded items'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.btnStack}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('History')}
            >
              <Text style={styles.primaryBtnText}>Open History</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('SaleList')}
            >
              <Text style={styles.secondaryBtnText}>Go to Cart</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- PARTIAL FAILURE VIEW (Database error midway) ---
  if (partialFailure) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.dangerHeaderTitle}>Sale Stopped</Text>
          <Text style={styles.dangerHeaderSub}>
            One of the items failed to record. Sale execution was halted.
          </Text>

          <View style={styles.dangerBox}>
            <Text style={styles.dangerBoxTitle}>Failed items:</Text>
            {partialFailure.failed.map((f) => (
              <View key={f.productId} style={{ marginTop: 6 }}>
                <Text style={styles.failedItemName}>
                  • {f.name} ({f.quantity} units)
                </Text>
                <Text style={styles.failedItemReason}>
                  Reason: {f.error}
                </Text>
              </View>
            ))}
          </View>

          {partialFailure.recorded.length > 0 && (
            <View style={styles.partialCard}>
              <Text style={styles.partialCardTitle}>Items recorded before failure:</Text>
              {partialFailure.recorded.map((r) => (
                <Text key={r.scanId} style={styles.partialRow}>
                  • {r.name} ({r.quantity} units) [Scan ID: {r.scanId.slice(0, 8).toUpperCase()}]
                </Text>
              ))}

              {undoneSuccessMessage ? (
                <Text style={styles.undoneSuccessText}>
                  {undoneSuccessMessage}
                </Text>
              ) : (
                <TouchableOpacity
                  style={styles.undoBtn}
                  onPress={() => handleUndoRecorded(partialFailure.recorded)}
                  disabled={undoingRecorded}
                >
                  <Text style={styles.undoBtnText}>
                    {undoingRecorded ? 'Undoing...' : 'Undo recorded items'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.btnStack}>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => navigation.navigate('SaleList')}
            >
              <Text style={styles.primaryBtnText}>Return to Cart to Fix</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('History')}
            >
              <Text style={styles.secondaryBtnText}>View History</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- NORMAL CONFIRM VIEW ---
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Decorative background image */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        <Text style={[styles.screenSub, { marginTop: 4 }]}>
          Review batch deduction plan (earliest expiry first)
        </Text>

        {/* Loading Previews State */}
        {loadingPreviews && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingBoxText}>Calculating batch deductions...</Text>
          </View>
        )}

        {/* Preview Error Banner */}
        {previewError && (
          <View style={styles.previewErrorCard}>
            <Text style={styles.previewErrorTitle}>Cannot complete sale preview</Text>
            <Text style={styles.previewErrorSub}>{previewError}</Text>
            <View style={styles.previewErrorBtnRow}>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.primaryBtnText}>Return to Cart</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={loadPreviews}
              >
                <Text style={styles.secondaryBtnText}>Retry Preview</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Saving in Progress Banner */}
        {isSaving && (
          <View style={styles.savingCard}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.savingTitle}>
              {savingProgress || 'Recording sale...'}
            </Text>
            <Text style={styles.savingSub}>
              Please wait. Do not close or exit the app.
            </Text>
          </View>
        )}

        {/* Deduction Plan for Cart Items */}
        {!loadingPreviews && !previewError && (
          <View style={styles.deductionsList}>
            {items.map((item) => {
              const deductions = deductionsMap[item.productId] || [];
              return (
                <View key={item.productId} style={styles.deductionCard}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemCost}>
                      ₱{(item.price * item.quantity).toFixed(2)}
                    </Text>
                  </View>
                  <Text style={styles.itemQtyLabel}>
                    Quantity to sell: {item.quantity}{' '}
                    {item.quantity === 1 ? 'unit' : 'units'}
                  </Text>

                  {/* Batches Section */}
                  <View style={styles.batchSection}>
                    <Text style={styles.batchSectionTitle}>
                      Batches to be deducted:
                    </Text>
                    {deductions.length === 0 ? (
                      <Text style={styles.noBatchesText}>
                        No batches calculated
                      </Text>
                    ) : (
                      deductions.map((d) => {
                        const code = `B-${d.batch_id
                          .replace(/-/g, '')
                          .slice(0, 8)
                          .toUpperCase()}`;
                        return (
                          <View key={d.batch_id} style={styles.batchRow}>
                            <Text style={styles.batchBullet}>•</Text>
                            <Text style={styles.batchText}>
                              <Text style={styles.batchCode}>{code}</Text>{' '}
                              (Exp: {formatDisplayDate(d.expiration_date)}) —{' '}
                              <Text style={styles.batchUnits}>
                                {d.quantity_to_deduct}{' '}
                                {d.quantity_to_deduct === 1 ? 'unit' : 'units'}
                              </Text>
                            </Text>
                          </View>
                        );
                      })
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Business Rules Note Box */}
        <View style={styles.rulesBox}>
          <View style={styles.ruleItemRow}>
            <ShieldCheck size={16} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.ruleItem}>
              <Text style={styles.ruleItemBold}>Expiry Policy:</Text> Expired units are skipped automatically.
            </Text>
          </View>
          <View style={styles.ruleItemRow}>
            <Package size={16} color={COLORS.primary} strokeWidth={2} />
            <Text style={styles.ruleItem}>
              <Text style={styles.ruleItemBold}>Inventory Only:</Text> Updates stock counts only. No payment is processed.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.footerBtnStack}>
          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (isSaving ||
                loadingPreviews ||
                Boolean(previewError) ||
                items.length === 0) &&
                styles.btnDisabled,
            ]}
            onPress={handleConfirmSale}
            disabled={
              isSaving ||
              loadingPreviews ||
              Boolean(previewError) ||
              items.length === 0
            }
          >
            <Text style={styles.primaryBtnText}>
              {isSaving ? 'Recording sale...' : 'Confirm & Complete Sale'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => navigation.goBack()}
            disabled={isSaving}
          >
            <Text style={styles.secondaryBtnText}>Back to Cart</Text>
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
  loadingBox: {
    marginVertical: 32,
    alignItems: 'center',
  },
  loadingBoxText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  savingCard: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  savingTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.deepGreen,
  },
  savingSub: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  previewErrorCard: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  previewErrorTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.danger,
  },
  previewErrorSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 4,
  },
  previewErrorBtnRow: {
    marginTop: 14,
    gap: 8,
  },
  deductionsList: {
    gap: 12,
  },
  deductionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    flex: 1,
  },
  itemCost: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  itemQtyLabel: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  batchSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  batchSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primaryDark,
    marginBottom: 6,
  },
  noBatchesText: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 3,
  },
  batchBullet: {
    color: COLORS.primary,
    fontSize: 14,
    marginRight: 6,
  },
  batchText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    flex: 1,
  },
  batchCode: {
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  batchUnits: {
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  rulesBox: {
    marginTop: 20,
    backgroundColor: COLORS.canvas,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  ruleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ruleItem: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    lineHeight: 18,
    flex: 1,
  },
  ruleItemBold: {
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  footerBtnStack: {
    marginTop: 24,
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
  btnDisabled: {
    opacity: 0.5,
  },
  errorHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.orangeDark,
  },
  warningBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.orangeBorder,
    backgroundColor: COLORS.orangeLight,
  },
  warningBoxTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.orangeDark,
  },
  warningBoxSub: {
    marginTop: 8,
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  warningItemBold: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginTop: 4,
  },
  warningDetail: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  partialCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  partialCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  partialRow: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 4,
  },
  undoneSuccessText: {
    color: COLORS.primary,
    marginTop: 10,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  undoBtn: {
    marginTop: 12,
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  undoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.white,
  },
  btnStack: {
    marginTop: 24,
    gap: 10,
    marginBottom: 40,
  },
  dangerHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.danger,
  },
  dangerHeaderSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  dangerBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    backgroundColor: COLORS.dangerLight,
  },
  dangerBoxTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },
  failedItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  failedItemReason: {
    fontSize: 12,
    color: COLORS.danger,
  },
});
