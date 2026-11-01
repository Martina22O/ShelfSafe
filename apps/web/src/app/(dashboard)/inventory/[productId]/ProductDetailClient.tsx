'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useStoreSettings } from '../../../../context/StoreSettingsContext';
import { getProductWithBatches } from '../../../../lib/inventory';
import { ProductWithBatches, ProductStockStatus, BatchStockStatus } from '../../../../types/inventory';
import { formatDisplayDate, getTodayInManila, getBatchStatus } from '../../../../lib/date';

interface ProductDetailClientProps {
  productId: string;
}

export function ProductDetailClient({ productId }: ProductDetailClientProps) {
  const { near_expiry_days, loading: settingsLoading, error: settingsError, reload: reloadSettings } = useStoreSettings();

  const [product, setProduct] = useState<ProductWithBatches | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequestId = useRef(0);
  const isFetchingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (near_expiry_days === null || settingsLoading || settingsError) {
      return;
    }

    const currentRequestId = ++fetchRequestId.current;
    isFetchingRef.current = true;

    const res = await getProductWithBatches(productId, near_expiry_days);

    if (currentRequestId !== fetchRequestId.current) {
      return;
    }

    isFetchingRef.current = false;

    if (res.kind === 'error') {
      setError(res.message);
      setLoading(false);
      return;
    }

    setError(null);

    if (res.kind === 'not_found') {
      setIsNotFound(true);
      setProduct(null);
      setLoading(false);
      return;
    }

    if (res.kind === 'archived') {
      setIsArchived(true);
      setProduct(null);
      setLoading(false);
      return;
    }

    setIsNotFound(false);
    setIsArchived(false);
    setProduct(res.data);
    setLoading(false);
  }, [productId, near_expiry_days, settingsLoading, settingsError]);

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

  // Focus reload, avoiding duplicate concurrent fetch
  useEffect(() => {
    const handleFocus = () => {
      if (!isFetchingRef.current && !settingsLoading && !settingsError && near_expiry_days !== null) {
        loadData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData, settingsLoading, settingsError, near_expiry_days]);

  const getProductBadgeClass = (status: ProductStockStatus) => {
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

  const getBatchBadgeClass = (status: BatchStockStatus) => {
    switch (status) {
      case 'Expired':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Near Expiry':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Sold out':
        return 'bg-gray-100 text-gray-700 border-gray-300';
      case 'Good':
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

  if (isArchived) {
    return (
      <div className="space-y-4 max-w-lg">
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← Back to Inventory
        </Link>
        <div className="border border-gray-200 bg-white p-6 rounded">
          <h1 className="text-xl font-bold text-gray-900 mb-2">This product is archived</h1>
          <p className="text-sm text-gray-600 mb-4">
            Archived products are hidden from the active inventory list.
          </p>
          <Link
            href="/inventory"
            className="inline-block bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
          >
            Return to Inventory
          </Link>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="space-y-4 max-w-lg">
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← Back to Inventory
        </Link>
        <div className="border border-gray-200 bg-white p-6 rounded">
          <h1 className="text-xl font-bold text-gray-900 mb-2">This product no longer exists</h1>
          <p className="text-sm text-gray-600 mb-4">
            The requested product could not be found in your inventory.
          </p>
          <Link
            href="/inventory"
            className="inline-block bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
          >
            Return to Inventory
          </Link>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="space-y-4 max-w-lg">
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← Back to Inventory
        </Link>
        <div className="border border-red-300 bg-red-50 p-6 rounded text-red-800">
          <h2 className="font-bold text-base mb-1">Error Loading Product</h2>
          <p className="text-sm mb-4">{error}</p>
          <button
            type="button"
            onClick={() => loadData()}
            className="bg-black text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (loading || !product) {
    return (
      <div className="space-y-4">
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← Back to Inventory
        </Link>
        <div className="py-12 text-center text-gray-500 text-sm">
          Loading product details...
        </div>
      </div>
    );
  }

  const today = getTodayInManila();

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div>
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← Back to Inventory
        </Link>
      </div>

      {/* Product Header */}
      <div className="bg-white border border-gray-200 rounded p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <p className="text-sm text-gray-600 mt-1">
              Barcode: {product.barcode || 'None'} • Category: {product.category?.name || 'Uncategorized'} • Price: ₱
              {product.price.toFixed(2)}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {product.statuses.map((status) => (
              <span
                key={status}
                className={`text-xs px-2.5 py-1 rounded border font-medium ${getProductBadgeClass(status)}`}
              >
                {status}
              </span>
            ))}
          </div>
        </div>

        {/* Overview Stat Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="border border-gray-200 rounded p-4 bg-gray-50">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Total left
            </span>
            <span className="block text-2xl font-bold text-gray-900 mt-1">
              {product.total_units}
            </span>
          </div>

          <div className="border border-gray-200 rounded p-4 bg-gray-50">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Sellable
            </span>
            <span className="block text-2xl font-bold text-gray-900 mt-1">
              {product.sellable_units}
            </span>
          </div>

          <div className="border border-gray-200 rounded p-4 bg-gray-50">
            <span className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Batches
            </span>
            <span className="block text-2xl font-bold text-gray-900 mt-1">
              {product.batch_count}
            </span>
          </div>
        </div>
      </div>

      {/* Batch List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900">Batches (Earliest Expiry First)</h2>

        {product.batches.length === 0 ? (
          <div className="border border-dashed border-gray-300 rounded p-6 text-center text-gray-500 text-sm bg-white">
            No active batches for this product.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium text-xs">
                <tr>
                  <th className="py-2.5 px-4">Batch Code</th>
                  <th className="py-2.5 px-4">Units left</th>
                  <th className="py-2.5 px-4">Bought date</th>
                  <th className="py-2.5 px-4">Expiry date</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {product.batches.map((batch) => {
                  const batchCode = `B-${batch.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
                  const batchStatus = getBatchStatus(
                    batch.expiration_date,
                    batch.quantity_left,
                    today,
                    near_expiry_days!
                  );

                  return (
                    <tr key={batch.id} className="hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono font-medium text-gray-900">{batchCode}</td>
                      <td className="py-3 px-4 font-semibold text-gray-900">{batch.quantity_left}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDisplayDate(batch.purchase_date)}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDisplayDate(batch.expiration_date)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`text-xs px-2 py-0.5 rounded border font-medium ${getBatchBadgeClass(batchStatus)}`}
                        >
                          {batchStatus}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
