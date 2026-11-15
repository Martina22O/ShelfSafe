'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Search,
  ScanBarcode,
  CheckCircle2,
} from 'lucide-react';
import {
  findProductByBarcode,
  searchProductsByName,
  addStock,
  restoreProduct,
} from '../../../../lib/inventory';
import { Product } from '../../../../types/inventory';
import { getTodayInManila, isValidCalendarDate, isDateInPast } from '../../../../lib/date';
import { ConfirmModal } from '../../../../components/ConfirmModal';

export default function AddStockPage() {
  const today = getTodayInManila();

  // Step 1: Search state
  const [barcodeInput, setBarcodeInput] = useState('');
  const [findingBarcode, setFindingBarcode] = useState(false);
  const [barcodeNotFound, setBarcodeNotFound] = useState<string | null>(null);

  const [nameQuery, setNameQuery] = useState('');
  const [nameResults, setNameResults] = useState<Product[]>([]);
  const [searchingName, setSearchingName] = useState(false);

  // Selected product
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isArchivedError, setIsArchivedError] = useState(false);
  const [archivedProduct, setArchivedProduct] = useState<Product | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Step 2: Form state
  const [quantity, setQuantity] = useState('10');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expirationDate, setExpirationDate] = useState('');

  const [formError, setFormError] = useState<string | null>(null);
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successInfo, setSuccessInfo] = useState<{ quantity: number; productId: string } | null>(null);

  // Name search debounce
  useEffect(() => {
    if (!nameQuery.trim() || selectedProduct) {
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingName(true);
      const res = await searchProductsByName(nameQuery);
      setSearchingName(false);
      if (res.kind === 'success') {
        setNameResults(res.products);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [nameQuery, selectedProduct]);

  // Handle Find by Barcode
  const handleFindBarcode = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = barcodeInput.trim();
    if (!raw) return;

    setFindingBarcode(true);
    setBarcodeNotFound(null);
    setIsArchivedError(false);
    setArchivedProduct(null);
    setRestoreError(null);
    setSearchError(null);

    const res = await findProductByBarcode(raw);
    setFindingBarcode(false);

    if (res.kind === 'found') {
      setSelectedProduct(res.product);
      setBarcodeNotFound(null);
      setArchivedProduct(null);
    } else if (res.kind === 'archived') {
      setIsArchivedError(true);
      setArchivedProduct(res.product);
      setSelectedProduct(null);
    } else if (res.kind === 'not_found') {
      setBarcodeNotFound(raw);
      setSelectedProduct(null);
      setArchivedProduct(null);
    } else {
      setSearchError(res.message);
      setSelectedProduct(null);
      setArchivedProduct(null);
    }
  };

  const handleConfirmRestore = async () => {
    if (!archivedProduct) return;
    setShowRestoreModal(false);
    setRestoring(true);
    setRestoreError(null);

    const res = await restoreProduct(archivedProduct.id);
    setRestoring(false);

    if (res.kind === 'db_error') {
      setRestoreError(res.message);
      return;
    }

    if (res.kind === 'network_error') {
      setRestoreError(res.message);
      return;
    }

    // Success: select the restored product so the user can immediately add stock
    setIsArchivedError(false);
    setSelectedProduct({
      ...archivedProduct,
      is_archived: false,
    });
    setArchivedProduct(null);
  };

  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setNameResults([]);
    setNameQuery('');
    setBarcodeNotFound(null);
    setIsArchivedError(false);
    setArchivedProduct(null);
    setRestoreError(null);
    setSearchError(null);
    setFormError(null);
    setShowNetworkWarning(false);
    setSuccessInfo(null);
  };

  const handleResetProduct = () => {
    setSelectedProduct(null);
    setBarcodeInput('');
    setNameQuery('');
    setNameResults([]);
    setBarcodeNotFound(null);
    setIsArchivedError(false);
    setArchivedProduct(null);
    setRestoreError(null);
    setSearchError(null);
    setFormError(null);
    setShowNetworkWarning(false);
    setSuccessInfo(null);
  };

  // Form submission & validation
  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setShowNetworkWarning(false);

    if (!selectedProduct) return;

    const parsedQty = parseInt(quantity.trim(), 10);
    if (isNaN(parsedQty) || parsedQty < 1 || parsedQty > 100000 || !/^\d+$/.test(quantity.trim())) {
      setFormError('Quantity must be a whole number between 1 and 100,000');
      return;
    }

    if (purchaseDate && !isValidCalendarDate(purchaseDate)) {
      setFormError('Purchase date is invalid');
      return;
    }

    if (!expirationDate || !isValidCalendarDate(expirationDate)) {
      setFormError('Please enter a valid expiration date (YYYY-MM-DD)');
      return;
    }

    if (purchaseDate && expirationDate < purchaseDate) {
      setFormError('Expiration date cannot be earlier than purchase date');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    if (!selectedProduct) return;

    setSaving(true);
    setFormError(null);
    setShowNetworkWarning(false);

    const parsedQty = parseInt(quantity.trim(), 10);

    const res = await addStock({
      p_product_id: selectedProduct.id,
      p_quantity: parsedQty,
      p_purchase_date: purchaseDate || null,
      p_expiration_date: expirationDate,
    });

    setSaving(false);

    if (res.kind === 'db_error') {
      setFormError(res.message);
      return;
    }

    if (res.kind === 'network_error') {
      setFormError(res.message);
      setShowNetworkWarning(true);
      return;
    }

    // Success
    setSuccessInfo({
      quantity: parsedQty,
      productId: selectedProduct.id,
    });
  };

  const hasExpiredWarning = expirationDate && isValidCalendarDate(expirationDate) && isDateInPast(expirationDate);

  return (
    <div className="space-y-6 w-full">
      {/* Notice Banner */}
      <div className="border border-[#ece3d2] bg-[#fef9f0] p-4 rounded-xl text-[#524c40] text-xs flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-4 h-4 text-[#207429]" />
          <span>Camera barcode scanning is available in the mobile app. On desktop, type barcode or search by name.</span>
        </div>
      </div>

      <div className="flex items-center justify-between pb-2 border-b border-[#ece3d2]">
        <div className="flex items-center gap-2.5">
          <Link
            href="/inventory"
            className="p-1.5 rounded-lg border border-[#ece3d2] bg-white text-[#7a7469] hover:text-[#181413] hover:bg-[#fef9f0] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-2xl font-black text-[#181413] tracking-tight">Add Stock</h1>
        </div>
        <Link href="/inventory" className="text-xs font-bold text-[#7a7469] hover:text-[#181413] transition-colors">
          Cancel
        </Link>
      </div>

      {/* SUCCESS VIEW */}
      {successInfo ? (
        <div className="border border-[#207429]/30 bg-[#f4ffe1] p-6 rounded-2xl space-y-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#207429]/30 flex items-center justify-center text-[#207429]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#181413]">
                Added {successInfo.quantity} units successfully
              </h2>
              <p className="text-xs text-[#7a7469] mt-0.5">
                New batch has been recorded for <span className="font-semibold text-[#181413]">{selectedProduct?.name}</span> and scheduled in inventory.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSuccessInfo(null);
                setQuantity('10');
                setExpirationDate('');
              }}
              className="bg-[#207429] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
            >
              Add Another Batch
            </button>
            <Link
              href={`/inventory/${successInfo.productId}`}
              className="border border-[#ece3d2] bg-white px-4 py-2 rounded-xl text-xs font-bold text-[#181413] hover:bg-[#fef9f0] transition-colors shadow-2xs"
            >
              View Product Batches
            </Link>
          </div>
        </div>
      ) : !selectedProduct ? (
        /* STEP 1: FIND PRODUCT */
        <div className="bg-white border border-[#ece3d2] rounded-2xl p-6 space-y-6 shadow-2xs">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#181413]">Step 1: Select a Product</h2>
            <p className="text-xs text-[#7a7469] mt-0.5">Find the product you are receiving new batches for.</p>
          </div>

          {isArchivedError && (
            <div className="p-4 border border-red-200 bg-red-50 text-red-900 text-xs rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span>This product is currently archived.</span>
                {archivedProduct && (
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(true)}
                    disabled={restoring}
                    className="border border-red-300 bg-white text-red-900 px-3 py-1 rounded-lg text-xs font-bold hover:bg-red-50 disabled:opacity-50"
                  >
                    {restoring ? 'Restoring...' : 'Restore Product'}
                  </button>
                )}
              </div>
              {restoreError && (
                <p className="text-xs text-red-700 font-semibold">{restoreError}</p>
              )}
            </div>
          )}

          {searchError && (
            <div className="p-3 border border-red-200 bg-red-50 text-red-800 text-xs rounded-xl">
              {searchError}
            </div>
          )}

          {/* Option A: Type Barcode */}
          <form onSubmit={handleFindBarcode} className="space-y-2">
            <label htmlFor="barcode-input" className="block text-xs font-bold uppercase tracking-wide text-[#524c40]">
              Find by Barcode
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                <input
                  id="barcode-input"
                  type="text"
                  placeholder="Enter barcode..."
                  value={barcodeInput}
                  onChange={(e) => {
                    setBarcodeInput(e.target.value);
                    setBarcodeNotFound(null);
                    setIsArchivedError(false);
                  }}
                  className="w-full pl-9 pr-4 py-2 text-xs md:text-sm bg-[#f8faf8] border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429] focus:bg-white transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={findingBarcode || !barcodeInput.trim()}
                className="bg-[#207429] text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
              >
                {findingBarcode ? 'Finding...' : 'Find'}
              </button>
            </div>

            {barcodeNotFound && (
              <div className="p-3 border border-[#fabe44] bg-[#fef9f0] rounded-xl text-xs text-[#524c40] mt-2">
                <span>Product not found for barcode &quot;{barcodeNotFound}&quot;. </span>
                <Link
                  href={`/inventory/new?barcode=${encodeURIComponent(barcodeNotFound)}`}
                  className="font-bold underline text-[#207429]"
                >
                  Create new product with this barcode →
                </Link>
              </div>
            )}
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#ece3d2]"></div>
            <span className="flex-shrink mx-4 text-[10px] uppercase font-bold tracking-wider text-[#999182]">Or search by name</span>
            <div className="flex-grow border-t border-[#ece3d2]"></div>
          </div>

          {/* Option B: Search by Name */}
          <div className="space-y-2">
            <label htmlFor="name-query" className="block text-xs font-bold uppercase tracking-wide text-[#524c40]">
              Product Name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              <input
                id="name-query"
                type="text"
                placeholder="Type product name to search..."
                value={nameQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setNameQuery(val);
                  if (!val.trim()) {
                    setNameResults([]);
                  }
                }}
                className="w-full pl-9 pr-4 py-2 text-xs md:text-sm bg-[#f8faf8] border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429] focus:bg-white transition-all"
              />
            </div>

            {searchingName && (
              <p className="text-xs text-[#7a7469]">Searching products...</p>
            )}

            {nameResults.length > 0 && (
              <div className="border border-[#ece3d2] rounded-xl max-h-60 overflow-y-auto divide-y divide-[#f4f1ea] bg-white shadow-2xs">
                {nameResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-left p-3 hover:bg-[#fef9f0] flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <span className="font-bold text-[#181413] block">{p.name}</span>
                      <span className="text-[11px] text-[#7a7469] block">
                        Barcode: {p.barcode || 'None'} • ₱{p.price.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#207429]">Select →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STEP 2: BATCH FORM */
        <div className="bg-white border border-[#ece3d2] rounded-2xl p-6 space-y-6 shadow-2xs">
          <div className="flex items-start justify-between border-b border-[#ece3d2] pb-4">
            <div>
              <span className="text-[10px] font-bold text-[#999182] uppercase tracking-wider">
                Adding Stock For:
              </span>
              <h2 className="text-lg font-bold text-[#181413] mt-0.5">{selectedProduct.name}</h2>
              <p className="text-xs text-[#7a7469]">
                Barcode: {selectedProduct.barcode || 'None'} • Category: {selectedProduct.category?.name || 'Uncategorized'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetProduct}
              disabled={saving}
              className="text-xs font-bold text-[#207429] hover:underline"
            >
              Change Product
            </button>
          </div>

          {formError && (
            <div className="p-3 border border-red-200 bg-red-50 text-red-900 text-xs rounded-xl space-y-2">
              <p>{formError}</p>
              {showNetworkWarning && (
                <div className="pt-1">
                  <Link href="/inventory" className="text-xs font-bold underline text-red-900">
                    Go to Inventory to check stock status →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label htmlFor="quantity" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                  Quantity (1 to 100,000)
                </label>
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100000"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-[#ece3d2] p-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                />
              </div>

              <div>
                <label htmlFor="purchase-date" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                  Purchase Date
                </label>
                <input
                  id="purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-[#ece3d2] p-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                />
              </div>

              <div className="lg:col-span-2">
                <label htmlFor="expiration-date" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                  Expiration Date
                </label>
                <input
                  id="expiration-date"
                  type="date"
                  required
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-[#ece3d2] p-2 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                />
                {hasExpiredWarning && (
                  <p className="text-xs text-[#b45309] font-medium mt-1">
                    Warning: Expiration date is in the past.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || showNetworkWarning}
                className="bg-[#207429] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
              >
                {saving ? 'Saving...' : 'Add Stock Batch'}
              </button>
              <button
                type="button"
                onClick={handleResetProduct}
                disabled={saving}
                className="border border-[#ece3d2] px-4 py-2.5 rounded-xl text-xs font-semibold text-[#524c40] hover:bg-[#fef9f0]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title="Confirm Adding Stock"
        message={`Are you sure you want to add ${quantity} units of "${selectedProduct?.name}" expiring on ${expirationDate}?`}
        confirmText="Yes, add stock"
        cancelText="Cancel"
        isSaving={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* Restore Confirmation Modal */}
      <ConfirmModal
        isOpen={showRestoreModal}
        title="Restore Product"
        message={`Are you sure you want to restore "${archivedProduct?.name}" to active inventory?`}
        confirmText="Yes, restore"
        cancelText="Cancel"
        isSaving={restoring}
        onConfirm={handleConfirmRestore}
        onCancel={() => setShowRestoreModal(false)}
      />
    </div>
  );
}
