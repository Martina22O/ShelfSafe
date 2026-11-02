'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { createClient } from '../../../lib/supabase/client';
import {
  getInventory,
  getInventoryAlerts,
  getSalesMetrics,
  getMostStockedProducts,
  getMostSoldProducts,
  getLeastSoldProducts,
} from '../../../lib/inventory';
import {
  ProductWithBatches,
  InventoryAlert,
  SalesMetrics,
  MostStockedProduct,
  MostSoldProduct,
  LeastSoldProduct,
} from '../../../types/inventory';
import { formatExpirationDaysText } from '../../../lib/suggestedActions';

export default function DashboardPage() {
  const { near_expiry_days, loading: settingsLoading, error: settingsError, reload: reloadSettings } = useStoreSettings();

  const [displayName, setDisplayName] = useState('');
  const [period, setPeriod] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');

  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [metrics, setMetrics] = useState<SalesMetrics | null>(null);
  const [mostStocked, setMostStocked] = useState<MostStockedProduct[]>([]);
  const [mostSold, setMostSold] = useState<MostSoldProduct[]>([]);
  const [leastSold, setLeastSold] = useState<LeastSoldProduct[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequestId = useRef(0);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  // Load user greeting
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.name ||
          (user.email ? user.email.split('@')[0] : 'there');
        setDisplayName(name);
      } else {
        setDisplayName('there');
      }
    });
  }, []);

  const loadData = useCallback(async () => {
    if (near_expiry_days === null || settingsLoading || settingsError) {
      return;
    }

    const currentRequestId = ++fetchRequestId.current;
    isFetchingRef.current = true;

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

    // Discard stale out-of-order response
    if (currentRequestId !== fetchRequestId.current) {
      return;
    }

    isFetchingRef.current = false;
    lastFetchTimeRef.current = Date.now();

    // If ANY of the requests fails, show error and do not display incomplete sections
    if (invRes.kind === 'error') {
      setError(`Failed to load inventory: ${invRes.message}`);
      setLoading(false);
      return;
    }
    if (alertsRes.kind === 'error') {
      setError(`Failed to load inventory alerts: ${alertsRes.message}`);
      setLoading(false);
      return;
    }
    if (metricsRes.kind === 'error') {
      setError(`Failed to load sales metrics: ${metricsRes.message}`);
      setLoading(false);
      return;
    }
    if (mostStockedRes.kind === 'error') {
      setError(`Failed to load most-stocked products: ${mostStockedRes.message}`);
      setLoading(false);
      return;
    }
    if (mostSoldRes.kind === 'error') {
      setError(`Failed to load most-sold products: ${mostSoldRes.message}`);
      setLoading(false);
      return;
    }
    if (leastSoldRes.kind === 'error') {
      setError(`Failed to load least-sold products: ${leastSoldRes.message}`);
      setLoading(false);
      return;
    }

    setError(null);
    setProducts(invRes.products);
    setAlerts(alertsRes.alerts);
    setMetrics(metricsRes.metrics);
    setMostStocked(mostStockedRes.products);
    setMostSold(mostSoldRes.products);
    setLeastSold(leastSoldRes.products);
    setLoading(false);
  }, [near_expiry_days, settingsLoading, settingsError]);

  // Initial load and reload when near_expiry_days changes
  useEffect(() => {
    let active = true;
    if (!settingsLoading && !settingsError && near_expiry_days !== null) {
      const run = async () => {
        if (!active) return;
        await loadData();
      };
      run();
    }
    return () => {
      active = false;
    };
  }, [near_expiry_days, settingsLoading, settingsError, loadData]);

  // Window focus reload: skip if fetch running or if data is less than 20 seconds old
  useEffect(() => {
    const handleFocus = () => {
      if (Date.now() - lastFetchTimeRef.current < 20000) {
        return;
      }
      if (!isFetchingRef.current && !settingsLoading && !settingsError && near_expiry_days !== null) {
        loadData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData, settingsLoading, settingsError, near_expiry_days]);

  // Stock Overview totals
  const totalProducts = products.length;
  const totalUnits = useMemo(
    () => products.reduce((acc, p) => acc + p.total_units, 0),
    [products]
  );

  // Exact alert counts derived from ONE SOURCE OF TRUTH (get_inventory_alerts)
  const lowStockAlerts = useMemo(
    () => alerts.filter((a) => a.alert_type === 'low_stock'),
    [alerts]
  );
  const nearExpiryAlerts = useMemo(
    () => alerts.filter((a) => a.alert_type === 'near_expiry'),
    [alerts]
  );
  const expiredAlerts = useMemo(
    () => alerts.filter((a) => a.alert_type === 'expired'),
    [alerts]
  );

  const lowStockCount = lowStockAlerts.length;
  const nearExpiryCount = nearExpiryAlerts.length;
  const expiredCount = expiredAlerts.length;

  // Important alerts: 4 most urgent (expired first, most overdue first; then near expiry, soonest first; then low stock, lowest stock first)
  const importantAlerts = useMemo(() => {
    const sortedExpired = [...expiredAlerts].sort(
      (a, b) => (a.days_until_expiration ?? 0) - (b.days_until_expiration ?? 0)
    );
    const sortedNearExpiry = [...nearExpiryAlerts].sort(
      (a, b) => (a.days_until_expiration ?? 0) - (b.days_until_expiration ?? 0)
    );
    const sortedLowStock = [...lowStockAlerts].sort(
      (a, b) => (a.current_stock ?? 0) - (b.current_stock ?? 0)
    );

    return [...sortedExpired, ...sortedNearExpiry, ...sortedLowStock].slice(0, 4);
  }, [expiredAlerts, nearExpiryAlerts, lowStockAlerts]);

  // Sales check: if no sales exist across all products, most-sold and least-sold show "No sales yet"
  const hasAnySales = useMemo(
    () => mostSold.some((p) => Number(p.total_sold) > 0),
    [mostSold]
  );

  // Units sold display based on client toggle (never refetches)
  const soldNumber = useMemo(() => {
    if (!metrics) return 0;
    if (period === 'Daily') return metrics.sold_today;
    if (period === 'Weekly') return metrics.sold_this_week;
    return metrics.sold_this_month;
  }, [metrics, period]);

  const soldSubtitle = useMemo(() => {
    if (period === 'Daily') {
      return soldNumber === 0 ? 'No sold items today' : `${soldNumber} sold item(s) today`;
    }
    if (period === 'Weekly') {
      return soldNumber === 0 ? 'No sold items this week' : `${soldNumber} sold item(s) this week`;
    }
    return soldNumber === 0 ? 'No sold items this month' : `${soldNumber} sold item(s) this month`;
  }, [period, soldNumber]);

  if (settingsLoading) {
    return (
      <div className="py-8 text-center text-gray-500 text-sm">
        Loading store settings...
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="border border-red-300 bg-red-50 p-6 rounded text-red-800 max-w-md my-4">
        <h2 className="font-bold text-base mb-1">Failed to load store settings</h2>
        <p className="text-sm mb-4">{settingsError}</p>
        <button
          type="button"
          onClick={() => reloadSettings()}
          className="bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800"
        >
          Retry
        </button>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="border border-red-300 bg-red-50 p-6 rounded text-red-800 max-w-lg my-4 space-y-4">
        <div>
          <h2 className="font-bold text-base">Error Loading Dashboard</h2>
          <p className="text-sm mt-1">{error}</p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => loadData()}
            className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Greeting and Header CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Hello, {displayName}!</h1>
          <p className="text-sm text-gray-600 mt-0.5">
            Overview of your store inventory, alerts, and sales performance.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadData()}
            className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100 font-medium"
          >
            Refresh
          </button>
          <Link
            href="/inventory"
            className="bg-black text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-800"
          >
            View Inventory
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500 text-sm">
          Loading dashboard...
        </div>
      ) : (
        <>
          {/* Section: Stock Overview */}
          <div className="space-y-3">
            <h2 className="text-base font-bold text-gray-900">Stock Overview</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="bg-white border border-gray-200 rounded p-4">
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Products
                </span>
                <span className="block text-2xl font-bold text-gray-900 mt-1">
                  {totalProducts}
                </span>
              </div>

              <div className="bg-white border border-gray-200 rounded p-4">
                <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total Units
                </span>
                <span className="block text-2xl font-bold text-gray-900 mt-1">
                  {totalUnits}
                </span>
              </div>

              <div className="bg-white border border-orange-200 bg-orange-50/50 rounded p-4">
                <span className="block text-xs font-semibold text-orange-800 uppercase tracking-wider">
                  Low stock (products)
                </span>
                <span className="block text-2xl font-bold text-orange-950 mt-1">
                  {lowStockCount}
                </span>
              </div>

              <div className="bg-white border border-amber-200 bg-amber-50/50 rounded p-4">
                <span className="block text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  Near expiry (batches)
                </span>
                <span className="block text-2xl font-bold text-amber-950 mt-1">
                  {nearExpiryCount}
                </span>
              </div>

              <div className="bg-white border border-red-200 bg-red-50/50 rounded p-4 col-span-2 sm:col-span-1">
                <span className="block text-xs font-semibold text-red-800 uppercase tracking-wider">
                  Expired (batches)
                </span>
                <span className="block text-2xl font-bold text-red-950 mt-1">
                  {expiredCount}
                </span>
              </div>
            </div>
          </div>

          {/* Section: Units Sold with Toggle */}
          <div className="bg-white border border-gray-200 rounded p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Units Sold</h2>
                <p className="text-xs text-gray-500">{soldSubtitle}</p>
              </div>

              {/* Toggle: Daily / Weekly / Monthly (never refetches) */}
              <div className="inline-flex rounded border border-gray-200 p-0.5 bg-gray-50 self-start sm:self-auto">
                {(['Daily', 'Weekly', 'Monthly'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      period === p
                        ? 'bg-black text-white shadow-sm'
                        : 'text-gray-600 hover:text-black'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-3xl font-extrabold text-gray-900">{soldNumber}</span>
              <span className="text-xs text-gray-500 ml-2">units deducted from sales</span>
            </div>
          </div>

          {/* Section: Important Alerts Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">Important Alerts</h2>
              <Link
                href="/notifications"
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                See all →
              </Link>
            </div>

            {importantAlerts.length === 0 ? (
              <div className="border border-dashed border-gray-300 rounded p-6 text-center text-gray-500 text-sm bg-white">
                No urgent alerts right now. Your shelves look good.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {importantAlerts.map((alert, index) => {
                  const isExp = alert.alert_type === 'expired';
                  const isNear = alert.alert_type === 'near_expiry';
                  const badgeColor = isExp
                    ? 'bg-red-100 text-red-800 border-red-200'
                    : isNear
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-orange-100 text-orange-800 border-orange-200';

                  const badgeLabel = isExp
                    ? 'Expired'
                    : isNear
                    ? 'Near Expiry'
                    : 'Low Stock';

                  const daysText =
                    isExp || isNear
                      ? formatExpirationDaysText(alert.days_until_expiration, isExp)
                      : null;

                  return (
                    <Link
                      key={`${alert.alert_type}-${alert.product_id}-${alert.batch_id || index}`}
                      href={`/inventory/${alert.product_id}`}
                      className="block bg-white border border-gray-200 rounded p-4 hover:border-gray-400 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeColor}`}>
                          {badgeLabel}
                        </span>
                        {alert.batch_id && (
                          <span className="font-mono text-xs text-gray-400 font-semibold">
                            B-{alert.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-gray-900 text-sm mt-2">{alert.product_name}</h3>

                      <p className="text-xs text-gray-600 mt-1">
                        {isExp || isNear ? (
                          <>
                            <span className="font-semibold text-gray-900">{alert.batch_quantity_left ?? 0}</span> units
                            left • <span className="capitalize">{daysText}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-semibold text-gray-900">{alert.current_stock ?? 0}</span> units left
                            (alert at {alert.low_stock_level ?? 5})
                          </>
                        )}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Category Deep Dives (Low Stock, Near Expiry, Expired) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Low Stock Top Items */}
            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-sm text-gray-900">Low Stock ({lowStockCount})</h3>
                <Link href="/notifications" className="text-xs text-blue-600 hover:underline">
                  See all
                </Link>
              </div>
              {lowStockAlerts.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No low stock products.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {lowStockAlerts.slice(0, 5).map((a) => (
                    <Link
                      key={a.product_id}
                      href={`/inventory/${a.product_id}`}
                      className="py-2 flex items-center justify-between text-xs hover:bg-gray-50 px-1 rounded"
                    >
                      <span className="font-medium text-gray-900 truncate max-w-[150px]">{a.product_name}</span>
                      <span className="font-semibold text-orange-700">{a.current_stock ?? 0} left</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Near Expiry Top Items */}
            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-sm text-gray-900">Near Expiry ({nearExpiryCount})</h3>
                <Link href="/notifications" className="text-xs text-blue-600 hover:underline">
                  See all
                </Link>
              </div>
              {nearExpiryAlerts.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No batches near expiry.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {nearExpiryAlerts.slice(0, 5).map((a) => (
                    <Link
                      key={a.batch_id || a.product_id}
                      href={`/inventory/${a.product_id}`}
                      className="py-2 flex items-center justify-between text-xs hover:bg-gray-50 px-1 rounded"
                    >
                      <span className="font-medium text-gray-900 truncate max-w-[130px]">{a.product_name}</span>
                      <span className="font-semibold text-amber-700">
                        {formatExpirationDaysText(a.days_until_expiration, false)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Expired Top Items */}
            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <h3 className="font-bold text-sm text-gray-900">Expired ({expiredCount})</h3>
                <Link href="/notifications" className="text-xs text-blue-600 hover:underline">
                  See all
                </Link>
              </div>
              {expiredAlerts.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No expired batches.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {expiredAlerts.slice(0, 5).map((a) => (
                    <Link
                      key={a.batch_id || a.product_id}
                      href={`/inventory/${a.product_id}`}
                      className="py-2 flex items-center justify-between text-xs hover:bg-gray-50 px-1 rounded"
                    >
                      <span className="font-medium text-gray-900 truncate max-w-[130px]">{a.product_name}</span>
                      <span className="font-semibold text-red-700">
                        {formatExpirationDaysText(a.days_until_expiration, true)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section: Product Ranking Lists (Most-Stocked, Most-Sold, Least-Sold) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Most-Stocked */}
            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                Most Stocked (Top 5)
              </h3>
              {mostStocked.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No products in stock.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {mostStocked.map((item) => (
                    <Link
                      key={item.product_id}
                      href={`/inventory/${item.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-gray-50 px-1 rounded"
                    >
                      <div className="truncate max-w-[170px]">
                        <span className="font-medium text-gray-900 block truncate">{item.product_name}</span>
                        <span className="text-gray-400 text-[10px] block">{item.category_name || 'Uncategorized'}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.total_stock} units</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Most-Sold */}
            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                Most Sold (Top 5)
              </h3>
              {!hasAnySales ? (
                <p className="text-xs text-gray-400 py-4 text-center">No sales yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {mostSold.map((item) => (
                    <Link
                      key={item.product_id}
                      href={`/inventory/${item.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-gray-50 px-1 rounded"
                    >
                      <div className="truncate max-w-[170px]">
                        <span className="font-medium text-gray-900 block truncate">{item.product_name}</span>
                        <span className="text-gray-400 text-[10px] block">{item.category_name || 'Uncategorized'}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.total_sold} sold</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Least-Sold */}
            <div className="bg-white border border-gray-200 rounded p-5 space-y-3">
              <h3 className="font-bold text-sm text-gray-900 border-b border-gray-100 pb-2">
                Least Sold (Top 5)
              </h3>
              {!hasAnySales ? (
                <p className="text-xs text-gray-400 py-4 text-center">No sales yet</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {leastSold.map((item) => (
                    <Link
                      key={item.product_id}
                      href={`/inventory/${item.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-gray-50 px-1 rounded"
                    >
                      <div className="truncate max-w-[170px]">
                        <span className="font-medium text-gray-900 block truncate">{item.product_name}</span>
                        <span className="text-gray-400 text-[10px] block">{item.category_name || 'Uncategorized'}</span>
                      </div>
                      <span className="font-bold text-gray-900">{item.total_sold} sold</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
