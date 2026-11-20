/**
 * Screen: NotificationsScreen
 * Reference: docs/design/mobile/05-alerts/notification_mobile.png
 * Features:
 * - Estimated Value at Risk cards (Expired & Near Expiry) with left icons
 * - Filter chips (All, Low Stock, Near Expiry, Expired)
 * - Detailed alert cards with FEFO days countdown and suggested actions
 * - Direct navigation to ProductDetail
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AlertCircle, Clock, Bell } from 'lucide-react-native';
import { useNavigation, useRoute, useFocusEffect, useScrollToTop, useIsFocused, RouteProp } from '@react-navigation/native';
import { MainTabParamList } from '../../navigation/types';
import { getInventoryAlerts } from '../../services/inventory';
import { InventoryAlert } from '../../types/inventory';
import { formatDisplayDate } from '../../utils/date';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useRealtime } from '../../services/realtime';
import {
  getSuggestedAction,
  formatExpirationDaysText,
} from '../../utils/suggestedActions';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

const RefreshControlComponent = RefreshControl as any;

type FilterKey = 'All' | 'Low Stock' | 'Near Expiry' | 'Expired';

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<MainTabParamList, 'AlertsTab'>>();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { width: screenWidth } = useWindowDimensions();
  const bgHeight = screenWidth * (856 / 402);
  const {
    near_expiry_days,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useStoreSettings();
  const isFocused = useIsFocused();
  const { dataVersion, status } = useRealtime();

  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>(
    route.params?.initialFilter || 'All'
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync selected filter whenever navigated to from the dashboard with an initialFilter
  useEffect(() => {
    if (route.params?.initialFilter) {
      setSelectedFilter(route.params.initialFilter);
    }
  }, [route.params?.initialFilter, route.params?.timestamp]);

  const loadData = async (isMounted = true) => {
    if (settingsLoading || settingsError) return;
    setError(null);
    try {
      const res = await getInventoryAlerts(near_expiry_days);
      if (!isMounted) return;

      if (res.kind === 'error') {
        setError(res.message);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setAlerts(res.alerts);
    } catch (err: any) {
      if (!isMounted) return;
      setError(err?.message || 'Unexpected network error fetching alerts');
    } finally {
      if (isMounted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      if (route.params?.initialFilter) {
        setSelectedFilter(route.params.initialFilter);
      }
      if (!settingsLoading && !settingsError) {
        loadData(isMounted);
      }
      return () => {
        isMounted = false;
      };
    }, [route.params?.initialFilter, route.params?.timestamp, settingsLoading, settingsError, near_expiry_days])
  );

  useEffect(() => {
    if (!settingsLoading && !settingsError) {
      loadData(true);
    }
  }, [near_expiry_days, settingsLoading, settingsError]);

  // Background silent refresh when data changes on another device
  useEffect(() => {
    if (!isFocused) return;
    if (dataVersion === 0) return;

    let isMounted = true;
    const run = async () => {
      await loadData(isMounted);
    };
    void run();

    return () => {
      isMounted = false;
    };
  }, [dataVersion, isFocused]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const navigateToProductDetail = (productId: string, productName?: string) => {
    navigation.navigate('InventoryTab', {
      screen: 'ProductDetail',
      params: { productId, productName },
    });
  };

  // Filter exact categories
  const lowStockAlerts = alerts.filter((a) => a.alert_type === 'low_stock');
  const nearExpiryAlerts = alerts.filter((a) => a.alert_type === 'near_expiry');
  const expiredAlerts = alerts.filter((a) => a.alert_type === 'expired');

  const filterOptions: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'All', label: 'All', count: alerts.length },
    { key: 'Near Expiry', label: 'Near Expiry', count: nearExpiryAlerts.length },
    { key: 'Expired', label: 'Expired', count: expiredAlerts.length },
    { key: 'Low Stock', label: 'Low Stock', count: lowStockAlerts.length },
  ];

  const filteredAlerts = alerts.filter((alert) => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Low Stock') return alert.alert_type === 'low_stock';
    if (selectedFilter === 'Near Expiry') return alert.alert_type === 'near_expiry';
    if (selectedFilter === 'Expired') return alert.alert_type === 'expired';
    return true;
  });

  // Calculate Value at Risk
  const formatPesos = (centavos: number) => {
    const pesos = centavos / 100;
    return pesos.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  let expiredCentavos = 0;
  let expiredMissingCount = 0;
  expiredAlerts.forEach((a) => {
    if (a.price === null || a.price === undefined) {
      expiredMissingCount++;
    } else {
      expiredCentavos += (a.batch_quantity_left ?? 0) * Math.round(Number(a.price) * 100);
    }
  });

  let nearExpiryCentavos = 0;
  let nearExpiryMissingCount = 0;
  nearExpiryAlerts.forEach((a) => {
    if (a.price === null || a.price === undefined) {
      nearExpiryMissingCount++;
    } else {
      nearExpiryCentavos += (a.batch_quantity_left ?? 0) * Math.round(Number(a.price) * 100);
    }
  });

  if (settingsLoading || (loading && !refreshing)) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading notifications...</Text>
      </SafeAreaView>
    );
  }

  if (settingsError || (error && !loading)) {
    return (
      <SafeAreaView style={styles.centerContainer}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error Loading Alerts</Text>
          <Text style={styles.errorText}>{settingsError || error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => (settingsError ? reloadSettings() : loadData(true))}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControlComponent
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
        >
          {/* Screen Background Image with Yellow Wave (scrolls naturally with content) */}
          <Image
            source={require('../../../assets/designs/screen-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Top Logo Row */}
          <View style={styles.topLogoRow}>
            <Image
              source={require('../../../assets/designs/shelfsafe-logo.jpg')}
              style={styles.screenLogo}
              resizeMode="contain"
            />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Notifications Center</Text>
            <Text style={styles.subtitle}>
              {status === 'live'
                ? 'Updates automatically when stock changes on another device.'
                : 'Pull down to refresh.'}
            </Text>
          </View>

        {/* Value at Risk Cards (Icons on the Left) */}
        <View style={styles.riskRow}>
          {/* Expired Loss */}
          <View style={styles.riskCardExpired}>
            <View style={styles.riskCardHeader}>
              <View style={[styles.riskIconBadge, { backgroundColor: COLORS.dangerLight }]}>
                <AlertCircle size={20} color={COLORS.danger} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riskTagExpired}>Estimated Loss</Text>
                <Text style={styles.riskAmountExpired}>₱{formatPesos(expiredCentavos)}</Text>
              </View>
            </View>
            <Text style={styles.riskSubExpired}>Expired inventory at risk</Text>
          </View>

          {/* Near Expiry Risk */}
          <View style={styles.riskCardNear}>
            <View style={styles.riskCardHeader}>
              <View style={[styles.riskIconBadge, { backgroundColor: COLORS.amberLight }]}>
                <Clock size={20} color={COLORS.amberDark} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.riskTagNear}>Value At Risk</Text>
                <Text style={styles.riskAmountNear}>₱{formatPesos(nearExpiryCentavos)}</Text>
              </View>
            </View>
            <Text style={styles.riskSubNear}>Near-expiry batches</Text>
          </View>
        </View>

        {/* Filter Chips */}
        <View style={styles.chipSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {filterOptions.map((opt) => {
                const isSelected = selectedFilter === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    onPress={() => setSelectedFilter(opt.key)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        isSelected && styles.filterChipTextActive,
                      ]}
                    >
                      {opt.label} ({opt.count})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Alerts Feed */}
        <View style={styles.feedSection}>
          {filteredAlerts.length === 0 ? (
            <View style={styles.emptyCard}>
              <Bell size={40} color={COLORS.textTertiary} strokeWidth={1.5} />
              <Text style={styles.emptyTitle}>No active alerts</Text>
              <Text style={styles.emptySub}>
                Your inventory looks great! No items need immediate attention.
              </Text>
            </View>
          ) : (
            filteredAlerts.map((alert, idx) => {
              const isExpired = alert.alert_type === 'expired';
              const isNearExpiry = alert.alert_type === 'near_expiry';
              const isLowStock = alert.alert_type === 'low_stock';

              const badgeBg = isExpired
                ? COLORS.dangerLight
                : isNearExpiry
                ? COLORS.amberLight
                : COLORS.orangeLight;
              const badgeColor = isExpired
                ? COLORS.danger
                : isNearExpiry
                ? COLORS.amberDark
                : COLORS.orangeDark;
              const badgeLabel = isExpired
                ? 'Expired'
                : isNearExpiry
                ? 'Near Expiry'
                : 'Low Stock';

              const batchCode = alert.batch_id
                ? alert.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase()
                : null;

              const daysText = isExpired
                ? formatExpirationDaysText(alert.days_until_expiration, true)
                : isNearExpiry
                ? formatExpirationDaysText(alert.days_until_expiration, false)
                : null;

              const suggestedAction = getSuggestedAction(alert);

              return (
                <TouchableOpacity
                  key={`${alert.product_id}-${alert.batch_id || idx}-${alert.alert_type}`}
                  style={styles.alertCard}
                  activeOpacity={0.7}
                  onPress={() =>
                    navigateToProductDetail(alert.product_id, alert.product_name)
                  }
                >
                  <View style={styles.alertCardTop}>
                    <View style={styles.alertTitleRow}>
                      <Text style={styles.alertProdName} numberOfLines={1}>
                        {alert.product_name}
                      </Text>
                    </View>

                    <View style={[styles.alertBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.alertBadgeText, { color: badgeColor }]}>
                        {badgeLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Details Row */}
                  {isLowStock ? (
                    <Text style={styles.alertDesc}>
                      Only{' '}
                      <Text style={{ fontWeight: 'bold' }}>
                        {alert.current_stock ?? 0} sellable units
                      </Text>{' '}
                      left (alert threshold: {alert.low_stock_level ?? 5} units).
                    </Text>
                  ) : (
                    <View style={styles.batchInfoRow}>
                      <Text style={styles.batchCodePill}>B-{batchCode || 'N/A'}</Text>
                      <Text style={styles.alertDescInline}>
                        <Text style={{ fontWeight: 'bold' }}>
                          {alert.batch_quantity_left ?? 0} units
                        </Text>{' '}
                        left • <Text style={{ color: badgeColor, fontWeight: '700' }}>{daysText}</Text>
                      </Text>
                    </View>
                  )}

                  {alert.expiration_date && (
                    <Text style={styles.expiryDetailText}>
                      Expires: {formatDisplayDate(alert.expiration_date)}
                    </Text>
                  )}

                  {/* Suggested Action Pill */}
                  {suggestedAction ? (
                    <View style={styles.suggestedBox}>
                      <Text style={styles.suggestedLabel}>Action:</Text>
                      <Text style={styles.suggestedText}>{suggestedAction}</Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.canvas,
  },
  safeArea: {
    flex: 1,
  },
  bgImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.canvas,
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  errorBox: {
    backgroundColor: COLORS.dangerLight,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.dangerDark,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    color: COLORS.dangerDark,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: 36,
  },
  topLogoRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 6,
  },
  screenLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  riskRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  riskCardExpired: {
    flex: 1,
    backgroundColor: '#fff8f8',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  riskCardNear: {
    flex: 1,
    backgroundColor: '#fffdf5',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.amberBorder,
  },
  riskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  riskIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskIcon: {
    fontSize: 14,
  },
  riskTagExpired: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.danger,
    textTransform: 'uppercase',
  },
  riskAmountExpired: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.danger,
  },
  riskSubExpired: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  riskTagNear: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.amberDark,
    textTransform: 'uppercase',
  },
  riskAmountNear: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.amberDark,
  },
  riskSubNear: {
    fontSize: 10,
    color: COLORS.textMuted,
  },
  chipSection: {
    marginBottom: 14,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  feedSection: {
    gap: 10,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptySub: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  alertCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  alertCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertTitleRow: {
    flex: 1,
    marginRight: 8,
  },
  alertProdName: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  alertDesc: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 6,
    lineHeight: 17,
  },
  batchInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  batchCodePill: {
    backgroundColor: COLORS.bgWarm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSubtle,
  },
  alertDescInline: {
    fontSize: 12,
    color: COLORS.text,
  },
  expiryDetailText: {
    fontSize: 11,
    color: COLORS.textSubtle,
    marginBottom: 8,
  },
  suggestedBox: {
    backgroundColor: COLORS.bgWarm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestedLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
    textTransform: 'uppercase',
  },
  suggestedText: {
    fontSize: 11,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    flex: 1,
  },
});
