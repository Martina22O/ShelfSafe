/**
 * Screen: HistoryScreen
 * Displays sales history deductions using get_sale_history RPC with real-time undo.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ClipboardList, Undo2, Sparkles } from 'lucide-react-native';
import { useFocusEffect, useNavigation, useIsFocused } from '@react-navigation/native';
import { getSaleHistory, undoSale } from '../../services/inventory';
import { getUserSubscription } from '../../services/subscription';
import { SaleHistoryRecord } from '../../types/inventory';
import { formatManilaDateTime } from '../../utils/date';
import { useRealtime } from '../../services/realtime';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

const RefreshControlComponent = RefreshControl as any;

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const [sales, setSales] = useState<SaleHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  // Undo confirmation state
  const [confirmingSaleId, setConfirmingSaleId] = useState<string | null>(null);
  const [undoingSaleId, setUndoingSaleId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const isFocused = useIsFocused();
  const { dataVersion } = useRealtime();
  const deferredRefreshRef = useRef(false);

  const loadHistory = async (isMounted = true) => {
    setError(null);

    // Fetch subscription entitlement for 7-day limit display
    getUserSubscription()
      .then((subRes) => {
        if (!isMounted) return;
        if (subRes.success && subRes.data) {
          setIsPremium(subRes.data.is_premium);
        } else {
          setIsPremium(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsPremium(false);
      });

    const res = await getSaleHistory(50);

    if (!isMounted) return;

    if (res.kind === 'error') {
      setError(res.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setSales(res.history);
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      loadHistory(isMounted);
      return () => {
        isMounted = false;
      };
    }, [])
  );

  // Background silent refresh when data changes on another device
  useEffect(() => {
    if (!isFocused) return;
    if (dataVersion === 0) return;

    if (undoingSaleId !== null) {
      deferredRefreshRef.current = true;
      return;
    }

    let isMounted = true;
    const run = async () => {
      await loadHistory(isMounted);
    };
    void run();

    return () => {
      isMounted = false;
    };
  }, [dataVersion, isFocused, undoingSaleId]);

  // Execute deferred refresh once undo action finishes
  useEffect(() => {
    if (undoingSaleId === null && deferredRefreshRef.current) {
      deferredRefreshRef.current = false;
      if (isFocused) {
        void loadHistory(true);
      }
    }
  }, [undoingSaleId, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    setActionMessage(null);
    loadHistory(true);
  };

  const handleExecuteUndo = async (sale: SaleHistoryRecord) => {
    setUndoingSaleId(sale.sales_scan_id);
    setActionMessage(null);

    const res = await undoSale(sale.sales_scan_id);

    setUndoingSaleId(null);
    setConfirmingSaleId(null);

    if (res.kind === 'error') {
      if (res.isAlreadyUndone) {
        setActionMessage('This sale was already undone.');
      } else {
        setActionMessage(`Failed to undo sale: ${res.message}`);
      }
    } else {
      setActionMessage(
        `Sale for ${sale.product_name} (${sale.total_quantity} units) was undone. Units returned to original batches.`
      );
    }

    loadHistory(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControlComponent
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* Background Decorative Wave */}
        <Image
          source={require('../../../assets/designs/screen-background.png')}
          style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
          resizeMode="stretch"
        />

        <Text style={[styles.screenSub, { marginTop: 4 }]}>
          Audit trail of batch deductions and reversible sales
        </Text>

        {/* Free Plan 7-Day Limit Upgrade Notice */}
        {isPremium === false && (
          <View style={styles.historyLimitBanner}>
            <View style={styles.historyLimitLeft}>
              <View style={styles.historyLimitBadge}>
                <Text style={styles.historyLimitBadgeText}>FREE PLAN</Text>
              </View>
              <Text style={styles.historyLimitText}>
                Showing sales from the last 7 days.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.historyUpgradeBtn}
              onPress={() => navigation.navigate('ProfileTab', { screen: 'Subscription' })}
              activeOpacity={0.85}
            >
              <Sparkles size={12} color="#FFFFFF" />
              <Text style={styles.historyUpgradeBtnText}>Upgrade</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Action / Success Banner */}
        {actionMessage ? (
          <View style={styles.actionBanner}>
            <Text style={styles.actionBannerText}>{actionMessage}</Text>
          </View>
        ) : null}

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingBoxText}>Loading sales history...</Text>
          </View>
        )}

        {/* Error State Banner */}
        {error && !loading && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Unable to load sales history</Text>
            <Text style={styles.errorSub}>{error}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                setLoading(true);
                loadHistory(true);
              }}
            >
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sales List or Empty State */}
        {!loading && !error && (
          <View style={styles.listSection}>
            {sales.length === 0 ? (
              <View style={styles.emptyCard}>
                <ClipboardList size={40} color={COLORS.textTertiary} strokeWidth={1.5} />
                <Text style={styles.emptyTitle}>No sales yet</Text>
                <Text style={styles.emptySub}>
                  Sales recorded using the Scan tab will appear here.
                </Text>
              </View>
            ) : (
              <View style={styles.cardsStack}>
                {sales.map((sale) => {
                  const isConfirming = confirmingSaleId === sale.sales_scan_id;
                  const isCurrentlyUndoing = undoingSaleId === sale.sales_scan_id;

                  const batchesFormatted =
                    sale.batch_breakdown.length > 0
                      ? sale.batch_breakdown
                          .map(
                            (b) =>
                              `B-${b.batch_id
                                .replace(/-/g, '')
                                .slice(0, 8)
                                .toUpperCase()} (${b.quantity} ${
                                b.quantity === 1 ? 'unit' : 'units'
                              })`
                          )
                          .join(', ')
                      : 'N/A';

                  return (
                    <View key={sale.sales_scan_id} style={styles.saleCard}>
                      <View style={styles.saleHeaderRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.saleProdName}>
                            {sale.product_name || 'Unknown Product'}
                          </Text>
                          {sale.product_barcode ? (
                            <Text style={styles.saleBarcode}>
                              Barcode: {sale.product_barcode}
                            </Text>
                          ) : null}
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            sale.is_undone
                              ? styles.statusBadgeUndone
                              : styles.statusBadgeActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              sale.is_undone
                                ? styles.statusBadgeTextUndone
                                : styles.statusBadgeTextActive,
                            ]}
                          >
                            {sale.is_undone ? 'Undone' : 'Recorded'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.quantityRow}>
                        <Text style={styles.quantityText}>
                          Quantity: {sale.total_quantity}{' '}
                          {sale.total_quantity === 1 ? 'unit' : 'units'}
                        </Text>
                        {sale.product_price > 0 ? (
                          <Text style={styles.totalPriceText}>
                            ₱{(sale.product_price * sale.total_quantity).toFixed(2)}
                          </Text>
                        ) : null}
                      </View>

                      <Text style={styles.metaTime}>
                        Timestamp: {formatManilaDateTime(sale.created_at)}
                      </Text>

                      <View style={styles.batchesBox}>
                        <Text style={styles.batchesLabel}>Batches used:</Text>
                        <Text style={styles.batchesValue}>{batchesFormatted}</Text>
                      </View>

                      {/* Inline Confirmation for Undo */}
                      {isConfirming && !sale.is_undone && (
                        <View style={styles.undoConfirmBox}>
                          <Text style={styles.undoConfirmTitle}>
                            Put {sale.total_quantity}{' '}
                            {sale.total_quantity === 1 ? 'unit' : 'units'} back into the same batches?
                          </Text>
                          <View style={styles.undoConfirmBtnRow}>
                            <TouchableOpacity
                              style={styles.undoConfirmYesBtn}
                              onPress={() => handleExecuteUndo(sale)}
                              disabled={isCurrentlyUndoing}
                            >
                              {isCurrentlyUndoing ? (
                                <ActivityIndicator size="small" color={COLORS.white} />
                              ) : (
                                <Text style={styles.undoConfirmYesText}>Confirm Undo</Text>
                              )}
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.undoConfirmCancelBtn}
                              onPress={() => setConfirmingSaleId(null)}
                              disabled={isCurrentlyUndoing}
                            >
                              <Text style={styles.undoConfirmCancelText}>Cancel</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Undo Trigger Button */}
                      {!sale.is_undone && !isConfirming && (
                        <TouchableOpacity
                          style={styles.undoTriggerBtn}
                          onPress={() => setConfirmingSaleId(sale.sales_scan_id)}
                          accessibilityRole="button"
                        >
                          <View style={styles.undoBtnRow}>
                            <Undo2 size={14} color={COLORS.danger} strokeWidth={2} />
                            <Text style={styles.undoTriggerText}>Undo Sale</Text>
                          </View>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
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
  actionBanner: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  actionBannerText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.deepGreen,
  },
  historyLimitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    marginBottom: 12,
    gap: 8,
  },
  historyLimitLeft: {
    flex: 1,
  },
  historyLimitBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginBottom: 2,
  },
  historyLimitBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    color: '#FFFFFF',
  },
  historyLimitText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: '#92400E',
    lineHeight: 15,
  },
  historyUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  historyUpgradeBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
  },
  loadingBox: {
    marginTop: 40,
    alignItems: 'center',
  },
  loadingBoxText: {
    marginTop: 10,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 14,
    padding: 16,
    marginVertical: 16,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.danger,
  },
  errorSub: {
    fontSize: 13,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  retryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  listSection: {
    marginTop: 8,
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 20,
  },
  emptyEmoji: {
    fontSize: 36,
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
  },
  cardsStack: {
    gap: 12,
  },
  saleCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  saleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  saleProdName: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  saleBarcode: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeActive: {
    backgroundColor: COLORS.primaryLight,
  },
  statusBadgeUndone: {
    backgroundColor: COLORS.orangeLight,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  statusBadgeTextActive: {
    color: COLORS.primaryDark,
  },
  statusBadgeTextUndone: {
    color: COLORS.orangeDark,
  },
  quantityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  totalPriceText: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.deepGreen,
  },
  metaTime: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  batchesBox: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: COLORS.canvas,
  },
  batchesLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
  },
  batchesValue: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    marginTop: 2,
  },
  undoConfirmBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
    backgroundColor: COLORS.amberLight,
  },
  undoConfirmTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.amberDark,
  },
  undoConfirmBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  undoConfirmYesBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  undoConfirmYesText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  undoConfirmCancelBtn: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  undoConfirmCancelText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  undoTriggerBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: COLORS.dangerLight,
  },
  undoBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  undoTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.danger,
  },
});
