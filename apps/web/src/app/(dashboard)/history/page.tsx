'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getSaleHistory, undoSale } from '../../../lib/inventory';
import { SaleHistoryRecord, SaleBatchBreakdownItem } from '../../../types/inventory';
import { formatManilaDateTime, formatDisplayDate } from '../../../lib/date';
import { ConfirmModal } from '../../../components/ConfirmModal';

const CHIP_FILTERS = ['All', 'Recorded', 'Undone'] as const;
type ChipFilter = (typeof CHIP_FILTERS)[number];

function formatBatchItem(b: SaleBatchBreakdownItem): string {
  const code = b.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const unitStr = `${b.quantity} ${b.quantity === 1 ? 'unit' : 'units'}`;
  const expStr = b.expiration_date ? `exp ${formatDisplayDate(b.expiration_date)}` : '';
  return `B - ${code} (${unitStr}${expStr ? `, ${expStr}` : ''})`;
}

export default function HistoryPage() {
  const [sales, setSales] = useState<SaleHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination limit: starts at 50, increases by 50 up to 500
  const [limit, setLimit] = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [activeChip, setActiveChip] = useState<ChipFilter>('All');

  // Action / Notification banners
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [actionErrorBanner, setActionErrorBanner] = useState<string | null>(null);

  // Undo confirmation state
  const [saleToUndo, setSaleToUndo] = useState<SaleHistoryRecord | null>(null);
  const [undoingSaleId, setUndoingSaleId] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  // Track sales whose undo failed with unclear network/timeout error so their buttons stay disabled until reload
  const [unclearFailedSaleIds, setUnclearFailedSaleIds] = useState<Set<string>>(new Set());

  // Concurrency & Focus reload guards
  const fetchRequestId = useRef(0);
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef<number>(0);
  const actionRunningRef = useRef(false);

  useEffect(() => {
    actionRunningRef.current = isUndoing || undoingSaleId !== null;
  }, [isUndoing, undoingSaleId]);

  const loadHistory = useCallback(
    async (limitToFetch: number, isManualRefresh = false) => {
      const currentRequestId = ++fetchRequestId.current;
      isFetchingRef.current = true;

      if (isManualRefresh) {
        setRefreshing(true);
      }

      const res = await getSaleHistory(limitToFetch);

      // Discard stale responses if another request was triggered
      if (currentRequestId !== fetchRequestId.current) {
        return;
      }

      isFetchingRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);

      if (res.kind === 'error') {
        setError(res.message);
        return;
      }

      setError(null);
      setSales(res.history);
      lastFetchTimeRef.current = Date.now();
      // Clear any unclear-failure disabled buttons now that fresh data has loaded
      setUnclearFailedSaleIds(new Set());
    },
    []
  );

  // Initial load
  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await loadHistory(limit, false);
    };
    run();
    return () => {
      active = false;
    };
  }, [loadHistory, limit]);

  // Window focus listener: reload when regaining focus if >= 20s old and not currently fetching/undoing
  useEffect(() => {
    const handleFocus = () => {
      if (isFetchingRef.current) return;
      if (actionRunningRef.current) return;

      const timeSinceLastFetch = Date.now() - lastFetchTimeRef.current;
      if (timeSinceLastFetch < 20000) {
        // Data is under 20 seconds old; skip auto-reload
        return;
      }

      loadHistory(limit, false);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadHistory, limit]);

  // Manual refresh button click
  const handleRefresh = () => {
    setSuccessBanner(null);
    setActionErrorBanner(null);
    loadHistory(limit, true);
  };

  // "Show more" handler
  const handleShowMore = () => {
    const nextLimit = Math.min(limit + 50, 500);
    if (nextLimit > limit) {
      setLimit(nextLimit);
      setLoadingMore(true);
      loadHistory(nextLimit, false);
    }
  };

  // Execute undo when confirmed
  const handleConfirmUndo = async () => {
    if (!saleToUndo) return;
    const targetSale = saleToUndo;

    setIsUndoing(true);
    setUndoingSaleId(targetSale.sales_scan_id);
    setSuccessBanner(null);
    setActionErrorBanner(null);

    const res = await undoSale(
      targetSale.sales_scan_id,
      targetSale.product_id,
      targetSale.batch_breakdown
    );

    setIsUndoing(false);
    setUndoingSaleId(null);
    setSaleToUndo(null);

    if (res.kind === 'error') {
      setActionErrorBanner(res.message);

      // If network/timeout failure, keep this row's button disabled until reload finishes
      if (!res.isDatabaseError) {
        setUnclearFailedSaleIds((prev) => new Set(prev).add(targetSale.sales_scan_id));
      }

      // Reload list after any undo failure and trust each row's real is_undone status
      await loadHistory(limit, false);
      return;
    }

    // Success
    if (res.hadArchivedItems) {
      setSuccessBanner('Stock restored. The archived product/batches were restored too');
    } else {
      setSuccessBanner(
        `Sale for ${targetSale.product_name || 'item'} undone. Units restored to batches.`
      );
    }

    // Reload history to reflect restored stock and undone status
    await loadHistory(limit, false);
  };

  // Filtered list
  const filteredSales = useMemo(() => {
    const query = search.trim().toLowerCase();

    return sales.filter((sale) => {
      // 1. Search filter: matches product name or barcode
      if (query) {
        const nameMatch = sale.product_name
          ? sale.product_name.toLowerCase().includes(query)
          : false;
        const barcodeMatch = sale.product_barcode
          ? sale.product_barcode.toLowerCase().includes(query)
          : false;
        if (!nameMatch && !barcodeMatch) return false;
      }

      // 2. Chip status filter
      if (activeChip === 'Recorded' && sale.is_undone) return false;
      if (activeChip === 'Undone' && !sale.is_undone) return false;

      return true;
    });
  }, [sales, search, activeChip]);

  // Chip counts based on currently loaded sales
  const counts = useMemo(() => {
    const recorded = sales.filter((s) => !s.is_undone).length;
    const undone = sales.filter((s) => s.is_undone).length;
    return {
      All: sales.length,
      Recorded: recorded,
      Undone: undone,
    };
  }, [sales]);

  // Whether older sales might exist
  const mayHaveOlderSales = sales.length >= limit || limit >= 500;

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">History</h1>
          <p className="text-sm text-gray-600 mt-1">
            Sales are recorded in the mobile app. You can undo a wrong entry here.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing || isUndoing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-sm flex items-start justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-emerald-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 ml-4"
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {/* Action Error Notification Banner */}
      {actionErrorBanner && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded text-red-800 text-sm flex items-start justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-red-600 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{actionErrorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionErrorBanner(null)}
            className="text-red-700 hover:text-red-900 ml-4 font-bold"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Search & Filter bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name or barcode..."
              className="w-full px-3 py-2 pl-9 text-sm border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-xs text-gray-400 hover:text-gray-600"
              >
                Clear
              </button>
            )}
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-2">
            {CHIP_FILTERS.map((chip) => {
              const count = counts[chip];
              const isSelected = activeChip === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveChip(chip)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {chip} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Small note near search box */}
        <p className="text-xs text-gray-500">
          Search covers the latest {sales.length} sales loaded.
        </p>
      </div>

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <div className="py-16 text-center">
          <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-500">Loading sales history...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
          <p className="font-semibold text-sm">Unable to load sales history</p>
          <p className="text-xs text-red-700 mt-1">{error}</p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => loadHistory(limit, false)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        </div>
      ) : sales.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-gray-200 rounded p-12 text-center">
          <svg
            className="w-12 h-12 text-gray-300 mx-auto mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-base font-semibold text-gray-800">No sales yet</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            Sales are recorded in the mobile app. You can undo a wrong entry here.
          </p>
        </div>
      ) : filteredSales.length === 0 ? (
        /* Filter Empty State */
        <div className="bg-white border border-gray-200 rounded p-8 text-center">
          <p className="text-sm text-gray-600">No sales match your search or filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setActiveChip('All');
            }}
            className="mt-2 text-xs font-medium text-emerald-600 hover:text-emerald-700 underline"
          >
            Reset filters
          </button>
        </div>
      ) : (
        /* Sales List */
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded shadow-sm">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Product</th>
                  <th className="px-4 py-3 text-left font-semibold">Units Sold</th>
                  <th className="px-4 py-3 text-left font-semibold">Batches Used</th>
                  <th className="px-4 py-3 text-left font-semibold">Date &amp; Time</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredSales.map((sale) => {
                  const batchesFormatted =
                    sale.batch_breakdown.length > 0
                      ? sale.batch_breakdown.map(formatBatchItem).join(', ')
                      : 'N/A';
                  const isRowUndoing = undoingSaleId === sale.sales_scan_id;
                  const isAnyUndoRunning = undoingSaleId !== null;
                  const isUnclearDisabled = unclearFailedSaleIds.has(sale.sales_scan_id);
                  const isUndoDisabled = isAnyUndoRunning || isUnclearDisabled || refreshing;

                  return (
                    <tr
                      key={sale.sales_scan_id}
                      className={sale.is_undone ? 'bg-gray-50/60 text-gray-500' : 'hover:bg-gray-50/50'}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {sale.product_name}
                        </div>
                        {sale.product_barcode && (
                          <div className="text-xs text-gray-500 font-mono">
                            {sale.product_barcode}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-800">
                        {sale.total_quantity} {sale.total_quantity === 1 ? 'unit' : 'units'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-xs break-words">
                        {batchesFormatted}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                        {formatManilaDateTime(sale.created_at)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {sale.is_undone ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                            Undone
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Recorded
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        {!sale.is_undone && (
                          <button
                            type="button"
                            onClick={() => setSaleToUndo(sale)}
                            disabled={isUndoDisabled}
                            className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-40 transition-colors"
                          >
                            {isRowUndoing ? 'Undoing...' : 'Undo'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filteredSales.map((sale) => {
              const batchesFormatted =
                sale.batch_breakdown.length > 0
                  ? sale.batch_breakdown.map(formatBatchItem).join(', ')
                  : 'N/A';
              const isRowUndoing = undoingSaleId === sale.sales_scan_id;
              const isAnyUndoRunning = undoingSaleId !== null;
              const isUnclearDisabled = unclearFailedSaleIds.has(sale.sales_scan_id);
              const isUndoDisabled = isAnyUndoRunning || isUnclearDisabled || refreshing;

              return (
                <div
                  key={sale.sales_scan_id}
                  className={`bg-white border rounded p-4 shadow-sm space-y-2.5 ${
                    sale.is_undone ? 'border-gray-200 bg-gray-50/50' : 'border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {sale.product_name}
                      </h4>
                      {sale.product_barcode && (
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                          Barcode: {sale.product_barcode}
                        </p>
                      )}
                    </div>
                    <div>
                      {sale.is_undone ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          Undone
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Recorded
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-700 space-y-1">
                    <p>
                      <span className="font-medium text-gray-900">Units sold:</span>{' '}
                      {sale.total_quantity} {sale.total_quantity === 1 ? 'unit' : 'units'}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Time:</span>{' '}
                      {formatManilaDateTime(sale.created_at)}
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Batches used:</span>{' '}
                      <span className="text-gray-600">{batchesFormatted}</span>
                    </p>
                  </div>

                  {!sale.is_undone && (
                    <div className="pt-2 border-t border-gray-100 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSaleToUndo(sale)}
                        disabled={isUndoDisabled}
                        className="px-3 py-1 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-40 transition-colors"
                      >
                        {isRowUndoing ? 'Undoing...' : 'Undo'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* "Show more" button and older sales note */}
          <div className="pt-4 text-center space-y-2">
            {sales.length >= limit && limit < 500 && (
              <button
                type="button"
                onClick={handleShowMore}
                disabled={loadingMore || refreshing || isUndoing}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? 'Loading more...' : 'Show more'}
              </button>
            )}

            {mayHaveOlderSales && (
              <p className="text-xs text-gray-500">
                Older sales recorded in the mobile app may not be shown once limits are reached.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ConfirmModal for Undo */}
      <ConfirmModal
        isOpen={Boolean(saleToUndo)}
        title="Undo Sale"
        message={
          saleToUndo
            ? `Put ${saleToUndo.total_quantity} ${
                saleToUndo.total_quantity === 1 ? 'unit' : 'units'
              } back into the same batches?`
            : ''
        }
        confirmText="Confirm Undo"
        cancelText="Cancel"
        isSaving={isUndoing}
        onConfirm={handleConfirmUndo}
        onCancel={() => {
          if (!isUndoing) {
            setSaleToUndo(null);
          }
        }}
      />
    </div>
  );
}
