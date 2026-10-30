import { InventoryAlert } from '../types/inventory';

/**
 * Returns rule-based wording for days until expiration or days expired.
 * Requirements:
 * - 0 = "today", 1 = "1 day", otherwise "N days"
 * - For expired alerts: uses positive number ("expired 3 days ago", "expired 1 day ago", "expired today")
 * - For near expiry: "expires in 3 days", "expires in 1 day", "expires today"
 */
export function formatExpirationDaysText(
  daysUntilExpiration: number | null | undefined,
  isExpired: boolean
): string {
  if (daysUntilExpiration === null || daysUntilExpiration === undefined) {
    return isExpired ? 'expired' : 'near expiry';
  }

  const absDays = Math.abs(daysUntilExpiration);

  if (isExpired) {
    if (absDays === 0) {
      return 'expired today';
    }
    if (absDays === 1) {
      return 'expired 1 day ago';
    }
    return `expired ${absDays} days ago`;
  }

  if (daysUntilExpiration === 0) {
    return 'expires today';
  }
  if (daysUntilExpiration === 1) {
    return 'expires in 1 day';
  }
  return `expires in ${daysUntilExpiration} days`;
}

/**
 * Rule-based suggested actions for inventory alerts.
 * Uses plain if/else rules (no AI wording).
 * - near expiry -> "Put these in front and sell them first. Consider a discount or bundling."
 * - expired -> "Remove them from the shelf and dispose of them properly."
 * - low stock -> "Consider reordering soon."
 * Includes days left or units when helpful.
 */
export function getSuggestedAction(alert: Partial<InventoryAlert>): string {
  if (alert.alert_type === 'expired') {
    if (alert.batch_quantity_left !== null && alert.batch_quantity_left !== undefined && alert.batch_quantity_left > 0) {
      const unitsText = alert.batch_quantity_left === 1 ? '1 unit' : `${alert.batch_quantity_left} units`;
      return `Remove all ${unitsText} from the shelf and dispose of them properly.`;
    }
    return 'Remove them from the shelf and dispose of them properly.';
  }

  if (alert.alert_type === 'near_expiry') {
    if (alert.days_until_expiration === 0) {
      return 'Expires today! Put these in front and sell them first. Consider a discount or bundling.';
    }
    if (
      alert.days_until_expiration !== null &&
      alert.days_until_expiration !== undefined &&
      alert.days_until_expiration <= 3
    ) {
      const daysText = alert.days_until_expiration === 1 ? '1 day' : `${alert.days_until_expiration} days`;
      return `Only ${daysText} left. Put these in front and sell them first. Consider a discount or bundling.`;
    }
    return 'Put these in front and sell them first. Consider a discount or bundling.';
  }

  if (alert.alert_type === 'low_stock') {
    if (alert.current_stock === 0) {
      return 'Out of stock. Consider reordering soon.';
    }
    if (alert.current_stock !== null && alert.current_stock !== undefined) {
      const unitsText = alert.current_stock === 1 ? '1 unit' : `${alert.current_stock} units`;
      return `Only ${unitsText} left. Consider reordering soon.`;
    }
    return 'Consider reordering soon.';
  }

  return '';
}
