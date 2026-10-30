/**
 * Date utilities for ShelfSafe (Asia/Manila timezone)
 */
import { BatchStockStatus } from '../types/inventory';

export { BatchStockStatus };

/**
 * Returns current date in Asia/Manila timezone as YYYY-MM-DD
 */
export function getTodayInManila(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

/**
 * Validates that a string is a valid calendar date in YYYY-MM-DD format.
 * Strictly checks for real calendar dates (e.g., 2026-02-31 is invalid).
 */
export function isValidCalendarDate(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') return false;
  const match = dateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const dateObj = new Date(year, month - 1, day);
  return (
    dateObj.getFullYear() === year &&
    dateObj.getMonth() + 1 === month &&
    dateObj.getDate() === day
  );
}

/**
 * Checks if a date string is earlier than today in Asia/Manila.
 */
export function isDateInPast(dateString: string): boolean {
  if (!isValidCalendarDate(dateString)) return false;
  const today = getTodayInManila();
  return dateString < today;
}

/**
 * Shared threshold: expiration_date within 7 days from today is considered near expiry.
 * Matches get_inventory_alerts function in Supabase.
 */
export const NEAR_EXPIRY_DAYS = 7;

/**
 * Adds an integer number of days to a YYYY-MM-DD date string.
 * Uses Date.UTC so no day is ever shifted by local time zone or DST.
 */
export function addDaysToDate(dateString: string, days: number): string {
  const parts = dateString.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);

  const utcDate = new Date(Date.UTC(y, m - 1, d + days));
  const nextY = utcDate.getUTCFullYear();
  const nextM = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(utcDate.getUTCDate()).padStart(2, '0');
  return `${nextY}-${nextM}-${nextD}`;
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Formats a YYYY-MM-DD date string directly to "MMM D, YYYY" (e.g. "Sep 28, 2026")
 * without using new Date(dateString) to prevent any time zone offset shifts.
 */
export function formatDisplayDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  const match = dateString.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateString;
  const year = match[1];
  const monthIdx = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const month = MONTH_NAMES[monthIdx] || match[2];
  return `${month} ${day}, ${year}`;
}

/**
 * Determines the status of an individual batch:
 * - "Sold out" if quantity_left <= 0
 * - "Expired" if expiration_date < today
 * - "Near Expiry" if expiration_date is from today up to today + NEAR_EXPIRY_DAYS
 * - "Good" otherwise
 */
export function getBatchStatus(
  expirationDate: string,
  quantityLeft: number,
  today: string = getTodayInManila()
): BatchStockStatus {
  if (quantityLeft <= 0) {
    return 'Sold out';
  }
  if (expirationDate < today) {
    return 'Expired';
  }
  const nearExpiryThreshold = addDaysToDate(today, NEAR_EXPIRY_DAYS);
  if (expirationDate <= nearExpiryThreshold) {
    return 'Near Expiry';
  }
  return 'Good';
}

/**
 * Formats an ISO timestamp string into Asia/Manila date and time (e.g. "Oct 30, 2026, 6:30 PM").
 */
export function formatManilaDateTime(isoString: string | null | undefined): string {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  } catch {
    return isoString;
  }
}


