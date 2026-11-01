/**
 * Date utilities for ShelfSafe (Asia/Manila timezone).
 * Never uses new Date(dateString) on date-only strings to avoid timezone shifts.
 */

export const NEAR_EXPIRY_DAYS = 7;

/**
 * Returns today's date in Asia/Manila as YYYY-MM-DD.
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
 * Formats an ISO timestamp string into Asia/Manila date and time.
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

