'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  AlertOctagon,
  Clock,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { getInventoryAlerts } from '../../../lib/inventory';
import { InventoryAlert } from '../../../types/inventory';
import {
  formatExpirationDaysText,
  getSuggestedAction,
  formatPesosFromCentavos,
} from '../../../lib/suggestedActions';
import { formatDisplayDate } from '../../../lib/date';

type FilterKey = 'All' | 'Low Stock' | 'Near Expiry' | 'Expired';

export default function NotificationsPage() {
  const {
    near_expiry_days,
    loading: settingsLoading,
    error: settingsError,
    reload: reloadSettings,
  } = useStoreSettings();

  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequestId = useRef(0);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);

  const loadData = useCallback(async () => {
    if (near_expiry_days === null || settingsLoading || settingsError) {
      return;
    }

    const currentRequestId = ++fetchRequestId.current;
    isFetchingRef.current = true;

    const res = await getInventoryAlerts(near_expiry_days);

    // Discard stale out-of-order response
    if (currentRequestId !== fetchRequestId.current) {
      return;
    }

    isFetchingRef.current = false;
    lastFetchTimeRef.current = Date.now();

    if (res.kind === 'error') {
      setError(`Failed to load inventory alerts: ${res.message}`);
      setLoading(false);
      return;
    }

    setError(null);
    setAlerts(res.alerts);
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

  // Derived alert lists from ONE SOURCE OF TRUTH (alerts state)
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
  const allCount = alerts.length;

  // Filter chips definitions
  const filterOptions: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: 'All', label: 'All Alerts', count: allCount },
    { key: 'Low Stock', label: 'Low Stock', count: lowStockCount },
    { key: 'Near Expiry', label: 'Near Expiry', count: nearExpiryCount },
    { key: 'Expired', label: 'Expired', count: expiredCount },
  ];

  // Filtered alert list
  const filteredAlerts = useMemo(() => {
    if (selectedFilter === 'All') return alerts;
    if (selectedFilter === 'Low Stock') return lowStockAlerts;
    if (selectedFilter === 'Near Expiry') return nearExpiryAlerts;
    if (selectedFilter === 'Expired') return expiredAlerts;
    return alerts;
  }, [alerts, selectedFilter, lowStockAlerts, nearExpiryAlerts, expiredAlerts]);

  // Calculate estimated values at risk in whole centavos
  const { expiredCentavos, nearExpiryCentavos, totalMissingPrice } = useMemo(() => {
    let expCentavos = 0;
    let expMissing = 0;
    for (const a of expiredAlerts) {
      if (a.price === null || a.price === undefined) {
        expMissing++;
      } else {
        const priceInCentavos = Math.round(Number(a.price) * 100);
        expCentavos += (a.batch_quantity_left ?? 0) * priceInCentavos;
      }
    }

    let nearCentavos = 0;
    let nearMissing = 0;
    for (const a of nearExpiryAlerts) {
      if (a.price === null || a.price === undefined) {
        nearMissing++;
      } else {
        const priceInCentavos = Math.round(Number(a.price) * 100);
        nearCentavos += (a.batch_quantity_left ?? 0) * priceInCentavos;
      }
    }

    return {
      expiredCentavos: expCentavos,
      nearExpiryCentavos: nearCentavos,
      totalMissingPrice: expMissing + nearMissing,
    };
  }, [expiredAlerts, nearExpiryAlerts]);

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
        <h2 className="text-base font-bold text-red-900">Failed to load store settings</h2>
        <p className="text-xs text-red-700 mt-1 mb-4 leading-relaxed">{settingsError}</p>
        <button
          type="button"
          onClick={() => reloadSettings()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#d32f2f] text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  if (loading && alerts.length === 0 && !error) {
    return (
      <div className="py-16 text-center text-[#7a7469] text-sm flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-[#207429] border-t-transparent rounded-full animate-spin" />
        <p className="font-medium">Loading notifications...</p>
      </div>
    );
  }

  if (error && alerts.length === 0) {
    return (
      <div className="border border-red-200 bg-red-50 p-6 rounded-2xl text-red-900 max-w-lg my-6 space-y-4 shadow-xs">
        <h2 className="text-base font-bold text-red-900">Failed to load notifications</h2>
        <p className="text-xs text-red-700 mt-1 leading-relaxed">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadData();
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#207429] text-white text-xs font-bold rounded-xl hover:bg-[#185e21] transition-colors shadow-2xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#ece3d2]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#181413] tracking-tight">Notifications Center</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef9f0] text-[#7a7469] border border-[#ece3d2]">
              {allCount} active alert(s)
            </span>
          </div>
          <p className="text-xs text-[#7a7469] mt-1">
            Real-time shelf alerts, stock shortages, and batch expiration tracking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (isFetchingRef.current) return;
            setLoading(true);
            loadData();
          }}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#ece3d2] bg-white text-xs font-bold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Refreshing...' : 'Refresh Alerts'}
        </button>
      </div>

      {/* Error banner if reload failed while having stale data */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-xs text-red-900 shadow-2xs">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => loadData()}
            className="text-xs font-bold underline hover:text-red-950 ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Value at Risk Cards */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Expired Value at Risk */}
          <div className="bg-[#fffafa] border border-[#fecaca] rounded-2xl p-5 shadow-2xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#fee2e2] text-[#d32f2f] border border-[#fca5a5] flex items-center justify-center shrink-0 shadow-2xs">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#d32f2f] bg-[#fee2e2] px-2 py-0.5 rounded inline-block">
                Estimated Loss (Expired)
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#d32f2f] mt-1 tracking-tight">
                ₱{formatPesosFromCentavos(expiredCentavos)}
              </div>
              <p className="text-xs font-semibold text-[#d32f2f]/80 mt-0.5">
                Estimated inventory value of expired batches
              </p>
            </div>
          </div>

          {/* Near Expiry Value at Risk */}
          <div className="bg-[#fffdf7] border border-[#fde68a] rounded-2xl p-5 shadow-2xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#fef3c7] text-[#b45309] border border-[#fde68a] flex items-center justify-center shrink-0 shadow-2xs">
              <Clock className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#b45309] bg-[#fef3c7] px-2 py-0.5 rounded inline-block">
                Value at Risk (Near Expiry)
              </span>
              <div className="text-2xl sm:text-3xl font-black text-[#b45309] mt-1 tracking-tight">
                ₱{formatPesosFromCentavos(nearExpiryCentavos)}
              </div>
              <p className="text-xs font-semibold text-[#b45309]/80 mt-0.5">
                Estimated value of batches expiring within threshold
              </p>
            </div>
          </div>
        </div>

        {totalMissingPrice > 0 && (
          <p className="text-[11px] text-[#999182] flex items-center gap-1 pt-1">
            <Info className="w-3.5 h-3.5 text-[#9ca3af]" />
            <span>
              * {totalMissingPrice === 1 ? '1 alert has' : `${totalMissingPrice} alerts have`} no price recorded and {totalMissingPrice === 1 ? 'is' : 'are'} excluded from the estimate.
            </span>
          </p>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2 pt-1">
        {filterOptions.map((opt) => {
          const isSelected = selectedFilter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelectedFilter(opt.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${isSelected
                  ? 'bg-[#207429] text-white shadow-2xs'
                  : 'bg-white text-[#524c40] border border-[#ece3d2] hover:bg-[#fef9f0]'
                }`}
            >
              {opt.label} ({opt.count})
            </button>
          );
        })}
      </div>

      {/* Alert Items List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white border border-dashed border-[#ece3d2] rounded-2xl p-12 text-center shadow-2xs">
            <div className="w-12 h-12 rounded-full bg-[#f4ffe1] text-[#207429] mx-auto flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h2 className="text-sm font-bold text-[#181413]">No alerts right now</h2>
            <p className="text-xs text-[#7a7469] mt-0.5">Your shelves are healthy and all batches are within safe dates.</p>
          </div>
        ) : (
          filteredAlerts.map((alert, idx) => {
            const isLowStock = alert.alert_type === 'low_stock';
            const isNearExpiry = alert.alert_type === 'near_expiry';
            const isExpired = alert.alert_type === 'expired';

            const badgeLabel = isExpired
              ? 'Expired'
              : isNearExpiry
                ? 'Near Expiry'
                : 'Low Stock';

            const badgeColor = isExpired
              ? 'bg-[#fee2e2] text-[#d32f2f] border-[#fca5a5]'
              : isNearExpiry
                ? 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]'
                : 'bg-[#ffedd5] text-[#c2410c] border-[#fed7aa]';

            const batchCode = alert.batch_id
              ? alert.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase()
              : null;

            const daysText =
              isExpired || isNearExpiry
                ? formatExpirationDaysText(alert.days_until_expiration, isExpired)
                : null;

            const suggestedAction = getSuggestedAction(alert);

            return (
              <Link
                key={`${alert.alert_type}-${alert.product_id}-${alert.batch_id || idx}`}
                href={`/inventory/${alert.product_id}`}
                className="group block bg-white border border-[#ece3d2] rounded-2xl p-5 hover:border-[#207429] hover:shadow-xs transition-all"
              >
                {/* Header: Product name, Badge & Batch Code */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeColor}`}
                    >
                      {badgeLabel}
                    </span>
                    <h2 className="text-base font-bold text-[#181413] group-hover:text-[#207429] transition-colors">
                      {alert.product_name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {batchCode && (
                      <span className="font-mono text-xs text-[#999182] font-semibold bg-[#fef9f0] px-2 py-0.5 rounded border border-[#ece3d2]">
                        B-{batchCode}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-[#9ca3af] group-hover:text-[#207429] transition-colors" />
                  </div>
                </div>

                {/* Details */}
                <div className="text-xs text-[#524c40] mt-2 space-y-1">
                  {isLowStock ? (
                    <p>
                      Only <span className="font-bold text-[#181413]">{alert.current_stock ?? 0}</span>{' '}
                      sellable unit(s) left in store (alert threshold: {alert.low_stock_level ?? 5}).
                    </p>
                  ) : (
                    <div>
                      <p>
                        Batch B-{batchCode || 'N/A'}{' '}
                        <span className="capitalize font-semibold text-[#b45309]">{daysText}</span> with{' '}
                        <span className="font-bold text-[#181413]">
                          {alert.batch_quantity_left ?? 0}
                        </span>{' '}
                        unit(s) remaining.
                      </p>
                      {alert.expiration_date && (
                        <p className="text-[#7a7469] text-[11px] mt-0.5">
                          Expires {formatDisplayDate(alert.expiration_date)}
                          {alert.price !== null && alert.price !== undefined && (
                            <>
                              {' · '}Est. ₱
                              {formatPesosFromCentavos(
                                (alert.batch_quantity_left ?? 0) *
                                Math.round(Number(alert.price) * 100)
                              )}{' '}
                              at ₱{formatPesosFromCentavos(Math.round(Number(alert.price) * 100))}/unit
                            </>
                          )}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Suggested Action */}
                {suggestedAction && (
                  <div className="mt-3.5 bg-[#fef9f0] border border-[#ece3d2] rounded-xl p-2.5 text-xs text-[#524c40] flex items-center gap-2">
                    <span className="font-bold text-[#207429] text-[10px] uppercase tracking-wider bg-[#f4ffe1] px-1.5 py-0.5 rounded border border-[#207429]/20">
                      Suggested Action
                    </span>
                    <span className="font-medium text-[#181413]">{suggestedAction}</span>
                  </div>
                )}
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}