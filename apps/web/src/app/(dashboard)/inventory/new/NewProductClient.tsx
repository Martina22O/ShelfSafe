'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  ScanBarcode,
} from 'lucide-react';
import { getCategories, createProductWithBatch } from '../../../../lib/inventory';
import { uploadProductPhotoWeb, deleteProductPhoto, generateUUID } from '../../../../lib/storage';
import { ProductPhotoUpload } from '../../../../components/ProductPhotoUpload';
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
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

    let uploadedStoragePath: string | null = null;
    const prospectiveId = generateUUID();

    if (selectedFile) {
      const uploadRes = await uploadProductPhotoWeb(selectedFile, prospectiveId);
      if ('error' in uploadRes) {
        setFormError(`Photo upload failed: ${uploadRes.error}. Please try again or remove photo.`);
        setSaving(false);
        return;
      }
      uploadedStoragePath = uploadRes.storagePath;
    }

    const res = await createProductWithBatch({
      p_name: trimmedName,
      p_category_id: selectedCategoryId,
      p_price: priceNum,
      p_quantity: qtyNum,
      p_expiration_date: expDate,
      p_barcode: barcode.trim() || null,
      p_low_stock_level: lowStockNum,
      p_purchase_date: pDate,
      p_image_url: uploadedStoragePath,
    });

    if (res.kind === 'db_error') {
      if (uploadedStoragePath) {
        await deleteProductPhoto(uploadedStoragePath);
      }
      setSaving(false);
      setFormError(res.message);
      return;
    }

    if (res.kind === 'network_error') {
      setSaving(false);
      setFormError(res.message);
      setShowNetworkWarning(true);
      return;
    }

    setSaving(false);

    setCreatedProduct({
      productId: res.productId,
      name: trimmedName,
      quantity: qtyNum,
      expirationDate: expDate,
    });
  };

  const handleResetForm = () => {
    setName('');
    setSelectedFile(null);
    setPreviewUrl(null);
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
    <div className="space-y-6 w-full">
      {/* Notice Banner */}
      <div className="border border-[#ece3d2] bg-[#fef9f0] p-4 rounded-xl text-[#524c40] text-xs flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <ScanBarcode className="w-4 h-4 text-[#207429]" />
          <span>Camera barcode scanning is available in the mobile app. On desktop, enter code manually or leave blank for barcode-less goods.</span>
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
          <div>
            <h1 className="text-2xl font-black text-[#181413] tracking-tight">New Product</h1>
            <p className="text-xs text-[#7a7469] mt-0.5">
              Register a new product and receive its first delivery batch.
            </p>
          </div>
        </div>
        <Link href="/inventory" className="text-xs font-bold text-[#7a7469] hover:text-[#181413] transition-colors">
          Cancel
        </Link>
      </div>

      {/* SUCCESS VIEW */}
      {createdProduct ? (
        <div className="border border-[#207429]/30 bg-[#f4ffe1] p-6 rounded-2xl space-y-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-[#207429]/30 flex items-center justify-center text-[#207429]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#181413]">
                Created &quot;{createdProduct.name}&quot; successfully
              </h2>
              <p className="text-xs text-[#7a7469] mt-0.5">
                Initial batch recorded with {createdProduct.quantity} units expiring on {createdProduct.expirationDate}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForm}
              className="bg-[#207429] text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-[#185e21] transition-colors shadow-2xs"
            >
              Add Another Product
            </button>
            <Link
              href={`/inventory/${createdProduct.productId}`}
              className="border border-[#ece3d2] bg-white px-4 py-2 rounded-xl text-xs font-bold text-[#181413] hover:bg-[#fef9f0] transition-colors shadow-2xs"
            >
              View Product Details
            </Link>
            <Link
              href="/inventory"
              className="text-xs font-bold text-[#7a7469] hover:text-[#181413] ml-auto"
            >
              Back to Inventory
            </Link>
          </div>
        </div>
      ) : (
        /* PRODUCT FORM */
        <div className="bg-white border border-[#ece3d2] rounded-2xl p-6 space-y-6 shadow-2xs">
          {formError && (
            <div className="p-3 border border-red-200 bg-red-50 text-red-900 text-xs rounded-xl space-y-2">
              <p>{formError}</p>
              {showNetworkWarning && (
                <div className="pt-1">
                  <Link href="/inventory" className="text-xs font-bold underline text-red-900">
                    Go to Inventory to check if product was saved →
                  </Link>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleOpenConfirm} className="space-y-6">
            {/* Section 1: Product Information */}
            <div className="space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#181413] border-b border-[#ece3d2] pb-2">
                1. Product Information
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-name" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="product-name"
                    type="text"
                    maxLength={100}
                    required
                    placeholder="e.g. Evaporated Milk 370ml"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (formError) setFormError(null);
                    }}
                    disabled={saving || showNetworkWarning}
                    className="w-full border border-[#ece3d2] p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white transition-all"
                  />
                </div>

                <div className="lg:col-span-2">
                  <ProductPhotoUpload
                    selectedFile={selectedFile}
                    onFileSelected={(file) => {
                      setSelectedFile(file);
                      if (file) {
                        setPreviewUrl(URL.createObjectURL(file));
                      } else {
                        setPreviewUrl(null);
                      }
                    }}
                    previewUrl={previewUrl}
                    categoryName={categories.find((c) => c.id === selectedCategoryId)?.name}
                    disabled={saving || showNetworkWarning}
                  />
                </div>

                <div>
                  <label htmlFor="product-barcode" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                    Barcode (Optional)
                  </label>
                  <div className="relative">
                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
                    <input
                      id="product-barcode"
                      type="text"
                      placeholder="Enter or scan barcode..."
                      value={barcode}
                      onChange={(e) => {
                        setBarcode(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      disabled={saving || showNetworkWarning}
                      className="w-full pl-9 pr-4 py-2.5 text-sm bg-[#f8faf8] border border-[#ece3d2] rounded-xl text-[#181413] focus:outline-none focus:ring-2 focus:ring-[#207429] focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="product-category" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  {loadingCategories ? (
                    <p className="text-xs text-[#7a7469] py-2">Loading categories...</p>
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
                      className="w-full border border-[#ece3d2] p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
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
                    <label htmlFor="product-price" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                      Selling Price (₱) <span className="text-red-500">*</span>
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
                      className="w-full border border-[#ece3d2] p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="product-low-stock" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                      Low-Stock Alert Level <span className="text-red-500">*</span>
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
                      className="w-full border border-[#ece3d2] p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: First Batch Details */}
            <div className="space-y-4 pt-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#181413] border-b border-[#ece3d2] pb-2">
                2. Initial Batch Delivery
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="batch-quantity" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                    Initial Units Received <span className="text-red-500">*</span>
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
                    className="w-full border border-[#ece3d2] p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                  />
                </div>

                <div>
                  <label htmlFor="batch-purchase-date" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                    Purchase Date
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
                    className="w-full border border-[#ece3d2] p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label htmlFor="batch-expiration-date" className="block text-xs font-bold uppercase tracking-wide text-[#524c40] mb-1">
                    Expiration Date <span className="text-red-500">*</span>
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
                    className="w-full border border-[#ece3d2] p-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#207429] bg-[#f8faf8] focus:bg-white"
                  />
                  {isPastExpiry && (
                    <p className="text-xs text-[#b45309] font-medium mt-1">
                      Warning: The expiration date is already in the past.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={saving || showNetworkWarning}
                className="bg-[#207429] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-[#185e21] disabled:opacity-50 transition-colors shadow-2xs"
              >
                {saving ? 'Creating...' : 'Save Product & Batch'}
              </button>
              <Link
                href="/inventory"
                className="border border-[#ece3d2] px-4 py-2.5 rounded-xl text-xs font-semibold text-[#524c40] hover:bg-[#fef9f0]"
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
