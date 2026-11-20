'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  History,
  RefreshCw,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { getSaleHistory, undoSale } from '../../../lib/inventory';
import { getUserSubscription } from '../../../lib/subscription';
import { useRealtime } from '../../../lib/realtime';
import { SaleHistoryRecord, SaleBatchBreakdownItem } from '../../../types/inventory';
import { formatManilaDateTime, formatDisplayDate } from '../../../lib/date';
import { ConfirmModal } from '../../../components/ConfirmModal';

const CHIP_FILTERS = ['All', 'Recorded', 'Undone'] as const;
type ChipFilter = (typeof CHIP_FILTERS)[number];

function formatBatchItem(b: SaleBatchBreakdownItem): string {
  const code = b.batch_id.replace(/-/g, '').slice(0, 8).toUpperCase();
  const unitStr = `${b.quantity} ${b.quantity === 1 ? 'unit' : 'units'}`;
  const expStr = b.expiration_date ? `exp ${formatDisplayDate(b.expiration_date)}` : '';
  return `B-${code} (${unitStr}${expStr ? `, ${expStr}` : ''})`;
}

export default function HistoryPage() {
  const { dataVersion } = useRealtime();
  const [sales, setSales] = useState<SaleHistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUserSubscription()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.data) {
          setIsPremium(res.data.is_premium);
        } else {
          setIsPremium(false);
        }
      })
      .catch(() => {
        if (!cancelled) setIsPremium(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
        return;
      }

      loadHistory(limit, false);
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadHistory, limit]);

  const initialDataVersionRef = useRef(dataVersion);
  const pendingReloadOnActionEnd = useRef(false);

  // Realtime silent refresh on dataVersion change
  useEffect(() => {
    let active = true;
    if (dataVersion === initialDataVersionRef.current) {
      return;
    }
    if (isUndoing || undoingSaleId !== null) {
      pendingReloadOnActionEnd.current = true;
      return;
    }
    const run = async () => {
      if (!active) return;
      await loadHistory(limit, false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [dataVersion, isUndoing, undoingSaleId, limit, loadHistory]);

  // When undo action finishes, execute pending reload
  useEffect(() => {
    let active = true;
    if (!isUndoing && undoingSaleId === null && pendingReloadOnActionEnd.current) {
      pendingReloadOnActionEnd.current = false;
      const run = async () => {
        if (!active) return;
        await loadHistory(limit, false);
      };
      void run();
    }
    return () => {
      active = false;
    };
  }, [isUndoing, undoingSaleId, limit, loadHistory]);

  // Filtered and searched sales list
  const filteredSales = useMemo(() => {
    return sales.filter((item) => {
      // Status chip filter
      if (activeChip === 'Recorded' && item.is_undone) return false;
      if (activeChip === 'Undone' && !item.is_undone) return false;

      // Substring search on name OR barcode
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = item.product_name.toLowerCase().includes(query);
        const matchesBarcode = item.product_barcode
          ? item.product_barcode.toLowerCase().includes(query)
          : false;
        if (!matchesName && !matchesBarcode) return false;
      }

      return true;
    });
  }, [sales, activeChip, search]);

  // Counts for filter chips
  const counts = useMemo(() => {
    let recorded = 0;
    let undone = 0;
    for (const s of sales) {
      if (s.is_undone) {
        undone++;
      } else {
        recorded++;
      }
    }
    return {
      All: sales.length,
      Recorded: recorded,
      Undone: undone,
    };
  }, [sales]);

  const handleManualRefresh = () => {
    if (isFetchingRef.current) return;
    loadHistory(limit, true);
  };

  const handleLoadMore = () => {
    if (limit >= 500) return;
    const nextLimit = Math.min(limit + 50, 500);
    setLimit(nextLimit);
    setLoadingMore(true);
    loadHistory(nextLimit, false);
  };

  const handleConfirmUndo = async () => {
    if (!saleToUndo) return;
    const targetSale = saleToUndo;
    setSaleToUndo(null);
    setUndoingSaleId(targetSale.sales_scan_id);
    setIsUndoing(true);
    setSuccessBanner(null);
    setActionErrorBanner(null);

    const res = await undoSale(targetSale.sales_scan_id);
    setIsUndoing(false);
    setUndoingSaleId(null);

    if (res.kind === 'success') {
      setSuccessBanner(
        `Sale of ${targetSale.total_quantity} unit(s) of "${targetSale.product_name}" was successfully undone. Batches have been replenished to their original inventory.`
      );
      loadHistory(limit, false);
      return;
    }

    if (res.kind === 'error') {
      if (res.isAlreadyUndone) {
        setActionErrorBanner(
          `This sale of "${targetSale.product_name}" has already been undone.`
        );
        loadHistory(limit, false);
        return;
      }

      if (res.isDatabaseError) {
        setActionErrorBanner(`Unable to undo sale: ${res.message}`);
        return;
      }

      // Network / timeout error: keep button disabled until fresh reload
      setActionErrorBanner(
        `Network issue while undoing sale: ${res.message}. The action may have succeeded on the server. Please refresh to verify.`
      );
      setUnclearFailedSaleIds((prev) => new Set(prev).add(targetSale.sales_scan_id));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Refresh Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#ece3d2]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#181413] tracking-tight">Movement &amp; Audit History</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef9f0] text-[#7a7469] border border-[#ece3d2]">
              {sales.length} records loaded
            </span>
          </div>
          <p className="text-xs text-[#7a7469] mt-1">
            Complete audit trail of sales and batch deductions. Undo restores units to original batches.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#ece3d2] bg-white text-xs font-bold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh History'}
          </button>
        </div>
      </div>

      {/* Free Plan 7-Day Limit Notice */}
      {isPremium === false && (
        <div className="p-3.5 bg-[#FEF3C7] border border-[#FDE68A] rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#92400E]">
            <span className="bg-[#F59E0B] text-white font-extrabold text-[10px] px-2 py-0.5 rounded shadow-2xs">
              FREE PLAN
            </span>
            <span>
              Showing sales recorded in the last 7 days. Upgrade to Premium for full lifetime sales history.
            </span>
          </div>
          <Link
            href="/subscription"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#207429] text-white text-xs font-bold hover:bg-[#185E21] shadow-2xs shrink-0 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade</span>
          </Link>
        </div>
      )}

      {/* Success Notification Banner */}
      {successBanner && (
        <div className="p-4 bg-[#f4ffe1] border border-[#207429]/30 rounded-2xl text-[#207429] text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#207429]" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-[#207429] hover:text-[#185e21] font-bold text-xs px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Action Error Notification Banner */}
      {actionErrorBanner && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{actionErrorBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionErrorBanner(null)}
            className="text-red-700 hover:text-red-900 font-bold text-xs px-2 py-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search & Filter bar */}
      <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-3 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product name or barcode..."
              className="w-full pl-9 pr-8 py-2 text-xs md:text-sm bg-[#f8faf8] border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429] focus:bg-white transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[#999182] hover:text-[#181413]"
              >
                Clear
              </button>
            )}
          </div>

          {/* Chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {CHIP_FILTERS.map((chip) => {
              const count = counts[chip];
              const isSelected = activeChip === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveChip(chip)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    isSelected
                      ? 'bg-[#207429] text-white shadow-2xs'
                      : 'bg-[#fef9f0] text-[#524c40] border border-[#ece3d2] hover:bg-white'
                  }`}
                >
                  {chip} ({count})
                </button>
              );
            })}
          </div>
        </div>

        <p className="text-[11px] text-[#999182]">
          Searching across latest {sales.length} transactions loaded from audit log.
        </p>
      </div>

      {/* Main Content Area */}
      {loading && !refreshing ? (
        <div className="py-16 text-center text-[#7a7469] text-sm flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[#207429] border-t-transparent rounded-full animate-spin" />
          <p className="font-medium">Loading sales history...</p>
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 shadow-xs">
          <p className="font-bold text-sm">Unable to load sales history</p>
          <p className="text-xs text-red-700 mt-1">{error}</p>
          <div className="mt-3">
            <button
              type="button"
              onClick={() => loadHistory(limit, false)}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-white bg-[#d32f2f] rounded-xl hover:bg-red-700"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        </div>
      ) : sales.length === 0 ? (
        /* Empty State */
        <div className="bg-white border border-dashed border-[#ece3d2] rounded-2xl p-12 text-center shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#f4ffe1] text-[#207429] mx-auto flex items-center justify-center mb-3">
            <History className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#181413]">No sales transactions yet</h3>
          <p className="text-xs text-[#7a7469] mt-1 max-w-sm mx-auto">
            Sales recorded via POS will appear here with complete batch deductions.
          </p>
        </div>
      ) : filteredSales.length === 0 ? (
        /* Filter Empty State */
        <div className="bg-white border border-dashed border-[#ece3d2] rounded-2xl p-8 text-center shadow-2xs">
          <p className="text-xs text-[#7a7469]">No transactions match your search query or filter.</p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setActiveChip('All');
            }}
            className="mt-2 text-xs font-bold text-[#207429] hover:underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        /* Sales List */
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto bg-white border border-[#ece3d2] rounded-2xl shadow-2xs">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#fef9f0] border-b border-[#ece3d2] text-[#7a7469] font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Product &amp; Barcode</th>
                  <th className="py-3 px-4">Units Deducted</th>
                  <th className="py-3 px-4">Batches Used</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1ea]">
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
                      className={sale.is_undone ? 'bg-[#fafafa] text-[#999182]' : 'hover:bg-[#fef9f0]/40 transition-colors'}
                    >
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-[#181413]">
                          {sale.product_name}
                        </div>
                        {sale.product_barcode && (
                          <div className="text-[11px] text-[#7a7469] font-mono">
                            {sale.product_barcode}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-black text-[#181413]">
                        {sale.total_quantity} {sale.total_quantity === 1 ? 'unit' : 'units'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#524c40] max-w-xs break-words font-mono">
                        {batchesFormatted}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#7a7469] whitespace-nowrap">
                        {formatManilaDateTime(sale.created_at)}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sale.is_undone ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                            Undone
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#f4ffe1] text-[#207429] border border-[#207429]/30">
                            Recorded
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 whitespace-nowrap text-right">
                        {!sale.is_undone && (
                          <button
                            type="button"
                            onClick={() => setSaleToUndo(sale)}
                            disabled={isUndoDisabled}
                            className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-[#d32f2f] bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
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
                  className={`bg-white border border-[#ece3d2] rounded-xl p-4 shadow-2xs space-y-2.5 ${
                    sale.is_undone ? 'opacity-70 bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-[#181413]">{sale.product_name}</h4>
                      {sale.product_barcode && (
                        <p className="text-[11px] text-[#7a7469] font-mono">{sale.product_barcode}</p>
                      )}
                    </div>
                    {sale.is_undone ? (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                        Undone
                      </span>
                    ) : (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-[#f4ffe1] text-[#207429] border border-[#207429]/30">
                        Recorded
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-[#524c40] space-y-1">
                    <p>
                      <span className="font-bold text-[#181413]">{sale.total_quantity} units</span> deducted
                    </p>
                    <p className="font-mono text-[11px] text-[#7a7469]">{batchesFormatted}</p>
                    <p className="text-[11px] text-[#999182]">{formatManilaDateTime(sale.created_at)}</p>
                  </div>

                  {!sale.is_undone && (
                    <div className="pt-2 border-t border-[#f4f1ea] flex justify-end">
                      <button
                        type="button"
                        onClick={() => setSaleToUndo(sale)}
                        disabled={isUndoDisabled}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-[#d32f2f] bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {isRowUndoing ? 'Undoing...' : 'Undo Sale'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Load More Pagination */}
          {limit < 500 && sales.length >= limit && (
            <div className="pt-4 text-center">
              <button
                type="button"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#ece3d2] rounded-xl text-xs font-bold text-[#181413] hover:bg-[#fef9f0] shadow-2xs transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading older transactions...' : 'Load 50 More Transactions'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Undo Confirmation Modal */}
      {saleToUndo && (
        <ConfirmModal
          isOpen={true}
          title="Undo Sale Transaction?"
          message={`Are you sure you want to undo the sale of ${saleToUndo.total_quantity} unit(s) of "${saleToUndo.product_name}"? Units will be returned to their exact original batches.`}
          confirmText="Yes, undo sale"
          cancelText="Cancel"
          isSaving={isUndoing}
          onConfirm={handleConfirmUndo}
          onCancel={() => setSaleToUndo(null)}
        />
      )}
    </div>
  );
}