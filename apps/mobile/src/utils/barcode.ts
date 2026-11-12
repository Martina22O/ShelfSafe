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

/**
 * Validates that a barcode string is a standard retail barcode:
 * - Digits only
 * - Length 8 (EAN-8), 12 (UPC-A), or 13 (EAN-13)
 * - Valid GS1 Mod-10 check digit
 *
 * Examples (no test framework installed in apps/mobile):
 * - Valid:
 *   - "4801981118502" (EAN-13)
 *   - "036000291452"  (UPC-A)
 *   - "96385074"      (EAN-8)
 * - Invalid:
 *   - "4801981118503" (wrong check digit)
 *   - "1234567890"    (unsupported length 10)
 *   - "480198111850A" (contains non-digits)
 *   - ""              (empty)
 */
export function isValidRetailBarcode(code: string): boolean {
  if (!/^(?:\d{8}|\d{12}|\d{13})$/.test(code)) {
    return false;
  }

  let sum = 0;
  // Walk data digits right-to-left (excluding the last check digit), alternating weights 3 and 1
  for (let i = code.length - 2; i >= 0; i--) {
    const digit = code.charCodeAt(i) - 48;
    const weight = (code.length - 2 - i) % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }

  const expectedCheckDigit = (10 - (sum % 10)) % 10;
  const actualCheckDigit = code.charCodeAt(code.length - 1) - 48;

  return expectedCheckDigit === actualCheckDigit;
}
