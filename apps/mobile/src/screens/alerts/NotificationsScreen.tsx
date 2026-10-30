/**
 * Screen: NotificationsScreen
 * Reference: docs/design/04-notifications.png
 * Elements:
 * - Screen Header: Notifications
 * - Subtitle: "Pull down to refresh"
 * - Estimated value at risk cards:
 *   - "Estimated value at risk — expired"
 *   - "Estimated value at risk — near expiry"
 *   - Sum = units left x product price for expired and near-expiry batches. If price is missing,
 *     it is excluded from the sum and annotated with "N alerts have no price".
 * - Filter chips with exact counts derived from ONE SOURCE OF TRUTH (get_inventory_alerts):
 *   - All (N), Low Stock (N), Near Expiry (N), Expired (N)
 * - Alert cards:
 *   - Type badge (Expired batch, Near Expiry, Low Stock)
 *   - Product name
 *   - Batch code (first 8 chars of batch_id in caps: B-XXXXXXXX) - omitted for low stock
 *   - Expiration details using days_until_expiration from RPC (never phone clock) - omitted for low stock
 *   - Low stock shows sellable units left & threshold
 *   - Suggested action line from rule-based suggestedActions utility
 *   - Tapping an alert card navigates to ProductDetail in InventoryTab
 * - Empty state: "No alerts. Your shelves look good."
 * - useFocusEffect, pull-to-refresh, loading state, error view with Retry
 */
import React, { useState, useCallback } from 'react';
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
import { getInventoryAlerts } from '../../services/inventory';
import { InventoryAlert } from '../../types/inventory';
import { NEAR_EXPIRY_DAYS, formatDisplayDate } from '../../utils/date';
import {
  getSuggestedAction,
  formatExpirationDaysText,
} from '../../utils/suggestedActions';

const RefreshControlComponent = RefreshControl as any;

type FilterKey = 'All' | 'Low Stock' | 'Near Expiry' | 'Expired';

export default function NotificationsScreen() {
  const navigation = useNavigation<any>();

  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (isMounted = true) => {
    setError(null);
    try {
      const res = await getInventoryAlerts(NEAR_EXPIRY_DAYS);
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
      loadData(isMounted);
      return () => {
        isMounted = false;
      };
    }, [])
  );

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

  // Compute alert counts directly from ONE SOURCE OF TRUTH (alerts list)
  const lowStockAlerts = alerts.filter((a) => a.alert_type === 'low_stock');
  const nearExpiryAlerts = alerts.filter((a) => a.alert_type === 'near_expiry');
  const expiredAlerts = alerts.filter((a) => a.alert_type === 'expired');

  const lowStockCount = lowStockAlerts.length;
  const nearExpiryCount = nearExpiryAlerts.length;
  const expiredCount = expiredAlerts.length;
  const allCount = alerts.length;

  // Filter chips
  const filterOptions: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'All', label: 'All', count: allCount },
    { key: 'Low Stock', label: 'Low Stock', count: lowStockCount },
    { key: 'Near Expiry', label: 'Near Expiry', count: nearExpiryCount },
    { key: 'Expired', label: 'Expired', count: expiredCount },
  ];

  // Filtered alert list
  const filteredAlerts = alerts.filter((a) => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Low Stock') return a.alert_type === 'low_stock';
    if (selectedFilter === 'Near Expiry') return a.alert_type === 'near_expiry';
    if (selectedFilter === 'Expired') return a.alert_type === 'expired';
    return true;
  });

  // Calculate estimated value at risk
  // If price is missing for a row, do not count as zero; exclude from total and note count.
  let expiredValueAtRisk = 0;
  let expiredMissingPrice = 0;
  for (const a of expiredAlerts) {
    if (a.price === null || a.price === undefined) {
      expiredMissingPrice++;
    } else {
      expiredValueAtRisk += (a.batch_quantity_left ?? 0) * a.price;
    }
  }

  let nearExpiryValueAtRisk = 0;
  let nearExpiryMissingPrice = 0;
  for (const a of nearExpiryAlerts) {
    if (a.price === null || a.price === undefined) {
      nearExpiryMissingPrice++;
    } else {
      nearExpiryValueAtRisk += (a.batch_quantity_left ?? 0) * a.price;
    }
  }

  const totalMissingPrice = expiredMissingPrice + nearExpiryMissingPrice;

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
        <Text style={{ marginTop: 12, color: 'gray' }}>Loading alerts...</Text>
      </View>
    );
  }

  if (error && !loading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorTitle}>Error Loading Alerts</Text>
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
      <Text style={styles.screenTitle}>Notifications</Text>
      <Text style={styles.screenSubtitle}>Pull down to refresh</Text>

      {/* Value at Risk Cards */}
      <View style={styles.riskCardsContainer}>
        <View style={styles.riskCardExpired}>
          <Text style={styles.riskCardAmountExpired}>
            ₱{expiredValueAtRisk.toFixed(2)}
          </Text>
          <Text style={styles.riskCardLabelExpired}>
            Estimated value at risk — expired
          </Text>
        </View>

        <View style={styles.riskCardNearExpiry}>
          <Text style={styles.riskCardAmountNearExpiry}>
            ₱{nearExpiryValueAtRisk.toFixed(2)}
          </Text>
          <Text style={styles.riskCardLabelNearExpiry}>
            Estimated value at risk — near expiry
          </Text>
        </View>

        {totalMissingPrice > 0 && (
          <Text style={styles.missingPriceNote}>
            * {totalMissingPrice === 1 ? '1 alert has' : `${totalMissingPrice} alerts have`} no
            price recorded and {totalMissingPrice === 1 ? 'is' : 'are'} excluded from the estimate.
          </Text>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
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
                {isSelected ? `• ${opt.label} (${opt.count})` : `${opt.label} (${opt.count})`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Alert Items List */}
      <View style={styles.alertsList}>
        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No alerts. Your shelves look good.</Text>
          </View>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const isLowStock = alert.alert_type === 'low_stock';
            const isNearExpiry = alert.alert_type === 'near_expiry';
            const isExpired = alert.alert_type === 'expired';

            const badgeLabel = isExpired
              ? 'Expired batch'
              : isNearExpiry
              ? 'Near Expiry'
              : 'Low Stock';

            const badgeColor = isExpired
              ? '#721c24'
              : isNearExpiry
              ? '#856404'
              : '#856404';

            const badgeBg = isExpired
              ? '#f8d7da'
              : isNearExpiry
              ? '#fff3cd'
              : '#fff3cd';

            const batchCode = alert.batch_id
              ? alert.batch_id.slice(0, 8).toUpperCase()
              : null;

            const daysText = isExpired
              ? formatExpirationDaysText(alert.days_until_expiration, true)
              : formatExpirationDaysText(alert.days_until_expiration, false);

            const suggestedAction = getSuggestedAction(alert);

            return (
              <TouchableOpacity
                key={`${alert.product_id}-${alert.batch_id || idx}-${alert.alert_type}`}
                style={styles.alertCard}
                onPress={() => navigateToProductDetail(alert.product_id, alert.product_name)}
              >
                {/* Header: Product name & Badge */}
                <View style={styles.alertCardHeader}>
                  <Text style={styles.alertProductName}>{alert.product_name}</Text>
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]}>
                      {badgeLabel}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                {isLowStock ? (
                  // Low stock card: per product. No batch code and no expiry line.
                  <Text style={styles.alertPrimaryDetail}>
                    Only {alert.current_stock ?? 0} sellable unit(s) left (threshold{' '}
                    {alert.low_stock_level ?? 5}).
                  </Text>
                ) : (
                  // Near Expiry or Expired: batch code & expiry line
                  <>
                    <Text style={styles.alertPrimaryDetail}>
                      Batch B-{batchCode || 'N/A'} {daysText} with{' '}
                      {alert.batch_quantity_left ?? 0} unit(s) left.
                    </Text>
                    {alert.expiration_date && (
                      <Text style={styles.alertSecondaryDetail}>
                        Expires {formatDisplayDate(alert.expiration_date)}
                        {alert.price !== null && alert.price !== undefined
                          ? ` · Est. ₱${(
                              (alert.batch_quantity_left ?? 0) * alert.price
                            ).toFixed(2)} at ₱${alert.price.toFixed(2)}/unit`
                          : ''}
                      </Text>
                    )}
                  </>
                )}

                {/* Suggested Action */}
                {suggestedAction ? (
                  <View style={styles.suggestedActionBox}>
                    <Text style={styles.suggestedActionText}>
                      <Text style={{ fontWeight: 'bold' }}>Suggested action: </Text>
                      {suggestedAction}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
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
  screenSubtitle: {
    color: 'gray',
    marginTop: 4,
  },
  riskCardsContainer: {
    gap: 12,
    marginTop: 16,
  },
  riskCardExpired: {
    borderWidth: 1,
    borderColor: '#f5c6cb',
    backgroundColor: '#fff5f5',
    padding: 16,
    borderRadius: 4,
  },
  riskCardAmountExpired: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#721c24',
  },
  riskCardLabelExpired: {
    color: '#721c24',
    marginTop: 4,
    fontSize: 13,
  },
  riskCardNearExpiry: {
    borderWidth: 1,
    borderColor: '#ffeeba',
    backgroundColor: '#fffdf5',
    padding: 16,
    borderRadius: 4,
  },
  riskCardAmountNearExpiry: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#856404',
  },
  riskCardLabelNearExpiry: {
    color: '#856404',
    marginTop: 4,
    fontSize: 13,
  },
  missingPriceNote: {
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 20,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#ccc',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  filterChipActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#2e7d32',
  },
  filterChipText: {
    color: '#333',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#2e7d32',
    fontWeight: 'bold',
  },
  alertsList: {
    marginTop: 20,
    gap: 12,
    marginBottom: 40,
  },
  alertCard: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 14,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  alertCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertProductName: {
    fontWeight: 'bold',
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  alertPrimaryDetail: {
    marginTop: 6,
    fontSize: 13,
    color: '#333',
  },
  alertSecondaryDetail: {
    color: 'gray',
    fontSize: 12,
    marginTop: 2,
  },
  suggestedActionBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  suggestedActionText: {
    fontSize: 12,
    color: '#444',
    lineHeight: 16,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: 'gray',
    fontStyle: 'italic',
    fontSize: 15,
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
