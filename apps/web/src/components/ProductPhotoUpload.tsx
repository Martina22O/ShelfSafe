'use client';

import React, { useRef, useState } from 'react';
import { Upload, RefreshCw, Trash2 } from 'lucide-react';
import { ProductCategoryIcon } from './ProductCategoryIcon';

interface ProductPhotoUploadProps {
  selectedFile: File | null;
  onFileSelected: (file: File | null) => void;
  previewUrl: string | null;
  categoryName?: string | null;
  disabled?: boolean;
}

export function ProductPhotoUpload({
  selectedFile,
  onFileSelected,
  previewUrl,
  categoryName,
  disabled = false,
}: ProductPhotoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate MIME type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setErrorMsg('Please select a valid image (JPEG, PNG, or WebP).');
      return;
    }

    // Validate size (max 2 MB before client compression)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size must be 2 MB or smaller.');
      return;
    }

    onFileSelected(file);
    // Reset file input so selecting the same file again still fires change
    e.target.value = '';
  };

  const handleRemove = () => {
    setErrorMsg(null);
    onFileSelected(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-bold uppercase tracking-wide text-[#524c40]">
        Product Photo (Optional)
      </label>

      {/* Hidden file input - NO camera / webcam */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={disabled}
        className="hidden"
        id="product-photo-file-input"
      />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-3.5 bg-[#fef9f0] border border-[#ece3d2] rounded-2xl">
        {/* Uniform square container with contain object fit */}
        <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-xl border border-[#ece3d2] bg-white overflow-hidden shrink-0 flex items-center justify-center p-1">
          {previewUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={previewUrl}
              alt="Product preview"
              className="w-full h-full object-contain"
            />
          ) : (
            <ProductCategoryIcon
              categoryName={categoryName}
              size={36}
              className="w-full h-full rounded-xl border-0"
            />
          )}
        </div>

        {/* Action Controls */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {previewUrl ? (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#d6f0b4] bg-[#f4ffe1] text-xs font-bold text-[#207429] hover:bg-[#e9f8cf] transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Replace Photo
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={disabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#d6f0b4] bg-[#f4ffe1] text-xs font-bold text-[#207429] hover:bg-[#e9f8cf] transition-colors shadow-2xs disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Upload Photo
              </button>
            )}
          </div>

          <p className="text-[11px] text-[#7a7469]">
            {previewUrl
              ? selectedFile
                ? `Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(0)} KB)`
                : 'Current photo saved on product.'
              : 'JPG, PNG, or WebP up to 2 MB. If omitted, the category placeholder is used.'}
          </p>

          {errorMsg && (
            <p className="text-xs font-medium text-red-600 pt-0.5">{errorMsg}</p>
          )}
        </div>
      </div>
    </div>
  );
}
