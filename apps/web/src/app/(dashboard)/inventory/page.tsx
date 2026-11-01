'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { getInventory, getCategories } from '../../../lib/inventory';
import { ProductWithBatches, Category, ProductStockStatus } from '../../../types/inventory';

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

  // Reload when window regains focus, ignoring if a fetch is already in progress
  useEffect(() => {
    const handleFocus = () => {
      if (!isFetchingRef.current && !settingsLoading && !settingsError && near_expiry_days !== null) {
        loadData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData, settingsLoading, settingsError, near_expiry_days]);

  // Totals of all non-archived products (NOT the filtered list)
  const totalProducts = products.length;
  const totalUnits = useMemo(() => {
    return products.reduce((acc, p) => acc + p.total_units, 0);
  }, [products]);

  // Filtered products based on search, category chip, and status chip
  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      // 1. Search by name or barcode
      if (query) {
        const matchesName = product.name.toLowerCase().includes(query);
        const matchesBarcode = product.barcode ? product.barcode.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesBarcode) {
          return false;
        }
      }

      // 2. Category filter
      if (selectedCategory !== 'All') {
        const productCategoryName = product.category?.name || 'Uncategorized';
        if (productCategoryName !== selectedCategory) {
          return false;
        }
      }

      // 3. Status filter
      if (selectedStatus === 'Low Stock') {
        if (!product.statuses.includes('Low stock')) return false;
      } else if (selectedStatus === 'Near Expiry') {
        if (!product.statuses.includes('Near expiry')) return false;
      } else if (selectedStatus === 'Expired') {
        if (!product.statuses.includes('Has expired stock')) return false;
      }

      return true;
    });
  }, [products, search, selectedCategory, selectedStatus]);

  // Group filtered products by category
  const groupedProducts = useMemo(() => {
    const groups: { [catName: string]: ProductWithBatches[] } = {};

    for (const prod of filteredProducts) {
      const catName = prod.category?.name || 'Uncategorized';
      if (!groups[catName]) {
        groups[catName] = [];
      }
      groups[catName].push(prod);
    }

    return Object.keys(groups)
      .sort((a, b) => a.localeCompare(b))
      .map((catName) => ({
        categoryName: catName,
        items: groups[catName],
      }));
  }, [filteredProducts]);

  // Badge styling helper
  const getBadgeClass = (status: ProductStockStatus) => {
    switch (status) {
      case 'Has expired stock':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Near expiry':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Low stock':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'In Stock':
      default:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

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
      <div className="border border-red-300 bg-red-50 p-6 rounded text-red-800 max-w-md my-4">
        <h2 className="font-bold text-base mb-1">Error Loading Inventory</h2>
        <p className="text-sm mb-4">{error}</p>
        <button
          type="button"
          onClick={() => loadData()}
          className="bg-black text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <p className="text-sm text-gray-600 mt-1">
            {totalProducts} products • {totalUnits} units
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => loadData()}
            className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100"
          >
            Refresh
          </button>
          <Link
            href="/inventory/add-stock"
            className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-100 font-medium"
          >
            Add stock
          </Link>
          <Link
            href="/inventory/new"
            className="bg-black text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-800"
          >
            New product
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        {/* Search Input */}
        <div>
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:max-w-md border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
          />
        </div>

        {/* Category Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Category:</span>
          <button
            type="button"
            onClick={() => setSelectedCategory('All')}
            className={`px-2.5 py-1 rounded text-xs font-medium border ${
              selectedCategory === 'All'
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-2.5 py-1 rounded text-xs font-medium border ${
                selectedCategory === cat.name
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Status Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 uppercase mr-1">Status:</span>
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
              className={`px-2.5 py-1 rounded text-xs font-medium border ${
                selectedStatus === status
                  ? 'bg-black text-white border-black'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Loading state indicator */}
      {loading && (
        <div className="py-12 text-center text-gray-500 text-sm">
          Loading inventory...
        </div>
      )}

      {/* Empty State: No products in database at all */}
      {!loading && products.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded p-12 text-center bg-white">
          <p className="text-gray-900 font-medium text-base mb-1">No products in inventory yet</p>
          <p className="text-gray-500 text-sm mb-4">
            Get started by adding your first product and initial stock.
          </p>
          <Link
            href="/inventory/new"
            className="inline-block bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
          >
            Create first product
          </Link>
        </div>
      )}

      {/* Empty State: Search/filter yielded no results */}
      {!loading && products.length > 0 && filteredProducts.length === 0 && (
        <div className="border border-dashed border-gray-300 rounded p-8 text-center bg-white">
          <p className="text-gray-900 font-medium text-sm mb-1">No products match</p>
          <p className="text-gray-500 text-xs">Try another search or filter.</p>
        </div>
      )}

      {/* Grouped Product List */}
      {!loading && filteredProducts.length > 0 && (
        <div className="space-y-8">
          {groupedProducts.map((group) => (
            <div key={group.categoryName} className="space-y-3">
              <h2 className="text-lg font-bold text-gray-800 border-b border-gray-200 pb-2">
                {group.categoryName} ({group.items.length})
              </h2>

              {/* Wide screens: Table */}
              <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium text-xs">
                    <tr>
                      <th className="py-2.5 px-4">Product</th>
                      <th className="py-2.5 px-4">Barcode</th>
                      <th className="py-2.5 px-4">Price</th>
                      <th className="py-2.5 px-4">Total units</th>
                      <th className="py-2.5 px-4">Batches</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {group.items.map((prod) => (
                      <tr key={prod.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-gray-900">
                          <Link href={`/inventory/${prod.id}`} className="hover:underline">
                            {prod.name}
                          </Link>
                        </td>
                        <td className="py-3 px-4 text-gray-500">{prod.barcode || '—'}</td>
                        <td className="py-3 px-4 text-gray-700">₱{prod.price.toFixed(2)}</td>
                        <td className="py-3 px-4 text-gray-900 font-semibold">{prod.total_units}</td>
                        <td className="py-3 px-4 text-gray-500">{prod.batch_count}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {prod.statuses.map((st) => (
                              <span
                                key={st}
                                className={`text-[11px] px-2 py-0.5 rounded border font-medium ${getBadgeClass(st)}`}
                              >
                                {st}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile screens: Cards */}
              <div className="md:hidden space-y-3">
                {group.items.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/inventory/${prod.id}`}
                    className="block bg-white border border-gray-200 rounded p-4 hover:border-gray-400 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-gray-900 text-sm">{prod.name}</h3>
                      <span className="text-sm font-bold text-gray-900">
                        {prod.total_units} units
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mt-1">
                      Barcode: {prod.barcode || 'None'} • ₱{prod.price.toFixed(2)}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1">
                      {prod.statuses.map((st) => (
                        <span
                          key={st}
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${getBadgeClass(st)}`}
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
    </div>
  );
}
