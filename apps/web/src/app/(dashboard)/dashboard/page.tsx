'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Boxes,
  Layers,
  Clock,
  AlertOctagon,
  AlertTriangle,
  TrendingUp,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldCheck,
  Package,
  Calendar,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { useRealtime } from '../../../lib/realtime';
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

  const initialDataVersionRef = useRef(dataVersion);

  // Realtime silent refresh on dataVersion change
  useEffect(() => {
    let active = true;
    if (dataVersion === initialDataVersionRef.current) {
      return;
    }
    if (!settingsLoading && !settingsError && near_expiry_days !== null) {
      const run = async () => {
        if (!active) return;
        await loadData();
      };
      void run();
    }
    return () => {
      active = false;
    };
  }, [dataVersion, settingsLoading, settingsError, near_expiry_days, loadData]);

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
      <div className="py-16 text-center text-[#7a7469] text-sm flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-[#207429] border-t-transparent rounded-full animate-spin" />
        <p className="font-medium">Loading store settings...</p>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="border border-red-200 bg-red-50 p-6 rounded-2xl text-red-900 max-w-lg my-6 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-base mb-1">Failed to load store settings</h2>
            <p className="text-xs text-red-700 mb-4 leading-relaxed">{settingsError}</p>
            <button
              type="button"
              onClick={() => reloadSettings()}
              className="inline-flex items-center gap-1.5 bg-[#d32f2f] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-red-700 transition-colors shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="border border-red-200 bg-red-50 p-6 rounded-2xl text-red-900 max-w-lg my-6 space-y-4 shadow-xs">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-base">Error Loading Dashboard</h2>
            <p className="text-xs text-red-700 mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => loadData()}
          className="inline-flex items-center gap-1.5 bg-[#207429] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      {/* Page Header with Greeting & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#ece3d2]/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-[#181413] tracking-tight">
              Hello, {displayName}!
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#f4ffe1] text-[#207429] border border-[#207429]/20">
              <ShieldCheck className="w-3 h-3" />
              Store Active
            </span>
          </div>
          <p className="text-xs text-[#7a7469] mt-1">
            Real-time inventory status, urgent expiry alerts, and daily sales overview.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => loadData()}
            aria-label="Refresh dashboard metrics"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#ece3d2] bg-white text-xs font-semibold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#ece3d2] bg-white text-xs font-semibold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs"
          >
            <Package className="w-3.5 h-3.5" />
            Inventory List
          </Link>
          <Link
            href="/inventory/add-stock"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#207429] text-white text-xs font-bold hover:bg-[#185e21] transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Stock In
          </Link>
        </div>
      </div>

      {loading ? (
        /* Shimmer Loading Skeletons */
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-white border border-[#ece3d2] rounded-xl p-4 flex flex-col justify-between">
                <div className="h-3 w-20 bg-[#ece3d2] rounded" />
                <div className="h-6 w-12 bg-[#ece3d2] rounded" />
              </div>
            ))}
          </div>
          <div className="h-36 bg-white border border-[#ece3d2] rounded-xl p-6" />
          <div className="h-44 bg-white border border-[#ece3d2] rounded-xl p-6" />
        </div>
      ) : (
        <>
          {/* Section: Stock Overview KPI Cards (Desktop 5-card grid matching mockup) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#7a7469]">
                Store Inventory Overview
              </h2>
              <span className="text-[11px] text-[#999182]">Live data</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3.5">
              {/* Card 1: Total Products */}
              <div className="bg-white border border-[#ece3d2] rounded-xl p-4 shadow-2xs hover:border-[#207429]/40 transition-colors flex items-center gap-3.5 min-h-[92px]">
                <div className="w-11 h-11 rounded-xl bg-[#f4ffe1] text-[#207429] border border-[#207429]/20 flex items-center justify-center shrink-0 shadow-2xs">
                  <Boxes className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#7a7469] uppercase tracking-wide block leading-tight">
                    Total Products
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#181413] tracking-tight">
                      {totalProducts}
                    </span>
                    <span className="text-[11px] font-medium text-[#7a7469]">SKUs</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Total Units */}
              <div className="bg-white border border-[#ece3d2] rounded-xl p-4 shadow-2xs hover:border-[#207429]/40 transition-colors flex items-center gap-3.5 min-h-[92px]">
                <div className="w-11 h-11 rounded-xl bg-[#f8faf8] border border-[#ece3d2] text-[#4a443a] flex items-center justify-center shrink-0 shadow-2xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-[#7a7469] uppercase tracking-wide block leading-tight">
                    Total Stock
                  </span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#181413] tracking-tight">
                      {totalUnits}
                    </span>
                    <span className="text-[11px] font-medium text-[#7a7469]">units</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Expiring Soon (Amber/Yellow Warm Tint) */}
              <div className="bg-[#fffdf7] border border-[#fde68a] rounded-xl p-4 shadow-2xs hover:border-[#fabe44] transition-colors flex items-center gap-3.5 min-h-[92px]">
                <div className="w-11 h-11 rounded-xl bg-[#fef3c7] text-[#b45309] border border-[#fde68a] flex items-center justify-center shrink-0 shadow-2xs">
                  <Clock className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-[#b45309] uppercase tracking-wide leading-tight">
                      Near Expiry
                    </span>
                    {nearExpiryCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#b45309] border border-[#fde68a] uppercase shrink-0">
                        Urgent
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#b45309] tracking-tight">
                      {nearExpiryCount}
                    </span>
                    <span className="text-[11px] font-medium text-[#b45309]/80">batches</span>
                  </div>
                </div>
              </div>

              {/* Card 4: Expired (Soft Danger Red) */}
              <div className="bg-[#fffafa] border border-[#fecaca] rounded-xl p-4 shadow-2xs hover:border-[#d32f2f] transition-colors flex items-center gap-3.5 min-h-[92px]">
                <div className="w-11 h-11 rounded-xl bg-[#fee2e2] text-[#d32f2f] border border-[#fca5a5] flex items-center justify-center shrink-0 shadow-2xs">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-[#d32f2f] uppercase tracking-wide leading-tight">
                      Expired
                    </span>
                    {expiredCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#fee2e2] text-[#d32f2f] border border-[#fca5a5] uppercase shrink-0">
                        Dispose
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#d32f2f] tracking-tight">
                      {expiredCount}
                    </span>
                    <span className="text-[11px] font-medium text-[#d32f2f]/80">batches</span>
                  </div>
                </div>
              </div>

              {/* Card 5: Low Stock */}
              <div className="bg-[#fffaf5] border border-[#fed7aa] rounded-xl p-4 shadow-2xs hover:border-[#faab06] transition-colors flex items-center gap-3.5 min-h-[92px]">
                <div className="w-11 h-11 rounded-xl bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa] flex items-center justify-center shrink-0 shadow-2xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1.5 min-w-0">
                    <span className="text-[11px] font-bold text-[#c2410c] uppercase tracking-wide leading-tight">
                      Low Stock
                    </span>
                    {lowStockCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#ffedd5] text-[#c2410c] border border-[#fed7aa] uppercase shrink-0">
                        Reorder
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-black text-[#c2410c] tracking-tight">
                      {lowStockCount}
                    </span>
                    <span className="text-[11px] font-medium text-[#c2410c]/80">products</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Units Sold (Card with Period Switcher) */}
          <div className="bg-white border border-[#ece3d2] rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#f4ffe1] text-[#207429] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#181413]">Units Sold</h2>
                  <p className="text-xs text-[#7a7469]">{soldSubtitle}</p>
                </div>
              </div>

              {/* Segmented Period Toggle (Daily / Weekly / Monthly - preserves zero-refetch requirement) */}
              <div className="inline-flex rounded-lg border border-[#ece3d2] p-1 bg-[#fef9f0] self-start sm:self-auto">
                {(['Daily', 'Weekly', 'Monthly'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                      period === p
                        ? 'bg-[#207429] text-white shadow-xs'
                        : 'text-[#7a7469] hover:text-[#181413]'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-baseline gap-2 border-t border-[#f4f1ea]">
              <span className="text-3xl md:text-4xl font-black text-[#181413] tracking-tight">
                {soldNumber}
              </span>
              <span className="text-xs font-medium text-[#7a7469]">
                units deducted via sales
              </span>
            </div>
          </div>

          {/* Section: Urgent Expiry & Stock Alerts Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#7a7469]">
                  Urgent Shelf Alerts
                </h2>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f4ffe1] text-[#207429]">
                  Expiry Priority
                </span>
              </div>
              <Link
                href="/notifications"
                className="inline-flex items-center gap-1 text-xs font-bold text-[#207429] hover:underline"
              >
                <span>View all alerts</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {importantAlerts.length === 0 ? (
              <div className="border border-dashed border-[#ece3d2] rounded-2xl p-8 text-center bg-white shadow-2xs">
                <div className="w-10 h-10 rounded-full bg-[#f4ffe1] text-[#207429] mx-auto flex items-center justify-center mb-2">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-[#181413]">Shelves are fully protected</h3>
                <p className="text-xs text-[#7a7469] mt-0.5">
                  No near-expiry, expired, or critically low inventory right now.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {importantAlerts.map((alert, index) => {
                  const isExp = alert.alert_type === 'expired';
                  const isNear = alert.alert_type === 'near_expiry';

                  const badgeClass = isExp
                    ? 'bg-[#fee2e2] text-[#d32f2f] border-[#fca5a5]'
                    : isNear
                    ? 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]'
                    : 'bg-[#ffedd5] text-[#c2410c] border-[#fed7aa]';

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
                      className="group block bg-white border border-[#ece3d2] rounded-xl p-4 hover:border-[#207429] hover:shadow-xs transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
                          {badgeLabel}
                        </span>
                        {alert.batch_id && (
                          <span className="font-mono text-[11px] text-[#999182] font-semibold bg-[#fef9f0] px-1.5 py-0.5 rounded border border-[#ece3d2]">
                            B-{alert.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="mt-2.5 flex items-baseline justify-between">
                        <h3 className="font-bold text-[#181413] text-sm group-hover:text-[#207429] transition-colors truncate max-w-[200px]">
                          {alert.product_name}
                        </h3>
                        <ExternalLink className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-[#207429] shrink-0" />
                      </div>

                      <p className="text-xs text-[#7a7469] mt-1">
                        {isExp || isNear ? (
                          <>
                            <span className="font-bold text-[#181413]">
                              {alert.batch_quantity_left ?? 0}
                            </span>{' '}
                            units left • <span className="capitalize font-semibold text-[#b45309]">{daysText}</span>
                          </>
                        ) : (
                          <>
                            <span className="font-bold text-[#181413]">
                              {alert.current_stock ?? 0}
                            </span>{' '}
                            units left (alert threshold: {alert.low_stock_level ?? 5})
                          </>
                        )}
                      </p>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section: Category Deep Dives (Low Stock, Near Expiry, Expired Breakdown) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Low Stock Breakdown */}
            <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#f4f1ea] pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#c2410c]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#181413]">
                    Low Stock ({lowStockCount})
                  </h3>
                </div>
                <Link href="/notifications" className="text-xs font-semibold text-[#207429] hover:underline">
                  See all
                </Link>
              </div>
              {lowStockAlerts.length === 0 ? (
                <p className="text-xs text-[#999182] py-3">No low stock items detected.</p>
              ) : (
                <div className="divide-y divide-[#f4f1ea]">
                  {lowStockAlerts.slice(0, 5).map((a) => (
                    <Link
                      key={a.product_id}
                      href={`/inventory/${a.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-[#fef9f0] px-1.5 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-[#181413] truncate flex-1 min-w-0 mr-2">
                        {a.product_name}
                      </span>
                      <span className="font-bold text-[#c2410c] bg-[#ffedd5] px-2 py-0.5 rounded text-[11px] shrink-0">
                        {a.current_stock ?? 0} left
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Near Expiry Breakdown */}
            <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#f4f1ea] pb-2.5">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#b45309]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#181413]">
                    Near Expiry ({nearExpiryCount})
                  </h3>
                </div>
                <Link href="/notifications" className="text-xs font-semibold text-[#207429] hover:underline">
                  See all
                </Link>
              </div>
              {nearExpiryAlerts.length === 0 ? (
                <p className="text-xs text-[#999182] py-3">No batches near expiration.</p>
              ) : (
                <div className="divide-y divide-[#f4f1ea]">
                  {nearExpiryAlerts.slice(0, 5).map((a) => (
                    <Link
                      key={a.batch_id || a.product_id}
                      href={`/inventory/${a.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-[#fef9f0] px-1.5 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-[#181413] truncate flex-1 min-w-0 mr-2">
                        {a.product_name}
                      </span>
                      <span className="font-bold text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded text-[11px] shrink-0">
                        {formatExpirationDaysText(a.days_until_expiration, false)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Expired Breakdown */}
            <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between border-b border-[#f4f1ea] pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="w-4 h-4 text-[#d32f2f]" />
                  <h3 className="font-bold text-xs uppercase tracking-wider text-[#181413]">
                    Expired ({expiredCount})
                  </h3>
                </div>
                <Link href="/notifications" className="text-xs font-semibold text-[#207429] hover:underline">
                  See all
                </Link>
              </div>
              {expiredAlerts.length === 0 ? (
                <p className="text-xs text-[#999182] py-3">No expired items present.</p>
              ) : (
                <div className="divide-y divide-[#f4f1ea]">
                  {expiredAlerts.slice(0, 5).map((a) => (
                    <Link
                      key={a.batch_id || a.product_id}
                      href={`/inventory/${a.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-[#fef9f0] px-1.5 rounded-lg transition-colors"
                    >
                      <span className="font-medium text-[#181413] truncate flex-1 min-w-0 mr-2">
                        {a.product_name}
                      </span>
                      <span className="font-bold text-[#d32f2f] bg-[#fee2e2] px-2 py-0.5 rounded text-[11px] shrink-0">
                        {formatExpirationDaysText(a.days_until_expiration, true)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section: Product Ranking Lists (Most-Stocked, Most-Sold, Least-Sold) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {/* Most-Stocked */}
            <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[#f4f1ea] pb-2.5">
                <Boxes className="w-4 h-4 text-[#207429]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#181413]">
                  Most Stocked (Top 5)
                </h3>
              </div>
              {mostStocked.length === 0 ? (
                <p className="text-xs text-[#999182] py-3">No products in stock.</p>
              ) : (
                <div className="divide-y divide-[#f4f1ea]">
                  {mostStocked.map((item) => (
                    <Link
                      key={item.product_id}
                      href={`/inventory/${item.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-[#fef9f0] px-1.5 rounded-lg transition-colors"
                    >
                      <div className="truncate flex-1 min-w-0 mr-2">
                        <span className="font-medium text-[#181413] block truncate">{item.product_name}</span>
                        <span className="text-[#999182] text-[10px] block truncate">{item.category_name || 'Uncategorized'}</span>
                      </div>
                      <span className="font-bold text-[#181413] bg-[#f8faf8] border border-[#ece3d2] px-2 py-0.5 rounded text-[11px] shrink-0">
                        {item.total_stock} units
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Most-Sold */}
            <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[#f4f1ea] pb-2.5">
                <TrendingUp className="w-4 h-4 text-[#207429]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#181413]">
                  Most Sold (Top 5)
                </h3>
              </div>
              {!hasAnySales ? (
                <p className="text-xs text-[#999182] py-5 text-center">No sales recorded yet</p>
              ) : (
                <div className="divide-y divide-[#f4f1ea]">
                  {mostSold.map((item) => (
                    <Link
                      key={item.product_id}
                      href={`/inventory/${item.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-[#fef9f0] px-1.5 rounded-lg transition-colors"
                    >
                      <div className="truncate flex-1 min-w-0 mr-2">
                        <span className="font-medium text-[#181413] block truncate">{item.product_name}</span>
                        <span className="text-[#999182] text-[10px] block truncate">{item.category_name || 'Uncategorized'}</span>
                      </div>
                      <span className="font-bold text-[#207429] bg-[#f4ffe1] px-2 py-0.5 rounded text-[11px] border border-[#207429]/20 shrink-0">
                        {item.total_sold} sold
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Least-Sold */}
            <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2 border-b border-[#f4f1ea] pb-2.5">
                <Calendar className="w-4 h-4 text-[#7a7469]" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-[#181413]">
                  Least Sold (Top 5)
                </h3>
              </div>
              {!hasAnySales ? (
                <p className="text-xs text-[#999182] py-5 text-center">No sales recorded yet</p>
              ) : (
                <div className="divide-y divide-[#f4f1ea]">
                  {leastSold.map((item) => (
                    <Link
                      key={item.product_id}
                      href={`/inventory/${item.product_id}`}
                      className="py-2.5 flex items-center justify-between text-xs hover:bg-[#fef9f0] px-1.5 rounded-lg transition-colors"
                    >
                      <div className="truncate flex-1 min-w-0 mr-2">
                        <span className="font-medium text-[#181413] block truncate">{item.product_name}</span>
                        <span className="text-[#999182] text-[10px] block truncate">{item.category_name || 'Uncategorized'}</span>
                      </div>
                      <span className="font-bold text-[#7a7469] bg-[#f8faf8] border border-[#ece3d2] px-2 py-0.5 rounded text-[11px] shrink-0">
                        {item.total_sold} sold
                      </span>
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
