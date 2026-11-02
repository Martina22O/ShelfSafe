'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
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
    { key: 'All', label: 'All', count: allCount },
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
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3" />
        <p className="text-sm">Loading store settings...</p>
      </div>
    );
  }

  if (settingsError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-6 max-w-xl mx-auto my-8">
        <h2 className="text-base font-bold text-red-900">Failed to load store settings</h2>
        <p className="text-sm text-red-700 mt-1">{settingsError}</p>
        <button
          type="button"
          onClick={() => reloadSettings()}
          className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (loading && alerts.length === 0 && !error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3" />
        <p className="text-sm">Loading notifications...</p>
      </div>
    );
  }

  if (error && alerts.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-6 max-w-xl mx-auto my-8">
        <h2 className="text-base font-bold text-red-900">Failed to load notifications</h2>
        <p className="text-sm text-red-700 mt-1">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            loadData();
          }}
          className="mt-4 px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-600 mt-1">
            Refresh the page to see changes from other devices.
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
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error banner if reload failed while having stale data */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4 flex items-center justify-between text-sm text-red-800">
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
          <div className="bg-red-50 border border-red-200 rounded-lg p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-red-700">
              Estimate
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-red-900 mt-1">
              ₱{formatPesosFromCentavos(expiredCentavos)}
            </div>
            <p className="text-sm font-medium text-red-800 mt-1">
              Estimated value at risk: expired
            </p>
          </div>

          {/* Near Expiry Value at Risk */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">
              Estimate
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-900 mt-1">
              ₱{formatPesosFromCentavos(nearExpiryCentavos)}
            </div>
            <p className="text-sm font-medium text-amber-800 mt-1">
              Estimated value at risk: near expiry
            </p>
          </div>
        </div>

        {totalMissingPrice > 0 && (
          <p className="text-xs text-gray-500 italic">
            * {totalMissingPrice === 1 ? '1 alert has' : `${totalMissingPrice} alerts have`} no
            price recorded and {totalMissingPrice === 1 ? 'is' : 'are'} excluded from the estimate.
          </p>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((opt) => {
          const isSelected = selectedFilter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelectedFilter(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                isSelected
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isSelected ? `• ${opt.label} (${opt.count})` : `${opt.label} (${opt.count})`}
            </button>
          );
        })}
      </div>

      {/* Alert Items List */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-lg p-8 text-center text-gray-500 text-sm">
            No alerts. Your shelves look good.
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
              ? 'bg-red-100 text-red-800 border-red-200'
              : isNearExpiry
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-orange-100 text-orange-800 border-orange-200';

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
                className="block bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-400 transition-colors shadow-sm"
              >
                {/* Header: Product name, Badge & Batch Code */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${badgeColor}`}
                    >
                      {badgeLabel}
                    </span>
                    <h2 className="text-base font-bold text-gray-900">{alert.product_name}</h2>
                  </div>
                  {batchCode && (
                    <span className="font-mono text-xs text-gray-500 font-semibold shrink-0">
                      B-{batchCode}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="text-xs text-gray-700 mt-2 space-y-1">
                  {isLowStock ? (
                    <p>
                      Only <span className="font-semibold text-gray-900">{alert.current_stock ?? 0}</span>{' '}
                      sellable unit(s) left (threshold {alert.low_stock_level ?? 5}).
                    </p>
                  ) : (
                    <div>
                      <p>
                        Batch B-{batchCode || 'N/A'}{' '}
                        <span className="capitalize">{daysText}</span> with{' '}
                        <span className="font-semibold text-gray-900">
                          {alert.batch_quantity_left ?? 0}
                        </span>{' '}
                        unit(s) left.
                      </p>
                      {alert.expiration_date && (
                        <p className="text-gray-500 text-[11px] mt-0.5">
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
                  <div className="mt-3 bg-gray-50 border border-gray-200 rounded p-2 text-xs text-gray-700">
                    <span className="font-semibold text-gray-900">Suggested action: </span>
                    {suggestedAction}
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
