'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Package,
  Plus,
  RefreshCw,
  Search,
  Archive,
  RotateCcw,
  Boxes,
  Layers,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Filter,
  X,
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { getInventory, getCategories, getArchivedProducts, restoreProduct } from '../../../lib/inventory';
import { ProductWithBatches, Category, ProductStockStatus, Product } from '../../../types/inventory';
import { ConfirmModal } from '../../../components/ConfirmModal';

const STATUS_FILTERS = ['All Stocks', 'Low Stock', 'Near Expiry', 'Expired'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default function InventoryPage() {
  const { near_expiry_days, loading: settingsLoading, error: settingsError, reload: reloadSettings } = useStoreSettings();

  const [products, setProducts] = useState<ProductWithBatches[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilter>('All Stocks');

  // Archived products state
  const [showArchived, setShowArchived] = useState(false);
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [archivedLoadError, setArchivedLoadError] = useState<string | null>(null);

  // Restore action state
  const [restoringProduct, setRestoringProduct] = useState<Product | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreErrors, setRestoreErrors] = useState<{ [productId: string]: string }>({});
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [actionRunning, setActionRunning] = useState(false);

  // Request counter to ignore stale out-of-order responses
  const fetchRequestId = useRef(0);
  const isFetchingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (near_expiry_days === null || settingsLoading || settingsError) {
      return;
    }

    const currentRequestId = ++fetchRequestId.current;
    isFetchingRef.current = true;

    const [invRes, catRes] = await Promise.all([
      getInventory(near_expiry_days),
      getCategories(),
    ]);

    // If another fetch started while this was running, ignore this response
    if (currentRequestId !== fetchRequestId.current) {
      return;
    }

    isFetchingRef.current = false;

    if (invRes.kind === 'error') {
      setError(invRes.message);
      setLoading(false);
      return;
    }

    setError(null);
    setProducts(invRes.products);

    if (catRes.kind === 'success') {
      setCategories(catRes.categories);
    }

    setLoading(false);
  }, [near_expiry_days, settingsLoading, settingsError]);

  const loadArchivedData = useCallback(async () => {
    setLoadingArchived(true);
    const res = await getArchivedProducts();
    setLoadingArchived(false);

    if (res.kind === 'success') {
      setArchivedProducts(res.products);
      setArchivedLoadError(null);
    } else {
      setArchivedLoadError(res.message);
    }
  }, []);

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

  // Load archived products when toggle is enabled
  useEffect(() => {
    let active = true;
    if (showArchived && !settingsLoading && !settingsError) {
      const run = async () => {
        if (!active) return;
        await loadArchivedData();
      };
      run();
    }
    return () => {
      active = false;
    };
  }, [showArchived, settingsLoading, settingsError, loadArchivedData]);

  // Reload when window regains focus, ignoring if a fetch is already in progress
  useEffect(() => {
    const handleFocus = () => {
      if (!isFetchingRef.current && !settingsLoading && !settingsError && near_expiry_days !== null) {
        loadData();
        if (showArchived) {
          loadArchivedData();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData, loadArchivedData, settingsLoading, settingsError, near_expiry_days, showArchived]);

  // Filtering: Search by name OR barcode
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (search.trim() !== '') {
        const query = search.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(query);
        const matchesBarcode = prod.barcode ? prod.barcode.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesBarcode) {
          return false;
        }
      }

      if (selectedCategory !== 'All') {
        const catName = prod.category?.name || 'Uncategorized';
        if (catName !== selectedCategory) {
          return false;
        }
      }

      if (selectedStatus !== 'All Stocks') {
        if (selectedStatus === 'Low Stock' && !prod.statuses.includes('Low stock')) {
          return false;
        }
        if (selectedStatus === 'Near Expiry' && !prod.statuses.includes('Near expiry')) {
          return false;
        }
        if (selectedStatus === 'Expired' && !prod.statuses.includes('Has expired stock')) {
          return false;
        }
      }

      return true;
    });
  }, [products, search, selectedCategory, selectedStatus]);

  // Group filtered products by Category
  const groupedProducts = useMemo(() => {
    const groups: { [cat: string]: ProductWithBatches[] } = {};
    for (const prod of filteredProducts) {
      const cat = prod.category?.name || 'Uncategorized';
      if (!groups[cat]) {
        groups[cat] = [];
      }
      groups[cat].push(prod);
    }

    return Object.keys(groups)
      .sort((a, b) => {
        if (a === 'Uncategorized') return 1;
        if (b === 'Uncategorized') return -1;
        return a.localeCompare(b);
      })
      .map((cat) => ({
        categoryName: cat,
        items: groups[cat],
      }));
  }, [filteredProducts]);

  const totalProducts = products.length;
  const totalUnits = useMemo(
    () => products.reduce((acc, p) => acc + p.total_units, 0),
    [products]
  );

  const handleOpenRestoreModal = (prod: Product) => {
    if (actionRunning) return;
    setRestoringProduct(prod);
    setShowRestoreModal(true);
  };

  const handleConfirmRestore = async () => {
    if (!restoringProduct) return;
    setShowRestoreModal(false);
    setActionRunning(true);
    setRestoreSuccess(null);

    const prodId = restoringProduct.id;
    const res = await restoreProduct(prodId);

    if (res.kind === 'db_error') {
      setRestoreErrors((prev) => ({ ...prev, [prodId]: res.message }));
      setActionRunning(false);
      return;
    }

    if (res.kind === 'network_error') {
      setArchivedLoadError(res.message);
      await Promise.all([loadData(), loadArchivedData()]);
      setActionRunning(false);
      return;
    }

    // Success
    setRestoreSuccess(`Restored "${restoringProduct.name}" to active inventory.`);
    setRestoreErrors((prev) => {
      const copy = { ...prev };
      delete copy[prodId];
      return copy;
    });
    await Promise.all([loadData(), loadArchivedData()]);
    setActionRunning(false);
  };

  const getBadgeClass = (status: ProductStockStatus) => {
    switch (status) {
      case 'Has expired stock':
        return 'bg-[#fee2e2] text-[#d32f2f] border-[#fca5a5]';
      case 'Near expiry':
        return 'bg-[#fef3c7] text-[#b45309] border-[#fde68a]';
      case 'Low stock':
        return 'bg-[#ffedd5] text-[#c2410c] border-[#fed7aa]';
      case 'In Stock':
      default:
        return 'bg-[#f4ffe1] text-[#207429] border-[#207429]/30';
    }
  };

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
            <h2 className="font-bold text-base">Error Loading Inventory</h2>
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
    <div className="space-y-6">
      {/* Restore Success Toast */}
      {restoreSuccess && (
        <div className="p-4 border border-[#207429]/30 bg-[#f4ffe1] text-[#207429] text-xs md:text-sm rounded-xl font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#207429]" />
            <span>{restoreSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setRestoreSuccess(null)}
            aria-label="Dismiss restore notification"
            className="text-[#207429] hover:text-[#185e21] p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#ece3d2]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#181413] tracking-tight">Inventory</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#fef9f0] text-[#7a7469] border border-[#ece3d2]">
              {totalProducts} products • {totalUnits} total units
            </span>
          </div>
          <p className="text-xs text-[#7a7469] mt-1">
            Track batches, monitor expiration dates, and manage active stock.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              loadData();
              if (showArchived) loadArchivedData();
            }}
            disabled={actionRunning}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#ece3d2] bg-white text-xs font-semibold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <Link
            href="/inventory/add-stock"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#ece3d2] bg-white text-xs font-semibold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs ${
              actionRunning ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#207429]" />
            Add Stock
          </Link>
          <Link
            href="/inventory/new"
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#207429] text-white text-xs font-bold hover:bg-[#185e21] transition-colors shadow-xs ${
              actionRunning ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            New Product
          </Link>
        </div>
      </div>

      {/* Search, Filter Bar, and Archive Toggle */}
      <div className="bg-white border border-[#ece3d2] rounded-2xl p-4 md:p-5 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
            <input
              type="text"
              placeholder="Search by product name or barcode..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              disabled={actionRunning}
              className="w-full pl-9 pr-4 py-2 text-xs md:text-sm bg-[#f8faf8] border border-[#ece3d2] rounded-xl text-[#181413] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#207429] focus:bg-white transition-all disabled:opacity-50"
            />
          </div>

          <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-bold text-[#524c40] select-none hover:text-[#181413]">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              disabled={actionRunning}
              className="rounded border-[#d1d5db] text-[#207429] focus:ring-[#207429] h-4 w-4"
            />
            <Archive className="w-3.5 h-3.5 text-[#7a7469]" />
            <span>Show archived products</span>
          </label>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#f4f1ea]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#999182] mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Category:
          </span>
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            disabled={actionRunning}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
              selectedCategory === 'All'
                ? 'bg-[#207429] text-white shadow-2xs'
                : 'bg-[#fef9f0] text-[#524c40] border border-[#ece3d2] hover:bg-white'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              disabled={actionRunning}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                selectedCategory === cat.name
                  ? 'bg-[#207429] text-white shadow-2xs'
                  : 'bg-[#fef9f0] text-[#524c40] border border-[#ece3d2] hover:bg-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Stock Status Filters */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#999182] mr-1">
            Status:
          </span>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              disabled={actionRunning}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 ${
                selectedStatus === status
                  ? 'bg-[#181413] text-white shadow-2xs'
                  : 'bg-[#f8faf8] text-[#524c40] border border-[#ece3d2] hover:bg-white'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="py-16 text-center text-[#7a7469] text-sm flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[#207429] border-t-transparent rounded-full animate-spin" />
          <p className="font-medium">Loading inventory...</p>
        </div>
      )}

      {/* Empty State: No products in database */}
      {!loading && products.length === 0 && (
        <div className="border border-dashed border-[#ece3d2] rounded-2xl p-12 text-center bg-white shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#f4ffe1] text-[#207429] mx-auto flex items-center justify-center mb-3">
            <Package className="w-6 h-6" />
          </div>
          <h2 className="text-[#181413] font-bold text-base mb-1">No products in inventory yet</h2>
          <p className="text-[#7a7469] text-xs max-w-sm mx-auto mb-5 leading-relaxed">
            Get started by adding your first product and receiving your initial stock batch.
          </p>
          <Link
            href="/inventory/new"
            className="inline-flex items-center gap-2 bg-[#207429] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Create First Product
          </Link>
        </div>
      )}

      {/* Empty State: Filter yielded no results */}
      {!loading && products.length > 0 && filteredProducts.length === 0 && (
        <div className="border border-dashed border-[#ece3d2] rounded-2xl p-8 text-center bg-white shadow-2xs">
          <p className="text-[#181413] font-bold text-sm mb-1">No products match your filter</p>
          <p className="text-[#7a7469] text-xs">Try clearing the search query or changing category and status filters.</p>
        </div>
      )}

      {/* Grouped Product List */}
      {!loading && filteredProducts.length > 0 && (
        <div className="space-y-6">
          {groupedProducts.map((group) => (
            <div key={group.categoryName} className="space-y-3">
              <div className="flex items-center justify-between border-b border-[#ece3d2] pb-2">
                <div className="flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-[#207429]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#181413]">
                    {group.categoryName}
                  </h2>
                </div>
                <span className="text-xs font-semibold text-[#7a7469] bg-[#fef9f0] px-2 py-0.5 rounded-md border border-[#ece3d2]">
                  {group.items.length} product(s)
                </span>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto bg-white border border-[#ece3d2] rounded-2xl shadow-2xs">
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#fef9f0] border-b border-[#ece3d2] text-[#7a7469] font-bold text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-5">Product & SKU</th>
                      <th className="py-3 px-4">Barcode</th>
                      <th className="py-3 px-4">Price</th>
                      <th className="py-3 px-4">Total Units</th>
                      <th className="py-3 px-4">Batches</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f1ea]">
                    {group.items.map((prod) => (
                      <tr key={prod.id} className="hover:bg-[#fef9f0]/40 transition-colors group">
                        <td className="py-3.5 px-5">
                          <Link
                            href={`/inventory/${prod.id}`}
                            className="font-bold text-[#181413] hover:text-[#207429] transition-colors block text-sm"
                          >
                            {prod.name}
                          </Link>
                          {prod.low_stock_level && (
                            <span className="text-[10px] text-[#999182]">
                              Alert at ≤ {prod.low_stock_level} units
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs text-[#7a7469]">
                          {prod.barcode || '—'}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-[#181413]">
                          ₱{prod.price.toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-extrabold text-[#181413]">
                            {prod.total_units}
                          </span>
                          <span className="text-[11px] text-[#7a7469] ml-1">units</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-[#f8faf8] border border-[#ece3d2] text-[#4a443a]">
                            {prod.batch_count} {prod.batch_count === 1 ? 'batch' : 'batches'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {prod.statuses.map((st) => (
                              <span
                                key={st}
                                className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border font-bold ${getBadgeClass(st)}`}
                              >
                                {st}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <Link
                            href={`/inventory/${prod.id}`}
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#207429] hover:underline"
                          >
                            <span>Manage</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {group.items.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/inventory/${prod.id}`}
                    className="block bg-white border border-[#ece3d2] rounded-xl p-4 shadow-2xs hover:border-[#207429] transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-[#181413]">{prod.name}</h3>
                      <span className="font-bold text-sm text-[#207429]">
                        ₱{prod.price.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#7a7469] mt-2">
                      <span>Barcode: {prod.barcode || '—'}</span>
                      <span className="font-bold text-[#181413]">
                        {prod.total_units} units ({prod.batch_count} batches)
                      </span>
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {prod.statuses.map((st) => (
                        <span
                          key={st}
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${getBadgeClass(st)}`}
                        >
                          {st}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Archived Products Section */}
      {showArchived && (
        <div className="mt-10 pt-6 border-t border-[#ece3d2] space-y-4">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-[#7a7469]" />
            <h2 className="text-base font-bold text-[#181413]">Archived Products</h2>
          </div>
          <p className="text-xs text-[#7a7469]">
            Archived items are hidden from normal POS checkout and inventory count. You can restore them below.
          </p>

          {archivedLoadError && (
            <div className="p-3 border border-red-200 bg-red-50 text-red-700 text-xs rounded-xl">
              {archivedLoadError}
            </div>
          )}

          {loadingArchived ? (
            <div className="py-6 text-center text-[#7a7469] text-xs">
              Loading archived products...
            </div>
          ) : archivedProducts.length === 0 ? (
            <div className="border border-dashed border-[#ece3d2] rounded-xl p-6 text-center bg-white text-xs text-[#7a7469]">
              No archived products.
            </div>
          ) : (
            <div className="bg-white border border-[#ece3d2] rounded-2xl overflow-hidden shadow-2xs divide-y divide-[#f4f1ea]">
              {archivedProducts.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-sm text-[#181413]">{p.name}</h3>
                    <p className="text-xs text-[#7a7469]">
                      Barcode: {p.barcode || '—'} • Price: ₱{p.price.toFixed(2)}
                    </p>
                    {restoreErrors[p.id] && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{restoreErrors[p.id]}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenRestoreModal(p)}
                    disabled={actionRunning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ece3d2] bg-[#fef9f0] text-xs font-bold text-[#207429] hover:bg-[#f4ffe1] transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={showRestoreModal}
        title="Restore Product"
        message={`Are you sure you want to restore "${restoringProduct?.name}" to active inventory?`}
        confirmText="Yes, restore"
        cancelText="Cancel"
        isSaving={actionRunning}
        onConfirm={handleConfirmRestore}
        onCancel={() => setShowRestoreModal(false)}
      />
    </div>
  );
}