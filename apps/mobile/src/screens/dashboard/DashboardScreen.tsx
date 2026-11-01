/**
 * Screen: DashboardScreen
 * Reference: docs/design/02-dashboard.png
 * Elements:
 * - Dynamic greeting with signed-in user's name ("Hello, {name}!")
 * - "View Inventory" CTA button
 * - Stock Overview cards:
 *   1. Total Products (totals of all non-archived products, matching Inventory header)
 *   2. Total Units (totals of all non-archived products, matching Inventory header)
 *   3. Low stock (products) (alert count from get_inventory_alerts)
 *   4. Near expiry (batches) (alert count from get_inventory_alerts)
 *   5. Expired (batches) (alert count from get_inventory_alerts)
 * - Units Sold with Daily / Weekly / Monthly toggle
 * - Important Alerts preview (top 4 urgent alerts: expired first, near expiry by soonest date, then low stock) with "See all" link
 * - Top 5 Lists: Most-stocked, Most-sold, Least-sold ("No sales yet" when no sales exist; undone sales never count)
 * - Low Stock, Near Expiry, and Expired sections showing top items with "See all" links
 * - useFocusEffect, pull-to-refresh, loading state, and error with Retry
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Button,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import { formatExpirationDaysText } from '../../utils/suggestedActions';

const RefreshControlComponent = RefreshControl as any;

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const {
    near_expiry_days,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useStoreSettings();
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
          (user.email ? user.email.split('@')[0] : 'User');
        setDisplayName(name);
      }
    });
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const loadData = async (isMounted = true) => {
    if (settingsLoading || settingsError) return;
    setError(null);
    try {
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

      if (!isMounted) return;

      if (invRes.kind === 'error') {
        setError(`Failed to load inventory: ${invRes.message}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (alertsRes.kind === 'error') {
        setError(`Failed to load alerts: ${alertsRes.message}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (metricsRes.kind === 'error') {
        setError(`Failed to load sales metrics: ${metricsRes.message}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (mostStockedRes.kind === 'error') {
        setError(`Failed to load most-stocked products: ${mostStockedRes.message}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (mostSoldRes.kind === 'error') {
        setError(`Failed to load most-sold products: ${mostSoldRes.message}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (leastSoldRes.kind === 'error') {
        setError(`Failed to load least-sold products: ${leastSoldRes.message}`);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setProducts(invRes.products);
      setAlerts(alertsRes.alerts);
      setMetrics(metricsRes.metrics);
      setMostStocked(mostStockedRes.products);
      setMostSold(mostSoldRes.products);
      setLeastSold(leastSoldRes.products);
    } catch (err: any) {
      if (!isMounted) return;
      setError(err?.message || 'Unexpected network error loading dashboard');
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
      refreshUser();
      if (!settingsLoading && !settingsError) {
        loadData(isMounted);
      }
      return () => {
        isMounted = false;
      };
    }, [refreshUser, settingsLoading, settingsError, near_expiry_days])
  );

  useEffect(() => {
    if (!settingsLoading && !settingsError) {
      loadData(true);
    }
  }, [near_expiry_days, settingsLoading, settingsError]);

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

  // Important alerts: 4 most urgent alerts (expired first, then near expiry by soonest date, then low stock)
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

  // Sales existence check: if there are no sales at all across all products, both most-sold and least-sold show "No sales yet."
  const hasAnySales = mostSold.some((p) => Number(p.total_sold) > 0);

  // Units sold period display
  const soldToday = metrics?.sold_today ?? 0;
  const soldThisWeek = metrics?.sold_this_week ?? 0;
  const soldThisMonth = metrics?.sold_this_month ?? 0;

  const getPeriodSubtitle = () => {
    if (period === 'Daily') {
      return soldToday === 0 ? 'No sold items today' : `${soldToday} sold item(s) today`;
    }
    if (period === 'Weekly') {
      return soldThisWeek === 0 ? 'No sold items this week' : `${soldThisWeek} sold item(s) this week`;
    }
    return soldThisMonth === 0 ? 'No sold items this month' : `${soldThisMonth} sold item(s) this month`;
  };

  if (settingsLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={{ marginTop: 12, color: 'gray' }}>Loading store settings...</Text>
      </View>
    );
  }

  if (settingsError) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Failed to load store settings</Text>
        <Text style={styles.errorMessage}>{settingsError}</Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Retry" onPress={reloadSettings} color="#2e7d32" />
        </View>
      </View>
    );
  }

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={{ marginTop: 12, color: 'gray' }}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error && !loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error Loading Dashboard</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <View style={{ marginTop: 16 }}>
          <Button title="Retry" onPress={() => loadData(true)} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControlComponent refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Text style={styles.screenTitle}>Dashboard</Text>

      {/* Greeting Header */}
      <View style={{ marginTop: 12 }}>
        <Text style={styles.greetingTitle}>Hello, {displayName}!</Text>
        <Text style={styles.subtitle}>Start keeping your shelves in check.</Text>
      </View>

      {/* CTA Button */}
      <View style={{ marginTop: 16 }}>
        <Button
          title="View Inventory"
          onPress={() => navigation.navigate('InventoryTab')}
        />
      </View>

      {/* Stock Overview Cards */}
      <View style={{ marginTop: 24 }}>
        <Text style={styles.sectionHeader}>Stock Overview</Text>
        <View style={styles.overviewRow}>
          <View style={styles.cardLarge}>
            <Text style={styles.cardLabel}>Total Products</Text>
            <Text style={styles.cardValueLarge}>{totalProducts}</Text>
          </View>
          <View style={styles.cardLarge}>
            <Text style={styles.cardLabel}>Total Units</Text>
            <Text style={styles.cardValueLarge}>{totalUnits}</Text>
          </View>
        </View>
        <View style={styles.overviewSmallRow}>
          <View style={[styles.cardSmall, { borderColor: '#ffeeba', backgroundColor: '#fffdf5' }]}>
            <Text style={styles.cardLabelSmall}>Low stock (products)</Text>
            <Text style={styles.cardValueSmall}>{lowStockCount}</Text>
          </View>
          <View style={[styles.cardSmall, { borderColor: '#ffeeba', backgroundColor: '#fffdf5' }]}>
            <Text style={styles.cardLabelSmall}>Near expiry (batches)</Text>
            <Text style={styles.cardValueSmall}>{nearExpiryCount}</Text>
          </View>
          <View style={[styles.cardSmall, { borderColor: '#f5c6cb', backgroundColor: '#fff5f5' }]}>
            <Text style={styles.cardLabelSmall}>Expired (batches)</Text>
            <Text style={[styles.cardValueSmall, { color: '#721c24' }]}>
              {expiredCount}
            </Text>
          </View>
        </View>
      </View>

      {/* Units Sold Metrics */}
      <View style={{ marginTop: 24 }}>
        <Text style={styles.sectionHeader}>Unit Sold</Text>
        <View style={styles.toggleRow}>
          <Button
            title={period === 'Daily' ? '• Daily' : 'Daily'}
            onPress={() => setPeriod('Daily')}
          />
          <Button
            title={period === 'Weekly' ? '• Weekly' : 'Weekly'}
            onPress={() => setPeriod('Weekly')}
          />
          <Button
            title={period === 'Monthly' ? '• Monthly' : 'Monthly'}
            onPress={() => setPeriod('Monthly')}
          />
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{soldToday}</Text>
            <Text style={styles.cardLabel}>Today</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{soldThisWeek}</Text>
            <Text style={styles.cardLabel}>This week</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{soldThisMonth}</Text>
            <Text style={styles.cardLabel}>This month</Text>
          </View>
        </View>
        <Text style={styles.periodNote}>{getPeriodSubtitle()}</Text>
      </View>

      {/* Important Alerts */}
      <View style={{ marginTop: 24 }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Important alerts</Text>
          <Button title="See all" onPress={() => navigation.navigate('AlertsTab')} />
        </View>
        <View style={{ marginTop: 8, gap: 8 }}>
          {importantAlerts.length === 0 ? (
            <Text style={styles.emptyText}>No urgent alerts. Your shelves look good.</Text>
          ) : (
            importantAlerts.map((item, idx) => {
              const isExpired = item.alert_type === 'expired';
              const isNearExpiry = item.alert_type === 'near_expiry';
              const badgeLabel = isExpired
                ? 'Expired batch'
                : isNearExpiry
                ? 'Near expiry'
                : 'Low Stock';
              const cardBorder = isExpired ? '#f5c6cb' : '#ffeeba';
              const cardBg = isExpired ? '#fff5f5' : '#fffdf5';
              const labelColor = isExpired ? '#721c24' : '#856404';

              const infoLine = isExpired
                ? `${formatExpirationDaysText(item.days_until_expiration, true)} (${item.batch_quantity_left ?? 0} units left)`
                : isNearExpiry
                ? `${formatExpirationDaysText(item.days_until_expiration, false)} (${item.batch_quantity_left ?? 0} units left)`
                : `Only ${item.current_stock ?? 0} sellable unit(s) left (threshold ${item.low_stock_level ?? 5})`;

              return (
                <TouchableOpacity
                  key={`${item.product_id}-${item.batch_id || idx}-${item.alert_type}`}
                  style={[styles.alertCard, { borderColor: cardBorder, backgroundColor: cardBg }]}
                  onPress={() => navigateToProductDetail(item.product_id, item.product_name)}
                >
                  <View style={styles.rowBetween}>
                    <Text style={styles.alertProductName}>{item.product_name}</Text>
                    <Text style={[styles.alertBadgeText, { color: labelColor }]}>
                      [{badgeLabel}]
                    </Text>
                  </View>
                  <Text style={styles.alertDetail}>{infoLine}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </View>

      {/* Most-Stocked (Top 5) */}
      <View style={{ marginTop: 24 }}>
        <Text style={styles.sectionHeader}>Most-stocked</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          {mostStocked.length === 0 ? (
            <Text style={styles.emptyText}>No stocked products yet.</Text>
          ) : (
            mostStocked.map((prod) => (
              <TouchableOpacity
                key={prod.product_id}
                style={styles.listItem}
                onPress={() => navigateToProductDetail(prod.product_id, prod.product_name)}
              >
                <Text style={styles.itemTitle}>• {prod.product_name}</Text>
                <Text style={styles.itemValue}>{prod.total_stock} units</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Most-Sold (Top 5) */}
      <View style={{ marginTop: 24 }}>
        <Text style={styles.sectionHeader}>Most-sold</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          {!hasAnySales ? (
            <Text style={styles.emptyText}>No sales yet.</Text>
          ) : (
            mostSold.map((prod) => (
              <TouchableOpacity
                key={prod.product_id}
                style={styles.listItem}
                onPress={() => navigateToProductDetail(prod.product_id, prod.product_name)}
              >
                <Text style={styles.itemTitle}>• {prod.product_name}</Text>
                <Text style={styles.itemValue}>{prod.total_sold} sold</Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Least-Sold (Top 5) */}
      <View style={{ marginTop: 24 }}>
        <Text style={styles.sectionHeader}>Least sold</Text>
        <View style={{ marginTop: 8, gap: 6 }}>
          {!hasAnySales ? (
            <Text style={styles.emptyText}>No sales yet.</Text>
          ) : (
            leastSold.map((prod) => (
              <TouchableOpacity
                key={prod.product_id}
                style={styles.listItem}
                onPress={() => navigateToProductDetail(prod.product_id, prod.product_name)}
              >
                <Text style={styles.itemTitle}>• {prod.product_name}</Text>
                <Text style={styles.itemValue}>
                  {prod.total_sold} sold ({prod.total_stock} in stock)
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Low Stock Section */}
      <View style={{ marginTop: 24 }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Low Stock</Text>
          <Button title="See all" onPress={() => navigation.navigate('AlertsTab')} />
        </View>
        <View style={{ marginTop: 8, gap: 6 }}>
          {lowStockAlerts.length === 0 ? (
            <Text style={styles.emptyText}>No low stock products.</Text>
          ) : (
            lowStockAlerts.slice(0, 5).map((item) => (
              <TouchableOpacity
                key={item.product_id}
                style={styles.listItem}
                onPress={() => navigateToProductDetail(item.product_id, item.product_name)}
              >
                <Text style={styles.itemTitle}>• {item.product_name}</Text>
                <Text style={styles.itemValue}>
                  {item.current_stock ?? 0} left (threshold {item.low_stock_level ?? 5})
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Near Expiry Section */}
      <View style={{ marginTop: 24 }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Near Expiry</Text>
          <Button title="See all" onPress={() => navigation.navigate('AlertsTab')} />
        </View>
        <View style={{ marginTop: 8, gap: 6 }}>
          {nearExpiryAlerts.length === 0 ? (
            <Text style={styles.emptyText}>No near expiry batches.</Text>
          ) : (
            nearExpiryAlerts.slice(0, 5).map((item, idx) => (
              <TouchableOpacity
                key={`${item.product_id}-${item.batch_id || idx}`}
                style={styles.listItem}
                onPress={() => navigateToProductDetail(item.product_id, item.product_name)}
              >
                <Text style={styles.itemTitle}>• {item.product_name}</Text>
                <Text style={styles.itemValue}>
                  {item.batch_quantity_left ?? 0} units (
                  {formatExpirationDaysText(item.days_until_expiration, false)})
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>

      {/* Expired Section */}
      <View style={{ marginTop: 24, marginBottom: 40 }}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeader}>Expired</Text>
          <Button title="See all" onPress={() => navigation.navigate('AlertsTab')} />
        </View>
        <View style={{ marginTop: 8, gap: 6 }}>
          {expiredAlerts.length === 0 ? (
            <Text style={styles.emptyText}>No expired batches.</Text>
          ) : (
            expiredAlerts.slice(0, 5).map((item, idx) => (
              <TouchableOpacity
                key={`${item.product_id}-${item.batch_id || idx}`}
                style={styles.listItem}
                onPress={() => navigateToProductDetail(item.product_id, item.product_name)}
              >
                <Text style={styles.itemTitle}>• {item.product_name}</Text>
                <Text style={styles.itemValue}>
                  {item.batch_quantity_left ?? 0} units (
                  {formatExpirationDaysText(item.days_until_expiration, true)})
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  centerContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  subtitle: {
    color: 'gray',
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  overviewSmallRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  cardLarge: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 4,
  },
  cardSmall: {
    flex: 1,
    borderWidth: 1,
    padding: 10,
    borderRadius: 4,
  },
  cardLabel: {
    color: 'gray',
    fontSize: 13,
  },
  cardLabelSmall: {
    color: '#555',
    fontSize: 11,
    fontWeight: '500',
  },
  cardValueLarge: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  cardValueSmall: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  metricCard: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    flex: 1,
    borderRadius: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  periodNote: {
    color: 'gray',
    marginTop: 6,
    fontSize: 13,
  },
  alertCard: {
    borderWidth: 1,
    padding: 10,
    borderRadius: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertProductName: {
    fontWeight: 'bold',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  alertBadgeText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  alertDetail: {
    marginTop: 4,
    color: '#444',
    fontSize: 13,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  itemTitle: {
    fontWeight: '500',
    flex: 1,
  },
  itemValue: {
    color: '#555',
    marginLeft: 8,
  },
  emptyText: {
    color: 'gray',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#721c24',
  },
  errorMessage: {
    color: '#721c24',
    textAlign: 'center',
    marginTop: 8,
  },
});
