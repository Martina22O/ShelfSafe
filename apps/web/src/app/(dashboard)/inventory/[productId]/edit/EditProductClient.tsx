'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useStoreSettings } from '../../../../../context/StoreSettingsContext';
import {
  getProductWithBatches,
  getCategories,
  updateProduct,
} from '../../../../../lib/inventory';
import { Category, ProductWithBatches } from '../../../../../types/inventory';
import { ConfirmModal } from '../../../../../components/ConfirmModal';

interface EditProductClientProps {
  productId: string;
}

export function EditProductClient({ productId }: EditProductClientProps) {
  const router = useRouter();
  const { near_expiry_days, loading: settingsLoading, error: settingsError, reload: reloadSettings } = useStoreSettings();

  const [initialProduct, setInitialProduct] = useState<ProductWithBatches | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isArchived, setIsArchived] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [price, setPrice] = useState('0.00');
  const [lowStockLevel, setLowStockLevel] = useState('5');

  // Submit and modal states
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRequestId = useRef(0);
  const isFetchingRef = useRef(false);

  const loadData = useCallback(async () => {
    if (near_expiry_days === null || settingsLoading || settingsError) {
      return;
    }

    const currentRequestId = ++fetchRequestId.current;
    isFetchingRef.current = true;

    const [prodRes, catRes] = await Promise.all([
      getProductWithBatches(productId, near_expiry_days),
      getCategories(),
    ]);

    if (currentRequestId !== fetchRequestId.current) {
      return;
    }

    isFetchingRef.current = false;

    if (prodRes.kind === 'error') {
      setError(prodRes.message);
      setLoading(false);
      return;
    }

    if (prodRes.kind === 'not_found') {
      setIsNotFound(true);
      setLoading(false);
      return;
    }

    if (prodRes.kind === 'archived' || prodRes.data.is_archived) {
      setIsArchived(true);
      setLoading(false);
      return;
    }

    const prod = prodRes.data;
    setInitialProduct(prod);
    setName(prod.name);
    setBarcode(prod.barcode || '');
    setPrice(prod.price.toFixed(2));
    setLowStockLevel(prod.low_stock_level.toString());

    if (catRes.kind === 'success') {
      setCategories(catRes.categories);
      setSelectedCategoryId(prod.category_id || catRes.categories[0]?.id || '');
    } else {
      setSelectedCategoryId(prod.category_id || '');
    }

    setError(null);
    setIsArchived(false);
    setIsNotFound(false);
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

  // Trimmed change detection
  const trimmedName = name.trim();
  const trimmedBarcode = barcode.trim() !== '' ? barcode.trim() : null;
  const initialBarcode = initialProduct?.barcode ? initialProduct.barcode.trim() : null;
  const priceNum = parseFloat(price);
  const lowStockNum = Number(lowStockLevel);

  const isBarcodeChanged = Boolean(
    initialProduct && trimmedBarcode !== initialBarcode
  );

  const isUnchanged = Boolean(
    initialProduct &&
      trimmedName === initialProduct.name.trim() &&
      trimmedBarcode === initialBarcode &&
      selectedCategoryId === initialProduct.category_id &&
      !isNaN(priceNum) &&
      priceNum === initialProduct.price &&
      !isNaN(lowStockNum) &&
      lowStockNum === initialProduct.low_stock_level
  );

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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
    if (isNaN(priceNum) || priceNum < 0) {
      setFormError('Price must be a valid number greater than or equal to 0.00');
      return;
    }
    if (!Number.isInteger(lowStockNum) || lowStockNum < 0) {
      setFormError('Low-stock level must be a whole number greater than or equal to 0');
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    setFormError(null);
    setSuccessMessage(null);

    const res = await updateProduct({
      productId,
      name: trimmedName,
      barcode: trimmedBarcode,
      categoryId: selectedCategoryId,
      price: priceNum,
      lowStockLevel: lowStockNum,
    });

    if (res.kind === 'db_error') {
      setFormError(res.message);
      setSaving(false);
      return;
    }

    if (res.kind === 'network_error') {
      setFormError(res.message);
      await loadData();
      setSaving(false);
      return;
    }

    // Success
    setSuccessMessage('Product updated successfully!');
    setSaving(false);
    setTimeout(() => {
      router.push(`/inventory/${productId}`);
      router.refresh();
    }, 600);
  };

  if (settingsLoading || loading) {
    return (
      <div className="py-8 text-center text-gray-500 text-sm">
        Loading product details...
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
            Archived products cannot be edited.
          </p>
          <Link
            href="/inventory"
            className="inline-block bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
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
        <Link href="/inventory" className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1">
          ← Back to Inventory
        </Link>
        <div className="border border-gray-200 bg-white p-6 rounded">
          <h1 className="text-xl font-bold text-gray-900 mb-2">This product no longer exists</h1>
          <p className="text-sm text-gray-600 mb-4">
            The requested product could not be found.
          </p>
          <Link
            href="/inventory"
            className="inline-block bg-black text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-800"
          >
            Back to Inventory
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 p-6 rounded text-red-800 max-w-md my-4">
        <h2 className="font-bold text-base mb-1">Failed to load product</h2>
        <p className="text-sm mb-4">{error}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => loadData()}
            className="bg-red-700 text-white px-3 py-1.5 rounded text-sm hover:bg-red-800"
          >
            Retry
          </button>
          <Link
            href={`/inventory/${productId}`}
            className="border border-gray-300 bg-white text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-50"
          >
            Back to Product
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between pb-2 border-b border-[#ece3d2]">
        <div className="flex items-center gap-2.5">
          <Link
            href={`/inventory/${productId}`}
            className="p-1.5 rounded-lg border border-[#ece3d2] bg-white text-[#7a7469] hover:text-[#181413] hover:bg-[#fef9f0] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-[#181413] tracking-tight">Edit Product</h1>
            <p className="text-xs text-[#7a7469] mt-0.5">
              Update details for <span className="font-semibold text-[#181413]">{initialProduct?.name}</span>
            </p>
          </div>
        </div>
        <Link
          href={`/inventory/${productId}`}
          className="text-xs font-bold text-[#7a7469] hover:text-[#181413] transition-colors"
        >
          Cancel
        </Link>
      </div>

      {successMessage && (
        <div className="p-4 border border-[#207429]/30 bg-[#f4ffe1] text-[#207429] text-xs font-semibold rounded-xl flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-[#207429]" />
          <span>{successMessage}</span>
        </div>
      )}

      {formError && (
        <div className="p-3 border border-red-200 bg-red-50 text-red-900 text-xs rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded p-6 space-y-6">
        <form onSubmit={handleOpenConfirm} className="space-y-4">
          <div>
            <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 mb-1">
              Product name <span className="text-red-500">*</span>
            </label>
            <input
              id="product-name"
              type="text"
              maxLength={100}
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (formError) setFormError(null);
              }}
              disabled={saving}
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
              disabled={saving}
              className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
            />
            {isBarcodeChanged && (
              <p className="text-xs text-amber-700 font-medium mt-1">
                Warning: Changing the barcode will change which barcode scans find this product.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="product-category" className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id="product-category"
              required
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                if (formError) setFormError(null);
              }}
              disabled={saving}
              className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black bg-white"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
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
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (formError) setFormError(null);
                }}
                disabled={saving}
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
                value={lowStockLevel}
                onChange={(e) => {
                  setLowStockLevel(e.target.value);
                  if (formError) setFormError(null);
                }}
                disabled={saving}
                className="w-full border border-gray-300 p-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving || isUnchanged}
              className="bg-[#207429] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link
              href={`/inventory/${productId}`}
              className="border border-[#ece3d2] px-4 py-2.5 rounded-xl text-xs font-semibold text-[#524c40] hover:bg-[#fef9f0]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showConfirmModal}
        title="Confirm Edit"
        message="Save these changes?"
        confirmText="Yes, save"
        cancelText="Cancel"
        isSaving={saving}
        onConfirm={handleConfirmSave}
        onCancel={() => setShowConfirmModal(false)}
      />
    </div>
  );
}
