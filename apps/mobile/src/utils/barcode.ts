/**
 * Barcode utilities for ShelfSafe
 */

/**
 * Trims whitespace. Empty string becomes null.
 */
export function normalizeBarcode(rawBarcode: string | null | undefined): string | null {
  if (!rawBarcode) return null;
  const trimmed = rawBarcode.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Returns an array of barcode variants for database lookup:
 * - The code as scanned (trimmed).
 * - If 12 digits (UPC-A), also "0" + code (EAN-13).
 * - If 13 digits starting with "0" (EAN-13), also the code without the first digit (UPC-A).
 */
export function getBarcodeVariants(rawBarcode: string): string[] {
  const trimmed = (rawBarcode || '').trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  variants.add(trimmed);

  // 12 digits -> also "0" + code
  if (/^\d{12}$/.test(trimmed)) {
    variants.add('0' + trimmed);
  }

  // 13 digits starting with '0' -> also code without first digit
  if (/^0\d{12}$/.test(trimmed)) {
    variants.add(trimmed.slice(1));
  }

  return Array.from(variants);
}
