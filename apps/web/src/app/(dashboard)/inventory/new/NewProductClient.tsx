'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getCategories, createProductWithBatch } from '../../../../lib/inventory';
import { Category } from '../../../../types/inventory';
import {
  getTodayInManila,
  isValidCalendarDate,
  isDateInPast,
} from '../../../../lib/date';
import { ConfirmModal } from '../../../../components/ConfirmModal';

interface NewProductClientProps {
  initialBarcode?: string;
}

export default function NewProductClient({ initialBarcode = '' }: NewProductClientProps) {
  const today = getTodayInManila();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Form fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState(initialBarcode);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [price, setPrice] = useState('0.00');
  const [lowStockLevel, setLowStockLevel] = useState('5');

  // First batch fields
  const [quantity, setQuantity] = useState('10');
  const [purchaseDate, setPurchaseDate] = useState(today);
  const [expirationDate, setExpirationDate] = useState('');

  // Status and error states
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showNetworkWarning, setShowNetworkWarning] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const [createdProduct, setCreatedProduct] = useState<{
    productId: string;
    name: string;
    quantity: number;
    expirationDate: string;
  } | null>(null);

  // Load categories
  useEffect(() => {
    async function load() {
      const res = await getCategories();
      setLoadingCategories(false);

      if (res.kind === 'success' && res.categories.length > 0) {
        setCategories(res.categories);
        setSelectedCategoryId(res.categories[0].id);
      } else if (res.kind === 'error') {
        setFormError(res.message);
      }
    }
    load();
  }, []);

  const isPastExpiry = isValidCalendarDate(expirationDate) && isDateInPast(expirationDate);

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setShowNetworkWarning(false);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError('Product name cannot be empty');
      return;
    }
    if (trimmedName.length > 100) {
      setFormError('Product name must not exceed 100 characters');
      return;
    }

    if (!selectedCategoryId) {
      setFormError('Please select a category');
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Price must be a valid number greater than or equal to 0.00');
      return;
    }

    const lowStockNum = Number(lowStockLevel);
    if (!Number.isInteger(lowStockNum) || lowStockNum < 0) {
      setFormError('Low-stock level must be a whole number greater than or equal to 0');
      return;
    }

    const qtyNum = Number(quantity);
    if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > 100000) {
      setFormError('Quantity must be a whole number between 1 and 100,000');
      return;
    }

    const pDate = purchaseDate.trim() || today;
    if (!isValidCalendarDate(pDate)) {
      setFormError('Purchase date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }

    const expDate = expirationDate.trim();
    if (!expDate) {
      setFormError('Expiration date is required');
      return;
    }

    if (!isValidCalendarDate(expDate)) {
      setFormError('Expiration date must be a valid calendar date in YYYY-MM-DD format');
      return;
    }

    if (expDate < pDate) {
      setFormError('Expiration date cannot be earlier than purchase date');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setFormError(null);
    setShowNetworkWarning(false);

    const trimmedName = name.trim();
    const priceNum = parseFloat(price);
    const lowStockNum = Number(lowStockLevel);
    const qtyNum = Number(quantity);
    const pDate = purchaseDate.trim() || today;
    const expDate = expirationDate.trim();

    const res = await createProductWithBatch({
      p_name: trimmedName,
      p_category_id: selectedCategoryId,
      p_price: priceNum,
      p_quantity: qtyNum,
      p_expiration_date: expDate,
      p_barcode: barcode.trim() || null,
      p_low_stock_level: lowStockNum,
      p_purchase_date: pDate,
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

    setCreatedProduct({
      productId: res.productId,
      name: trimmedName,
      quantity: qtyNum,
      expirationDate: expDate,
    });
  };

  const handleResetForm = () => {
    setName('');
    setBarcode('');
    setPrice('0.00');
    setLowStockLevel('5');
    setQuantity('10');
    setPurchaseDate(today);
    setExpirationDate('');
    setFormError(null);
    setShowNetworkWarning(false);
    setCreatedProduct(null);
    if (categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Notice Banner */}
      <div className="border border-blue-200 bg-blue-50 p-4 rounded text-blue-900 text-sm">
        Camera barcode scanning is available in the mobile app.
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Product</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create a new product with its first delivery batch
          </p>
        </div>
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900">
          Cancel
        </Link>
      </div>

      {/* SUCCESS VIEW */}
      {createdProduct ? (
        <div className="border border-green-300 bg-green-50 p-6 rounded space-y-4">
          <h2 className="text-lg font-bold text-green-900">
            Created &quot;{createdProduct.name}&quot; successfully
          </h2>
          <p className="text-sm text-green-800">
            Initial batch recorded with {createdProduct.quantity} units expiring on {createdProduct.expirationDate}.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
            >
              Add another product
            </button>
            <Link
              href={`/inventory/${createdProduct.productId}`}
              className="border border-gray-300 bg-white px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50"
            >
              View product
            </Link>
            <Link
              href="/inventory"
              className="text-sm text-gray-600 hover:text-gray-900 ml-auto"
            >
              Back to inventory
            </Link>
          </div>
        </div>
      ) : (
        /* PRODUCT FORM */
        <div className="bg-white border border-gray-200 rounded p-6 space-y-6">
          {formError && (
            <div className="p-3 border border-red-300 bg-red-50 text-red-800 text-sm rounded space-y-2">
              <p>{formError}</p>
              {showNetworkWarning && (
                <div className="pt-1">
                  <Link href="/inventory" className="text-sm font-semibold underline text-red-900">
                    Go to Inventory to check if product was saved →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="space-y-6">
            {/* Section 1: Product Information */}
            <div className="space-y-4">
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2">
                Product Details
              </h2>

              <div>
                <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Product name <span className="text-red-500">*</span>
                </label>
                <input
                  id="product-name"
                  type="text"
                  maxLength={100}
                  required
                  placeholder="e.g. Milk 1L"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label htmlFor="product-barcode" className="block text-sm font-medium text-gray-700 mb-1">
                  Barcode
                </label>
                <input
                  id="product-barcode"
                  type="text"
                  placeholder="Optional if barcode-less"
                  value={barcode}
                  onChange={(e) => {
                    setBarcode(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label htmlFor="product-category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                {loadingCategories ? (
                  <p className="text-xs text-gray-500 py-2">Loading categories...</p>
                ) : (
                  <select
                    id="product-category"
                    required
                    value={selectedCategoryId}
                    onChange={(e) => {
                      setSelectedCategoryId(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={saving || showNetworkWarning}
                    className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-price" className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => {
                      setPrice(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={saving || showNetworkWarning}
                    className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>

                <div>
                  <label htmlFor="product-low-stock" className="block text-sm font-medium text-gray-700 mb-1">
                    Low-stock alert level <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="product-low-stock"
                    type="number"
                    step="1"
                    min="0"
                    required
                    placeholder="5"
                    value={lowStockLevel}
                    onChange={(e) => {
                      setLowStockLevel(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={saving || showNetworkWarning}
                    className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: First Batch Details */}
            <div className="space-y-4 pt-2">
              <h2 className="text-base font-bold text-gray-900 border-b border-gray-200 pb-2">
                First Batch Details
              </h2>

              <div>
                <label htmlFor="batch-quantity" className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity (1 to 100,000) <span className="text-red-500">*</span>
                </label>
                <input
                  id="batch-quantity"
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  required
                  placeholder="10"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label htmlFor="batch-purchase-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Purchase date
                </label>
                <input
                  id="batch-purchase-date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => {
                    setPurchaseDate(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>

              <div>
                <label htmlFor="batch-expiration-date" className="block text-sm font-medium text-gray-700 mb-1">
                  Expiration date <span className="text-red-500">*</span>
                </label>
                <input
                  id="batch-expiration-date"
                  type="date"
                  required
                  value={expirationDate}
                  onChange={(e) => {
                    setExpirationDate(e.target.value);
                    if (formError) setFormError(null);
                  }}
                  disabled={saving || showNetworkWarning}
                  className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
                {isPastExpiry && (
                  <p className="text-xs text-amber-700 font-medium mt-1">
                    Warning: The expiration date is already in the past.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || showNetworkWarning}
                className="bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save product'}
              </button>
              <Link
                href="/inventory"
                className="border border-gray-300 px-4 py-2 rounded text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title="Confirm New Product"
        message={`Are you sure you want to create "${name.trim()}" with ${quantity} units expiring on ${expirationDate}?`}
        confirmText="Yes, create product"
        cancelText="Cancel"
        isSaving={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
}
