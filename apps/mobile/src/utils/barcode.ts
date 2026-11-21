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
 * Expands a 6-digit or 8-digit UPC-E barcode into its 12-digit UPC-A equivalent
 * if it matches standard UPC-E compression rules.
 */
export function expandUpcEToUpcA(code: string): string | null {
  const trimmed = (code || '').trim();
  let sixDigits = '';
  let numberSystem = '0';
  let checkDigit = '';

  if (/^\d{8}$/.test(trimmed) && (trimmed[0] === '0' || trimmed[0] === '1')) {
    numberSystem = trimmed[0];
    sixDigits = trimmed.slice(1, 7);
    checkDigit = trimmed[7];
  } else if (/^\d{6}$/.test(trimmed)) {
    sixDigits = trimmed;
  } else {
    return null;
  }

  const d1 = sixDigits[0];
  const d2 = sixDigits[1];
  const d3 = sixDigits[2];
  const d4 = sixDigits[3];
  const d5 = sixDigits[4];
  const d6 = sixDigits[5];

  let upcAWithoutCheck = '';
  if (d6 === '0' || d6 === '1' || d6 === '2') {
    upcAWithoutCheck = `${numberSystem}${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  } else if (d6 === '3') {
    upcAWithoutCheck = `${numberSystem}${d1}${d2}${d3}00000${d4}${d5}`;
  } else if (d6 === '4') {
    upcAWithoutCheck = `${numberSystem}${d1}${d2}${d3}${d4}00000${d5}`;
  } else {
    upcAWithoutCheck = `${numberSystem}${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  }

  if (checkDigit) {
    return `${upcAWithoutCheck}${checkDigit}`;
  }

  // Compute Mod-10 check digit for 11-digit payload
  let sum = 0;
  for (let i = upcAWithoutCheck.length - 1; i >= 0; i--) {
    const digit = upcAWithoutCheck.charCodeAt(i) - 48;
    const weight = (upcAWithoutCheck.length - 1 - i) % 2 === 0 ? 3 : 1;
    sum += digit * weight;
  }
  const computedCheck = (10 - (sum % 10)) % 10;
  return `${upcAWithoutCheck}${computedCheck}`;
}

/**
 * Returns an array of barcode variants for database lookup:
 * - The code as scanned (trimmed).
 * - If 12 digits (UPC-A), also "0" + code (EAN-13).
 * - If 13 digits starting with "0" (EAN-13), also the code without the first digit (UPC-A).
 * - If 6 or 8 digits matching UPC-E, also its expanded 12-digit UPC-A and 13-digit EAN-13 forms.
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

  // 6 or 8 digits UPC-E -> also expanded 12-digit UPC-A and 13-digit EAN-13
  const expandedUpcA = expandUpcEToUpcA(trimmed);
  if (expandedUpcA) {
    variants.add(expandedUpcA);
    variants.add('0' + expandedUpcA);
  }

  return Array.from(variants);
}

/**
 * Safely extracts the scanned barcode string from an expo-camera BarcodeScanningResult.
 * Handles Android ML Kit cases where `data` (`displayValue`) may be serialized as `"null"`
 * while `raw` (`rawValue`) contains the actual payload.
 */
export function extractScannedBarcode(result: {
  data?: string | null;
  raw?: string | null;
  type?: string | null;
}): string {
  const cleanCandidate = (val?: string | null): string => {
    if (!val || typeof val !== 'string') return '';
    // Strip ASCII control characters (e.g. GS1 FNC1 \u001d) and trim whitespace
    const cleaned = val.replace(/[\u0000-\u001F\u007F]/g, '').trim();
    if (!cleaned || cleaned.toLowerCase() === 'null' || cleaned.toLowerCase() === 'undefined') {
      return '';
    }
    return cleaned;
  };

  return cleanCandidate(result?.data) || cleanCandidate(result?.raw);
}

/**
 * Validates whether a hardware-decoded barcode value from ML Kit / VisionKit
 * is non-empty and within valid barcode length bounds (1 to 128 characters).
 */
export function isPlausibleScannedBarcode(code: string): boolean {
  const trimmed = (code || '').trim();
  return trimmed.length >= 1 && trimmed.length <= 128;
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
