'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Plus,
  Boxes,
  Layers,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useStoreSettings } from '../../../../context/StoreSettingsContext';
import { useRealtime } from '../../../../lib/realtime';
import {
  getProductWithBatches,
  getBatch,
  correctBatchQuantity,
  updateBatchDates,
  removeBatch,
  removeProduct,
} from '../../../../lib/inventory';
import {
  ProductWithBatches,
  ProductStockStatus,
  BatchStockStatus,
  Batch,
} from '../../../../types/inventory';
import {
  formatDisplayDate,
  getTodayInManila,
  getBatchStatus,
  isValidCalendarDate,
  isDateInPast,
} from '../../../../lib/date';
import { ConfirmModal } from '../../../../components/ConfirmModal';
import { getSignedPhotoUrl, invalidateSignedUrl } from '../../../../lib/storage';
import { ProductCategoryIcon } from '../../../../components/ProductCategoryIcon';

interface ProductDetailClientProps {
  productId: string;
}

export function ProductDetailClient({ productId }: ProductDetailClientProps) {
  const { near_expiry_days, loading: settingsLoading, error: settingsError, reload: reloadSettings } = useStoreSettings();
  const { dataVersion } = useRealtime();

  const [product, setProduct] = useState<ProductWithBatches | null>(null);
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);
  const [isArchived, setIsArchived] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Global action banner & running state (disables all other buttons)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionRunning, setActionRunning] = useState(false);

  // Result panel states after delete (product or batch)
  const [productDeleteResult, setProductDeleteResult] = useState<'Deleted' | 'Archived' | null>(null);
  const [batchDeleteResult, setBatchDeleteResult] = useState<{ code: string; status: 'Deleted' | 'Archived' } | null>(null);

  // Delete product modal
  const [showDeleteProductModal, setShowDeleteProductModal] = useState(false);

  // Active batch for modal actions
  const [activeBatch, setActiveBatch] = useState<Batch | null>(null);
  const [fetchingBatch, setFetchingBatch] = useState(false);

  // Correct quantity modal state
  const [showQtyModal, setShowQtyModal] = useState(false);
  const [qtyStep, setQtyStep] = useState<'input' | 'confirm'>('input');
  const [newQtyInput, setNewQtyInput] = useState('');
  const [qtyModalError, setQtyModalError] = useState<string | null>(null);

  // Edit dates modal state
  const [showDatesModal, setShowDatesModal] = useState(false);
  const [datesStep, setDatesStep] = useState<'input' | 'confirm'>('input');
  const [purchaseDateInput, setPurchaseDateInput] = useState('');
  const [expirationDateInput, setExpirationDateInput] = useState('');
  const [datesModalError, setDatesModalError] = useState<string | null>(null);

  // Delete batch modal state
  const [showDeleteBatchModal, setShowDeleteBatchModal] = useState(false);

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
    if (res.data.image_url) {
      getSignedPhotoUrl(res.data.image_url).then((url) => {
        setSignedPhotoUrl(url);
      });
    } else {
      setSignedPhotoUrl(null);
    }
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
      if (!isFetchingRef.current && !settingsLoading && !settingsError && near_expiry_days !== null && !actionRunning) {
        loadData();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadData, settingsLoading, settingsError, near_expiry_days, actionRunning]);

  const initialDataVersionRef = useRef(dataVersion);
  const pendingReloadOnActionEnd = useRef(false);

  // Realtime silent refresh on dataVersion change
  useEffect(() => {
    let active = true;
    if (dataVersion === initialDataVersionRef.current) {
      return;
    }
    if (actionRunning) {
      pendingReloadOnActionEnd.current = true;
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
  }, [dataVersion, actionRunning, settingsLoading, settingsError, near_expiry_days, loadData]);

  // When actionRunning finishes, execute any pending reload
  useEffect(() => {
    let active = true;
    if (!actionRunning && pendingReloadOnActionEnd.current) {
      pendingReloadOnActionEnd.current = false;
      if (!settingsLoading && !settingsError && near_expiry_days !== null) {
        const run = async () => {
          if (!active) return;
          await loadData();
        };
        void run();
      }
    }
    return () => {
      active = false;
    };
  }, [actionRunning, settingsLoading, settingsError, near_expiry_days, loadData]);

  // --- DELETE PRODUCT HANDLER ---
  const handleConfirmDeleteProduct = async () => {
    if (!product) return;
    setShowDeleteProductModal(false);
    setActionRunning(true);
    setActionError(null);
    setActionSuccess(null);

    const res = await removeProduct(product.id);

    if (res.kind === 'db_error') {
      setActionError(res.message);
      setActionRunning(false);
      return;
    }

    if (res.kind === 'network_error') {
      setActionError(res.message);
      await loadData();
      setActionRunning(false);
      return;
    }

    // Success: show result panel with "Back to Inventory" button
    const statusText = res.data.status === 'deleted' ? 'Deleted' : 'Archived';
    setProductDeleteResult(statusText);
    setActionRunning(false);
  };

  // --- CORRECT QUANTITY HANDLERS ---
  const handleOpenCorrectQuantity = async (batch: Batch) => {
    if (actionRunning) return;
    setActionError(null);
    setActionSuccess(null);
    setQtyModalError(null);
    setQtyStep('input');
    setActiveBatch(batch);
    setNewQtyInput(String(batch.quantity_left));
    setShowQtyModal(true);
    setFetchingBatch(true);

    const fresh = await getBatch(batch.id);
    setFetchingBatch(false);
    if (fresh.kind === 'success') {
      setActiveBatch(fresh.batch);
      setNewQtyInput(String(fresh.batch.quantity_left));
    }
  };

  const handleQtyInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQtyModalError(null);
    const trimmed = newQtyInput.trim();
    if (!/^\d+$/.test(trimmed)) {
      setQtyModalError('Quantity must be a whole number between 0 and 100,000');
      return;
    }
    const val = Number(trimmed);
    if (val < 0 || val > 100000) {
      setQtyModalError('Quantity must be a whole number between 0 and 100,000');
      return;
    }
    setQtyStep('confirm');
  };

  const handleConfirmQuantityCorrection = async () => {
    if (!activeBatch) return;
    setActionRunning(true);
    setQtyModalError(null);

    const qty = Number(newQtyInput.trim());
    const res = await correctBatchQuantity(activeBatch.id, qty);

    if (res.kind === 'db_error') {
      setQtyModalError(res.message);
      setQtyStep('input');
      setActionRunning(false);
      return;
    }

    if (res.kind === 'network_error') {
      setShowQtyModal(false);
      setActionError(res.message);
      await loadData();
      setActionRunning(false);
      return;
    }

    // Success
    setShowQtyModal(false);
    setActionSuccess(`Quantity updated from ${activeBatch.quantity_left} to ${qty}.`);
    await loadData();
    setActionRunning(false);
  };

  // --- EDIT DATES HANDLERS ---
  const handleOpenEditDates = async (batch: Batch) => {
    if (actionRunning) return;
    setActionError(null);
    setActionSuccess(null);
    setDatesModalError(null);
    setDatesStep('input');
    setActiveBatch(batch);
    setPurchaseDateInput(batch.purchase_date);
    setExpirationDateInput(batch.expiration_date);
    setShowDatesModal(true);
    setFetchingBatch(true);

    const fresh = await getBatch(batch.id);
    setFetchingBatch(false);
    if (fresh.kind === 'success') {
      setActiveBatch(fresh.batch);
      setPurchaseDateInput(fresh.batch.purchase_date);
      setExpirationDateInput(fresh.batch.expiration_date);
    }
  };

  const handleDatesInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDatesModalError(null);
    const pDate = purchaseDateInput.trim();
    const eDate = expirationDateInput.trim();

    if (!isValidCalendarDate(pDate)) {
      setDatesModalError('Purchase date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }
    if (!isValidCalendarDate(eDate)) {
      setDatesModalError('Expiration date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }
    if (eDate < pDate) {
      setDatesModalError('Expiration date cannot be earlier than purchase date');
      return;
    }

    setDatesStep('confirm');
  };

  const handleConfirmDateUpdate = async () => {
    if (!activeBatch) return;
    setActionRunning(true);
    setDatesModalError(null);

    const pDate = purchaseDateInput.trim();
    const eDate = expirationDateInput.trim();

    const res = await updateBatchDates(activeBatch.id, pDate, eDate);

    if (res.kind === 'db_error') {
      setDatesModalError(res.message);
      setDatesStep('input');
      setActionRunning(false);
      return;
    }

    if (res.kind === 'network_error') {
      setShowDatesModal(false);
      setActionError(res.message);
      await loadData();
      setActionRunning(false);
      return;
    }

    // Success
    setShowDatesModal(false);
    setActionSuccess('Batch dates updated successfully.');
    await loadData();
    setActionRunning(false);
  };

  // --- DELETE BATCH HANDLERS ---
  const handleOpenDeleteBatch = (batch: Batch) => {
    if (actionRunning) return;
    setActionError(null);
    setActionSuccess(null);
    setActiveBatch(batch);
    setShowDeleteBatchModal(true);
  };

  const handleConfirmDeleteBatch = async () => {
    if (!activeBatch) return;
    setShowDeleteBatchModal(false);
    setActionRunning(true);
    setActionError(null);
    setActionSuccess(null);

    const batchCode = `B-${activeBatch.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
    const res = await removeBatch(activeBatch.id);

    if (res.kind === 'db_error') {
      setActionError(res.message);
      setActionRunning(false);
      return;
    }

    if (res.kind === 'network_error') {
      setActionError(res.message);
      await loadData();
      setActionRunning(false);
      return;
    }

    const statusText = res.data.status === 'deleted' ? 'Deleted' : 'Archived';
    setBatchDeleteResult({ code: batchCode, status: statusText });
    await loadData();
    setActionRunning(false);
  };

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

  // Result panel after product delete (rule 2)
  if (productDeleteResult) {
    return (
      <div className="space-y-4 max-w-lg">
        <div className="border border-[#ece3d2] bg-white p-6 rounded-2xl shadow-2xs space-y-4">
          <h1 className="text-xl font-bold text-[#181413]">
            Product {productDeleteResult}.
          </h1>
          <p className="text-xs text-[#7a7469] leading-relaxed">
            {productDeleteResult === 'Deleted'
              ? 'The unused product and all its records have been removed.'
              : 'The product has past sales history and has been archived.'}
          </p>
          <div>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1.5 bg-[#207429] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
            >
              Back to Inventory
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isArchived) {
    return (
      <div className="space-y-4 max-w-lg">
        <Link href="/inventory" className="text-xs font-bold text-[#7a7469] hover:text-[#181413] inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory</span>
        </Link>
        <div className="border border-[#ece3d2] bg-white p-6 rounded-2xl shadow-2xs">
          <h1 className="text-xl font-bold text-[#181413] mb-2">This product is archived</h1>
          <p className="text-xs text-[#7a7469] mb-4 leading-relaxed">
            Archived products are hidden from the active inventory list.
          </p>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1.5 bg-[#207429] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
          >
            Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="space-y-4 max-w-lg">
        <Link href="/inventory" className="text-xs font-bold text-[#7a7469] hover:text-[#181413] inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory</span>
        </Link>
        <div className="border border-[#ece3d2] bg-white p-6 rounded-2xl shadow-2xs">
          <h1 className="text-xl font-bold text-[#181413] mb-2">This product no longer exists</h1>
          <p className="text-xs text-[#7a7469] mb-4 leading-relaxed">
            The requested product could not be found in your inventory.
          </p>
          <Link
            href="/inventory"
            className="inline-flex items-center gap-1.5 bg-[#207429] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
          >
            Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="space-y-4 max-w-lg">
        <Link href="/inventory" className="text-xs font-bold text-[#7a7469] hover:text-[#181413] inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory</span>
        </Link>
        <div className="border border-red-200 bg-red-50 p-6 rounded-2xl text-red-900 shadow-2xs">
          <h2 className="font-bold text-base mb-1">Error Loading Product</h2>
          <p className="text-xs text-red-700 mb-4 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => loadData()}
            className="bg-[#207429] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
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
        <Link href="/inventory" className="text-xs font-bold text-[#7a7469] hover:text-[#181413] inline-flex items-center gap-1.5 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory</span>
        </Link>
        <div className="py-16 text-center text-[#7a7469] text-sm flex flex-col items-center justify-center gap-3">
          <div className="w-6 h-6 border-2 border-[#207429] border-t-transparent rounded-full animate-spin" />
          <p className="font-medium">Loading product details...</p>
        </div>
      </div>
    );
  }

  const today = getTodayInManila();
  const isPastDatesModalExpiry =
    expirationDateInput &&
    isValidCalendarDate(expirationDateInput) &&
    isDateInPast(expirationDateInput);

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/inventory"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7a7469] hover:text-[#181413] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Inventory</span>
        </Link>
      </div>

      {/* Global Action Alerts */}
      {actionSuccess && (
        <div className="p-4 border border-[#207429]/30 bg-[#f4ffe1] text-[#207429] text-xs md:text-sm rounded-xl font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#207429]" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            aria-label="Dismiss success notification"
            className="text-[#207429] hover:text-[#185e21] p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-900 text-xs md:text-sm rounded-xl font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error notification"
            className="text-red-700 hover:text-red-900 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Batch Delete Result Panel (rule 2) */}
      {batchDeleteResult && (
        <div className="p-4 border border-[#ece3d2] bg-[#fef9f0] text-[#181413] text-sm rounded-2xl flex items-center justify-between shadow-2xs">
          <div>
            <span className="font-bold">Batch {batchDeleteResult.code} {batchDeleteResult.status}.</span>
            <p className="text-xs text-[#7a7469] mt-0.5">
              {batchDeleteResult.status === 'Deleted'
                ? 'The unused batch was permanently removed.'
                : 'The batch was archived to preserve past audit and deduction history.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBatchDeleteResult(null)}
            className="bg-white border border-[#ece3d2] px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#181413] hover:bg-[#f4ffe1] transition-colors"
          >
            Back to product
          </button>
        </div>
      )}

      {/* Product Header */}
      <div className="bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-start gap-4">
            {/* Square Photo / Category Icon container on left */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 aspect-square rounded-2xl border border-[#ece3d2] bg-[#f8faf8] overflow-hidden shrink-0 flex items-center justify-center shadow-2xs">
              {signedPhotoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={signedPhotoUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                  onError={() => {
                    invalidateSignedUrl(product.image_url);
                    setSignedPhotoUrl(null);
                  }}
                />
              ) : (
                <ProductCategoryIcon
                  categoryName={product.category?.name}
                  size={40}
                  className="w-full h-full border-0"
                />
              )}
            </div>

            {/* Information on right */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-[#181413] tracking-tight break-words">{product.name}</h1>
              </div>
              <p className="text-xs text-[#7a7469] mt-1">
                Barcode: <span className="font-mono text-[#181413]">{product.barcode || 'None'}</span> • Category:{' '}
                <span className="font-semibold text-[#181413]">{product.category?.name || 'Uncategorized'}</span> • Price:{' '}
                <span className="font-bold text-[#207429]">₱{product.price.toFixed(2)}</span>
              </p>
            </div>
          </div>

          {/* Action buttons on header */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href={`/inventory/${productId}/edit`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ece3d2] bg-white text-xs font-bold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs ${
                actionRunning ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <Edit className="w-3.5 h-3.5" />
              Edit Product
            </Link>
            <button
              type="button"
              onClick={() => setShowDeleteProductModal(true)}
              disabled={actionRunning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-[#d32f2f] hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Product
            </button>
          </div>
        </div>

        {/* Status Badges */}
        <div className="flex flex-wrap gap-1.5">
          {product.statuses.map((status) => (
            <span
              key={status}
              className={`text-[10px] uppercase tracking-wide px-2.5 py-0.5 rounded border font-bold ${getProductBadgeClass(status)}`}
            >
              {status}
            </span>
          ))}
        </div>

        {/* Overview Stat Boxes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          <div className="border border-[#ece3d2] rounded-xl p-4 bg-[#fef9f0]/60 flex items-center gap-3.5 shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-white border border-[#ece3d2] flex items-center justify-center text-[#207429] shrink-0 shadow-2xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[11px] font-bold text-[#7a7469] uppercase tracking-wider">
                Total Left
              </span>
              <span className="block text-2xl font-black text-[#181413] mt-0.5 tracking-tight">
                {product.total_units} <span className="text-xs font-normal text-[#7a7469]">units</span>
              </span>
            </div>
          </div>

          <div className="border border-[#ece3d2] rounded-xl p-4 bg-[#fef9f0]/60 flex items-center gap-3.5 shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-[#f4ffe1] border border-[#207429]/20 flex items-center justify-center text-[#207429] shrink-0 shadow-2xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[11px] font-bold text-[#7a7469] uppercase tracking-wider">
                Sellable
              </span>
              <span className="block text-2xl font-black text-[#207429] mt-0.5 tracking-tight">
                {product.sellable_units} <span className="text-xs font-normal text-[#7a7469]">units</span>
              </span>
            </div>
          </div>

          <div className="border border-[#ece3d2] rounded-xl p-4 bg-[#fef9f0]/60 flex items-center gap-3.5 shadow-2xs">
            <div className="w-11 h-11 rounded-xl bg-white border border-[#ece3d2] flex items-center justify-center text-[#7a7469] shrink-0 shadow-2xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="block text-[11px] font-bold text-[#7a7469] uppercase tracking-wider">
                Active Batches
              </span>
              <span className="block text-2xl font-black text-[#181413] mt-0.5 tracking-tight">
                {product.batch_count} <span className="text-xs font-normal text-[#7a7469]">batches</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Batch List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#181413]">
              Batches (Sorted by Expiration Date)
            </h2>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#f4ffe1] text-[#207429]">
              Auto Deduct First
            </span>
          </div>
          <Link
            href="/inventory/add-stock"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#207429] text-white text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Batch
          </Link>
        </div>

        {product.batches.length === 0 ? (
          <div className="border border-dashed border-[#ece3d2] rounded-2xl p-8 text-center text-[#7a7469] text-xs bg-white shadow-2xs">
            No active batches recorded for this product yet.
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border border-[#ece3d2] rounded-2xl shadow-2xs">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-[#fef9f0] border-b border-[#ece3d2] text-[#7a7469] font-bold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-5">Batch Code</th>
                  <th className="py-3 px-4">Units Left</th>
                  <th className="py-3 px-4">Purchase Date</th>
                  <th className="py-3 px-4">Expiration Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f1ea]">
                {product.batches.map((batch) => {
                  const batchCode = `B-${batch.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
                  const batchStatus = getBatchStatus(
                    batch.expiration_date,
                    batch.quantity_left,
                    today,
                    near_expiry_days!
                  );

                  return (
                    <tr key={batch.id} className="hover:bg-[#fef9f0]/40 transition-colors">
                      <td className="py-3.5 px-5 font-mono font-bold text-xs text-[#181413]">
                        {batchCode}
                      </td>
                      <td className="py-3.5 px-4 font-black text-[#181413]">
                        {batch.quantity_left}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#7a7469]">
                        {formatDisplayDate(batch.purchase_date)}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#7a7469] font-medium">
                        {formatDisplayDate(batch.expiration_date)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border font-bold ${getBatchBadgeClass(batchStatus)}`}
                        >
                          {batchStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex items-center justify-end gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => handleOpenCorrectQuantity(batch)}
                            disabled={actionRunning}
                            className="font-semibold text-[#207429] hover:underline disabled:opacity-50"
                          >
                            Correct Qty
                          </button>
                          <span className="text-[#ece3d2]">|</span>
                          <button
                            type="button"
                            onClick={() => handleOpenEditDates(batch)}
                            disabled={actionRunning}
                            className="font-semibold text-[#207429] hover:underline disabled:opacity-50"
                          >
                            Edit Dates
                          </button>
                          <span className="text-[#ece3d2]">|</span>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteBatch(batch)}
                            disabled={actionRunning}
                            className="font-semibold text-[#d32f2f] hover:underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --- CONFIRMATION & ACTION MODALS --- */}

      {/* Delete Product Modal */}
      <ConfirmModal
        isOpen={showDeleteProductModal}
        title="Confirm Delete Product"
        message="If no batch of this product was ever used it will be deleted. If it already has sales history it will be archived instead, so past stock changes can still be traced."
        confirmText="Yes, delete product"
        cancelText="Cancel"
        isSaving={actionRunning}
        onConfirm={handleConfirmDeleteProduct}
        onCancel={() => setShowDeleteProductModal(false)}
      />

      {/* Correct Quantity Dialog */}
      {showQtyModal && activeBatch && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white rounded p-6 max-w-sm w-full border border-gray-300 shadow-lg space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Correct Quantity</h2>
            {fetchingBatch && (
              <p className="text-xs text-gray-500">Checking current shelf count...</p>
            )}

            {qtyModalError && (
              <div className="p-2 border border-red-300 bg-red-50 text-red-800 text-xs rounded">
                {qtyModalError}
              </div>
            )}

            {qtyStep === 'input' ? (
              <form onSubmit={handleQtyInputSubmit} className="space-y-4">
                <div>
                  <span className="block text-xs font-semibold text-gray-500 uppercase">
                    Current count: {activeBatch.quantity_left}
                  </span>
                  <label htmlFor="new-qty-input" className="block text-sm font-medium text-gray-700 mt-2">
                    New quantity (0 to 100,000)
                  </label>
                  <input
                    id="new-qty-input"
                    type="number"
                    min="0"
                    max="100000"
                    step="1"
                    required
                    value={newQtyInput}
                    onChange={(e) => setNewQtyInput(e.target.value)}
                    disabled={actionRunning}
                    className="w-full border border-gray-300 p-2 rounded text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  <p className="text-xs text-gray-500 mt-1.5 italic">
                    Use this when the real count on the shelf is different.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowQtyModal(false)}
                    disabled={actionRunning}
                    className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionRunning}
                    className="bg-black text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Are you sure you want to update quantity from{' '}
                  <span className="font-semibold">{activeBatch.quantity_left}</span> to{' '}
                  <span className="font-semibold">{newQtyInput.trim()}</span>?
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setQtyStep('input')}
                    disabled={actionRunning}
                    className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmQuantityCorrection}
                    disabled={actionRunning}
                    className="bg-black text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {actionRunning ? 'Saving...' : 'Yes, update quantity'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Dates Dialog */}
      {showDatesModal && activeBatch && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white rounded p-6 max-w-sm w-full border border-gray-300 shadow-lg space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Edit Batch Dates</h2>
            {fetchingBatch && (
              <p className="text-xs text-gray-500">Checking current dates...</p>
            )}

            {datesModalError && (
              <div className="p-2 border border-red-300 bg-red-50 text-red-800 text-xs rounded">
                {datesModalError}
              </div>
            )}

            {datesStep === 'input' ? (
              <form onSubmit={handleDatesInputSubmit} className="space-y-3">
                <div>
                  <label htmlFor="p-date-input" className="block text-sm font-medium text-gray-700">
                    Purchase date
                  </label>
                  <input
                    id="p-date-input"
                    type="date"
                    required
                    value={purchaseDateInput}
                    onChange={(e) => setPurchaseDateInput(e.target.value)}
                    disabled={actionRunning}
                    className="w-full border border-gray-300 p-2 rounded text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label htmlFor="e-date-input" className="block text-sm font-medium text-gray-700">
                    Expiration date
                  </label>
                  <input
                    id="e-date-input"
                    type="date"
                    required
                    value={expirationDateInput}
                    onChange={(e) => setExpirationDateInput(e.target.value)}
                    disabled={actionRunning}
                    className="w-full border border-gray-300 p-2 rounded text-sm mt-1 focus:outline-none focus:ring-1 focus:ring-black"
                  />
                  {isPastDatesModalExpiry && (
                    <p className="text-xs text-amber-700 font-medium mt-1">
                      Warning: The expiration date is in the past.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDatesModal(false)}
                    disabled={actionRunning}
                    className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionRunning}
                    className="bg-black text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-700">
                  Update dates to purchase: <span className="font-semibold">{purchaseDateInput}</span>, expiry:{' '}
                  <span className="font-semibold">{expirationDateInput}</span>?
                </p>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDatesStep('input')}
                    disabled={actionRunning}
                    className="border border-gray-300 px-3 py-1.5 rounded text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDateUpdate}
                    disabled={actionRunning}
                    className="bg-black text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {actionRunning ? 'Saving...' : 'Yes, update dates'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Batch Confirm Modal */}
      <ConfirmModal
        isOpen={showDeleteBatchModal}
        title="Confirm Delete Batch"
        message="If this batch was never used it will be deleted. If it already has sales history it will be archived instead, so past stock changes can still be traced."
        confirmText="Yes, delete batch"
        cancelText="Cancel"
        isSaving={actionRunning}
        onConfirm={handleConfirmDeleteBatch}
        onCancel={() => setShowDeleteBatchModal(false)}
      />
    </div>
  );
}
