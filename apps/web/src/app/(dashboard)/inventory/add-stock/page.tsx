'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
    <div className="space-y-6 max-w-2xl">
      {/* Notice Banner */}
      <div className="border border-blue-200 bg-blue-50 p-4 rounded text-blue-900 text-sm">
        Camera barcode scanning is available in the mobile app.
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Add Stock</h1>
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </Link>
      </div>

      {/* SUCCESS VIEW */}
      {successInfo ? (
        <div className="border border-green-300 bg-green-50 p-6 rounded space-y-4">
          <h2 className="text-lg font-bold text-green-900">
            Added {successInfo.quantity} units successfully
          </h2>
          <p className="text-sm text-green-800">
            Stock batch has been recorded for {selectedProduct?.name}.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setSuccessInfo(null);
                setQuantity('10');
                setExpirationDate('');
              }}
              className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
            >
              Add more
            </button>
            <Link
              href={`/inventory/${successInfo.productId}`}
              className="border border-gray-300 bg-white px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              View product
            </Link>
          </div>
        </div>
      ) : !selectedProduct ? (
        /* STEP 1: FIND PRODUCT */
        <div className="bg-white border border-gray-200 rounded p-6 space-y-6">
          <h2 className="text-base font-bold text-gray-900">Step 1: Select a product</h2>

          {isArchivedError && (
            <div className="p-3 border border-red-300 bg-red-50 text-red-800 text-sm rounded space-y-2">
              <div className="flex items-center justify-between">
                <span>This product is archived.</span>
                {archivedProduct && (
                  <button
                    type="button"
                    onClick={() => setShowRestoreModal(true)}
                    disabled={restoring}
                    className="border border-red-400 bg-white text-red-900 px-3 py-1 rounded text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                  >
                    {restoring ? 'Restoring...' : 'Restore product'}
                  </button>
                )}
              </div>
              {restoreError && (
                <p className="text-xs text-red-700 font-semibold">{restoreError}</p>
              )}
            </div>
          )}

          {searchError && (
            <div className="p-3 border border-red-300 bg-red-50 text-red-800 text-sm rounded">
              {searchError}
            </div>
          )}

          {/* Option A: Type Barcode */}
          <form onSubmit={handleFindBarcode} className="space-y-2">
            <label htmlFor="barcode-input" className="block text-sm font-medium text-gray-700">
              Find by barcode
            </label>
            <div className="flex gap-2">
              <input
                id="barcode-input"
                type="text"
                placeholder="Enter UPC-A or EAN-13 code..."
                value={barcodeInput}
                onChange={(e) => {
                  setBarcodeInput(e.target.value);
                  setBarcodeNotFound(null);
                  setIsArchivedError(false);
                }}
                className="flex-1 border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <button
                type="submit"
                disabled={findingBarcode || !barcodeInput.trim()}
                className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {findingBarcode ? 'Finding...' : 'Find'}
              </button>
            </div>

            {barcodeNotFound && (
              <div className="p-3 border border-amber-300 bg-amber-50 rounded text-sm text-amber-900 mt-2">
                <span>Product not found for barcode &quot;{barcodeNotFound}&quot;. </span>
                <Link
                  href={`/inventory/new?barcode=${encodeURIComponent(barcodeNotFound)}`}
                  className="font-medium underline hover:text-black"
                >
                  Create new product with this barcode →
                </Link>
              </div>
            )}
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-gray-200"></div>
            <span className="flex-shrink mx-4 text-xs uppercase font-semibold text-gray-400">Or search by name</span>
            <div className="flex-grow border-t border-gray-200"></div>
          </div>

          {/* Option B: Search by Name */}
          <div className="space-y-2">
            <label htmlFor="name-query" className="block text-sm font-medium text-gray-700">
              Product name
            </label>
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
              className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />

            {searchingName && (
              <p className="text-xs text-gray-500">Searching...</p>
            )}

            {nameResults.length > 0 && (
              <div className="border border-gray-200 rounded max-h-60 overflow-y-auto divide-y divide-gray-100 bg-white">
                {nameResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full text-left p-3 hover:bg-gray-50 flex items-center justify-between text-sm"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="text-xs text-gray-500 block">
                        Barcode: {p.barcode || 'None'} • ₱{p.price.toFixed(2)}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">Select →</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* STEP 2: BATCH FORM */
        <div className="bg-white border border-gray-200 rounded p-6 space-y-6">
          <div className="flex items-start justify-between border-b border-gray-200 pb-4">
            <div>
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                Adding stock for:
              </span>
              <h2 className="text-lg font-bold text-gray-900 mt-0.5">{selectedProduct.name}</h2>
              <p className="text-xs text-gray-500">
                Barcode: {selectedProduct.barcode || 'None'} • Category: {selectedProduct.category?.name || 'Uncategorized'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetProduct}
              disabled={saving}
              className="text-xs text-blue-600 hover:underline"
            >
              Change product
            </button>
          </div>

          {formError && (
            <div className="p-3 border border-red-300 bg-red-50 text-red-800 text-sm rounded space-y-2">
              <p>{formError}</p>
              {showNetworkWarning && (
                <div className="pt-1">
                  <Link href="/inventory" className="text-sm font-semibold underline text-red-900">
                    Go to Inventory to check stock status →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
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
                className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label htmlFor="purchase-date" className="block text-sm font-medium text-gray-700 mb-1">
                Purchase date
              </label>
              <input
                id="purchase-date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                disabled={saving || showNetworkWarning}
                className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>

            <div>
              <label htmlFor="expiration-date" className="block text-sm font-medium text-gray-700 mb-1">
                Expiration date
              </label>
              <input
                id="expiration-date"
                type="date"
                required
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                disabled={saving || showNetworkWarning}
                className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              {hasExpiredWarning && (
                <p className="text-xs text-amber-700 font-medium mt-1">
                  Warning: Expiration date is in the past.
                </p>
              )}
            </div>

            <div className="pt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || showNetworkWarning}
                className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add Stock'}
              </button>
              <button
                type="button"
                onClick={handleResetProduct}
                disabled={saving}
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50"
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
