/**
 * Screen: DashboardScreen
 * Reference: docs/design/mobile/02-home/dashboard_mobile.png
 * Elements:
 * - Dynamic greeting with signed-in user's name ("Hello, {name}!")
 * - "View Inventory" CTA button banner
 * - Stock Overview cards (Total Products, Total Units, Near Expiry, Expired, Low Stock) with icons on left
 * - Units Sold with Daily / Weekly / Monthly toggle
 * - Important Alerts preview (expired first, near expiry by soonest date, then low stock) with "See all"
 * - Top 5 Lists: Most-stocked, Most-sold, Least-sold
 * - Pull-to-refresh and loading skeleton
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  Package,
  BarChart2,
  Clock,
  AlertCircle,
  TrendingDown,
  ArrowRight,
} from 'lucide-react-native';
import { useNavigation, useFocusEffect, useScrollToTop, useIsFocused } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import {
  getInventory,
  getInventoryAlerts,
  getSalesMetrics,
  getMostStockedProducts,
  getMostSoldProducts,
  getLeastSoldProducts,
} from '../../services/inventory';
import {
  ProductWithBatches,
  InventoryAlert,
  SalesMetrics,
  MostStockedProduct,
  MostSoldProduct,
  LeastSoldProduct,
} from '../../types/inventory';
import { useStoreSettings } from '../../context/StoreSettingsContext';
import { useRealtime } from '../../services/realtime';
import { formatExpirationDaysText } from '../../utils/suggestedActions';
import { COLORS, FONTS, SCREEN_PADDING } from '../../theme';

const RefreshControlComponent = RefreshControl as any;

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const scrollRef = useRef<ScrollView>(null);
  useScrollToTop(scrollRef);
  const { width: screenWidth } = useWindowDimensions();
  const bgScale = screenWidth / 402;
  const bgHeight = screenWidth * (856 / 402);
  const {
    near_expiry_days,
    store_name,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useStoreSettings();
  const isFocused = useIsFocused();
  const { dataVersion } = useRealtime();
  const [displayName, setDisplayName] = useState('');
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');

  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [mostStocked, setMostStocked] = useState<MostStockedProduct[]>([]);
  const [mostSold, setMostSold] = useState<MostSoldProduct[]>([]);
  const [leastSold, setLeastSold] = useState<LeastSoldProduct[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshUser = useCallback(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.name ||
          (user.email ? user.email.split('@')[0] : 'Operator');
        setDisplayName(name);
      }
    });
  }, []);

  const loadData = useCallback(
    async (isManualRefresh = false) => {
      if (!isManualRefresh) {
        setLoading(true);
      }
      setError(null);

      const [
        invRes,
        alertsRes,
        metricsRes,
        mostStockedRes,
        mostSoldRes,
        leastSoldRes,
      ] = await Promise.all([
        getInventory(near_expiry_days),
        getInventoryAlerts(near_expiry_days),
        getSalesMetrics(),
        getMostStockedProducts(5),
        getMostSoldProducts(5),
        getLeastSoldProducts(5),
      ]);

      setLoading(false);
      setRefreshing(false);

      if (invRes.kind === 'error') {
        setError(`Failed to load inventory: ${invRes.message}`);
        return;
      }
      if (alertsRes.kind === 'error') {
        setError(`Failed to load inventory alerts: ${alertsRes.message}`);
        return;
      }
      if (metricsRes.kind === 'error') {
        setError(`Failed to load sales metrics: ${metricsRes.message}`);
        return;
      }
      if (mostStockedRes.kind === 'error') {
        setError(`Failed to load most-stocked products: ${mostStockedRes.message}`);
        return;
      }
      if (mostSoldRes.kind === 'error') {
        setError(`Failed to load most-sold products: ${mostSoldRes.message}`);
        return;
      }
      if (leastSoldRes.kind === 'error') {
        setError(`Failed to load least-sold products: ${leastSoldRes.message}`);
        return;
      }

      setProducts(invRes.products);
      setAlerts(alertsRes.alerts);
      setMetrics(metricsRes.metrics);
      setMostStocked(mostStockedRes.products);
      setMostSold(mostSoldRes.products);
      setLeastSold(leastSoldRes.products);
    },
    [near_expiry_days]
  );

  useFocusEffect(
    useCallback(() => {
      refreshUser();
      if (!settingsLoading && !settingsError) {
        loadData(true);
      }
    }, [refreshUser, loadData, settingsLoading, settingsError])
  );

  useEffect(() => {
    if (!settingsLoading && !settingsError) {
      loadData(true);
    }
  }, [near_expiry_days, settingsLoading, settingsError, loadData]);

  // Background silent refresh when data changes on another device
  useEffect(() => {
    if (!isFocused) return;
    if (dataVersion === 0) return;

    let isMounted = true;
    const run = async () => {
      if (!isMounted) return;
      await loadData(true);
    };
    void run();

    return () => {
      isMounted = false;
    };
  }, [dataVersion, isFocused, loadData]);

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

  // Stock Overview totals
  const totalProducts = products.length;
  const totalUnits = products.reduce((acc, p) => acc + p.total_units, 0);

  // Exact alert counts derived from ONE SOURCE OF TRUTH (get_inventory_alerts)
  const lowStockAlerts = alerts.filter((a) => a.alert_type === 'low_stock');
  const nearExpiryAlerts = alerts.filter((a) => a.alert_type === 'near_expiry');
  const expiredAlerts = alerts.filter((a) => a.alert_type === 'expired');

  const lowStockCount = lowStockAlerts.length;
  const nearExpiryCount = nearExpiryAlerts.length;
  const expiredCount = expiredAlerts.length;

  // Important alerts: 4 most urgent alerts
  const sortedExpired = [...expiredAlerts].sort(
    (a, b) => (a.days_until_expiration ?? 0) - (b.days_until_expiration ?? 0)
  );
  const sortedNearExpiry = [...nearExpiryAlerts].sort(
    (a, b) => (a.days_until_expiration ?? 0) - (b.days_until_expiration ?? 0)
  );
  const sortedLowStock = [...lowStockAlerts].sort(
    (a, b) => (a.current_stock ?? 0) - (b.current_stock ?? 0)
  );
  const importantAlerts = [
    ...sortedExpired,
    ...sortedNearExpiry,
    ...sortedLowStock,
  ].slice(0, 4);

  const hasAnySales = mostSold.some((p) => Number(p.total_sold) > 0);

  const soldToday = metrics?.sold_today ?? 0;
  const soldThisWeek = metrics?.sold_this_week ?? 0;
  const soldThisMonth = metrics?.sold_this_month ?? 0;

  const currentSoldValue =
    period === 'Daily' ? soldToday : period === 'Weekly' ? soldThisWeek : soldThisMonth;

  if (settingsLoading || (loading && !refreshing)) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right', 'bottom']}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </SafeAreaView>
    );
  }

  if (settingsError || (error && !loading)) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
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
            source={require('../../../assets/designs/dashboard-background.png')}
            style={[styles.bgImage, { width: screenWidth, height: bgHeight }]}
            resizeMode="stretch"
          />

          {/* Top Header Bar */}
          <View style={styles.header}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.greetingTitle}>Hello, {displayName || 'Operator'}!</Text>
              <Text style={styles.storeSubtitle}>
                {store_name || 'Retail Inventory'}
              </Text>
            </View>
            <Image
              source={require('../../../assets/designs/shelfsafe-logo.jpg')}
              style={styles.headerSymbol}
              resizeMode="contain"
            />
          </View>

          {/* Responsive Wave Clearance: lowers the section and keeps decorative wave unobstructed */}
          <View style={{ height: Math.max(28, (200 - 117) * bgScale + 8) }} />

          {/* Quick CTA Action Banner */}
        <TouchableOpacity
          style={styles.actionBanner}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('InventoryTab')}
        >
          <View style={styles.actionBannerLeft}>
            <View style={styles.actionBannerIconWrapper}>
              <Package size={20} color={COLORS.primary} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.actionBannerTitle}>Store Inventory</Text>
              <Text style={styles.actionBannerSub}>
                {totalProducts} products • {totalUnits} total units in stock
              </Text>
            </View>
          </View>
          <ArrowRight size={18} color={COLORS.textMuted} strokeWidth={2.2} />
        </TouchableOpacity>

        {/* Section: Stock Overview KPI Cards (Icons on the Left) */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Stock Overview</Text>

          {/* Top 2 large metric cards */}
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: COLORS.bgTint }]}>
                <Package size={20} color={COLORS.primary} strokeWidth={2} />
              </View>
              <View style={styles.kpiInfo}>
                <Text style={styles.kpiLabel}>Total Products</Text>
                <Text style={styles.kpiValue}>{totalProducts}</Text>
              </View>
            </View>

            <View style={styles.kpiCard}>
              <View style={[styles.kpiIconWrapper, { backgroundColor: '#f1f5f9' }]}>
                <BarChart2 size={20} color={COLORS.text} strokeWidth={2} />
              </View>
              <View style={styles.kpiInfo}>
                <Text style={styles.kpiLabel}>Total Units</Text>
                <Text style={styles.kpiValue}>{totalUnits}</Text>
              </View>
            </View>
          </View>

          {/* Bottom 3 status cards */}
          <View style={styles.statusRow}>
            {/* Near Expiry */}
            <TouchableOpacity
              style={[styles.statusCard, { borderColor: COLORS.amberBorder, backgroundColor: '#fffdf5' }]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('AlertsTab', {
                  initialFilter: 'Near Expiry',
                  timestamp: Date.now(),
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Near Expiry: ${nearExpiryCount} batches`}
            >
              <View style={[styles.statusIconBadge, { backgroundColor: COLORS.amberLight }]}>
                <Clock size={16} color={COLORS.amberDark} strokeWidth={2.2} />
              </View>
              <Text style={[styles.statusValue, { color: COLORS.amberDark }]}>{nearExpiryCount}</Text>
              <Text style={styles.statusLabel}>Near Expiry</Text>
            </TouchableOpacity>

            {/* Expired */}
            <TouchableOpacity
              style={[styles.statusCard, { borderColor: COLORS.dangerBorder, backgroundColor: '#fff8f8' }]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('AlertsTab', {
                  initialFilter: 'Expired',
                  timestamp: Date.now(),
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Expired: ${expiredCount} batches`}
            >
              <View style={[styles.statusIconBadge, { backgroundColor: COLORS.dangerLight }]}>
                <AlertCircle size={16} color={COLORS.danger} strokeWidth={2.2} />
              </View>
              <Text style={[styles.statusValue, { color: COLORS.danger }]}>{expiredCount}</Text>
              <Text style={styles.statusLabel}>Expired</Text>
            </TouchableOpacity>

            {/* Low Stock */}
            <TouchableOpacity
              style={[styles.statusCard, { borderColor: COLORS.orangeBorder, backgroundColor: '#fffaf5' }]}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('AlertsTab', {
                  initialFilter: 'Low Stock',
                  timestamp: Date.now(),
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`Low Stock: ${lowStockCount} products`}
            >
              <View style={[styles.statusIconBadge, { backgroundColor: COLORS.orangeLight }]}>
                <TrendingDown size={16} color={COLORS.orangeDark} strokeWidth={2.2} />
              </View>
              <Text style={[styles.statusValue, { color: COLORS.orangeDark }]}>{lowStockCount}</Text>
              <Text style={styles.statusLabel}>Low Stock</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Section: Units Sold with Period Segment Toggle */}
        <View style={styles.unitsSoldCard}>
          <View style={styles.unitsSoldHeader}>
            <View>
              <Text style={styles.unitsSoldTitle}>Units Sold</Text>
              <Text style={styles.unitsSoldSub}>Earliest expiry tracking</Text>
            </View>

            {/* Toggle (Daily / Weekly / Monthly) */}
            <View style={styles.segmentedToggle}>
              {(['Daily', 'Weekly', 'Monthly'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.toggleButton,
                    period === p && styles.toggleButtonActive,
                  ]}
                  onPress={() => setPeriod(p)}
                >
                  <Text
                    style={[
                      styles.toggleButtonText,
                      period === p && styles.toggleButtonTextActive,
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.unitsSoldValueRow}>
            <Text style={styles.unitsSoldLargeValue}>{currentSoldValue}</Text>
            <Text style={styles.unitsSoldUnitLabel}>units deducted</Text>
          </View>
        </View>

        {/* Section: Urgent Expiry Alerts Preview */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeader}>Urgent Alerts</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('AlertsTab')}
              style={styles.seeAllButton}
            >
              <Text style={styles.seeAllLink}>See all ({alerts.length})</Text>
              <ArrowRight size={13} color={COLORS.primary} strokeWidth={2.4} style={{ marginLeft: 3 }} />
            </TouchableOpacity>
          </View>

          {importantAlerts.length === 0 ? (
            <View style={styles.emptyAlertsBox}>
              <Text style={styles.emptyAlertsText}>
                No near-expiry, expired, or low stock items right now.
              </Text>
            </View>
          ) : (
            <View style={styles.alertsList}>
              {importantAlerts.map((alert, index) => {
                const isExp = alert.alert_type === 'expired';
                const isNear = alert.alert_type === 'near_expiry';
                const badgeBg = isExp
                  ? COLORS.dangerLight
                  : isNear
                  ? COLORS.amberLight
                  : COLORS.orangeLight;
                const badgeColor = isExp
                  ? COLORS.danger
                  : isNear
                  ? COLORS.amberDark
                  : COLORS.orangeDark;
                const badgeLabel = isExp
                  ? 'Expired'
                  : isNear
                  ? 'Near Expiry'
                  : 'Low Stock';

                const daysText =
                  isExp || isNear
                    ? formatExpirationDaysText(alert.days_until_expiration, isExp)
                    : `Threshold: ${alert.low_stock_level ?? 5} units`;

                return (
                  <TouchableOpacity
                    key={`${alert.alert_type}-${alert.product_id}-${alert.batch_id || index}`}
                    style={styles.alertCard}
                    activeOpacity={0.7}
                    onPress={() =>
                      navigateToProductDetail(alert.product_id, alert.product_name)
                    }
                  >
                    <View style={styles.alertCardTop}>
                      <View style={[styles.alertBadge, { backgroundColor: badgeBg }]}>
                        <Text style={[styles.alertBadgeText, { color: badgeColor }]}>
                          {badgeLabel}
                        </Text>
                      </View>
                      {alert.batch_id && (
                        <Text style={styles.alertBatchCode}>
                          B-{alert.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <Text style={styles.alertProductName} numberOfLines={1}>
                      {alert.product_name}
                    </Text>

                    <View style={styles.alertFooter}>
                      <Text style={styles.alertStockInfo}>
                        <Text style={styles.alertStockBold}>
                          {isExp || isNear
                            ? alert.batch_quantity_left ?? 0
                            : alert.current_stock ?? 0}
                        </Text>{' '}
                        units left
                      </Text>
                      <Text style={[styles.alertDaysText, { color: badgeColor }]}>
                        {daysText}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Section: Sales Rankings Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Top Stocked Products</Text>

          {/* Most Stocked */}
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Top Stocked Products</Text>
            {mostStocked.slice(0, 3).map((item, idx) => (
              <TouchableOpacity
                key={item.product_id}
                style={styles.breakdownRow}
                onPress={() => navigateToProductDetail(item.product_id, item.product_name)}
              >
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                </View>
                <Text style={styles.breakdownName} numberOfLines={1}>
                  {item.product_name}
                </Text>
                <Text style={styles.breakdownValue}>{item.total_stock} units</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dashboardCanvas,
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
    backgroundColor: COLORS.dashboardCanvas,
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
    fontFamily: FONTS.extraBold,
    color: COLORS.dangerDark,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    fontFamily: FONTS.regular,
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
    fontFamily: FONTS.bold,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTextGroup: {
    flex: 1,
    marginRight: 12,
  },
  greetingTitle: {
    fontSize: 25,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.4,
  },
  storeSubtitle: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  fefoBadge: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  headerSymbol: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  actionBanner: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  actionBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBannerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBannerIcon: {
    fontSize: 18,
  },
  actionBannerTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
  },
  actionBannerSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontFamily: FONTS.medium,
    marginTop: 2,
  },
  actionBannerArrow: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: 8,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.primary,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIcon: {
    fontSize: 18,
  },
  kpiInfo: {
    flex: 1,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.text,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statusCard: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  statusIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  statusIcon: {
    fontSize: 14,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '900',
    fontFamily: FONTS.black,
  },
  statusLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  unitsSoldCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  unitsSoldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  unitsSoldTitle: {
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    color: COLORS.text,
  },
  unitsSoldSub: {
    fontSize: 11,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.bgWarm,
    borderRadius: 10,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  toggleButtonText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
  },
  toggleButtonTextActive: {
    color: COLORS.white,
    fontWeight: '700',
  },
  unitsSoldValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 12,
  },
  unitsSoldLargeValue: {
    fontSize: 32,
    fontWeight: '900',
    fontFamily: FONTS.black,
    color: COLORS.text,
  },
  unitsSoldUnitLabel: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  emptyAlertsBox: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  emptyAlertsText: {
    fontSize: 12,
    fontFamily: FONTS.medium,
    color: COLORS.textMuted,
  },
  alertsList: {
    gap: 10,
  },
  alertCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  alertCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  alertBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: FONTS.extraBold,
    textTransform: 'uppercase',
  },
  alertBatchCode: {
    fontSize: 11,
    fontFamily: FONTS.semiBold,
    color: COLORS.textSubtle,
    backgroundColor: COLORS.bgWarm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  alertProductName: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 6,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertStockInfo: {
    fontSize: 12,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
  },
  alertStockBold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  alertDaysText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.bold,
  },
  breakdownCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  breakdownTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.text,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: COLORS.bgTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  rankText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.primary,
  },
  breakdownName: {
    flex: 1,
    fontSize: 13,
    fontFamily: FONTS.medium,
    color: COLORS.text,
  },
  breakdownValue: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.bold,
    color: COLORS.textMuted,
  },
});
