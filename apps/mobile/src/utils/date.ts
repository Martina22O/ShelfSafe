/**
 * Date utilities for ShelfSafe (Asia/Manila timezone)
 */

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
