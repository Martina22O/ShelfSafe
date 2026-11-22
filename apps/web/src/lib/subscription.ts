/**
 * Library: subscription.ts
 * Manages ShelfSafe subscription plans, entitlement checks,
 * 30-day free trial activations, onboarding completion, and
 * server-validated payment simulations for the web client.
 */
import { createClient } from './supabase/client';

export interface SubscriptionPlan {
  id: string;
  name: string;
  pricePhp: number;
  durationDays: number;
  billingCycle: 'monthly' | 'quarterly' | 'semiannual' | 'annual';
  discountLabel?: string;
  isPopular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'premium_monthly',
    name: 'Monthly Premium',
    pricePhp: 99,
    durationDays: 30,
    billingCycle: 'monthly',
  },
  {
    id: 'premium_quarterly',
    name: 'Quarterly Premium',
    pricePhp: 189,
    durationDays: 90,
    billingCycle: 'quarterly',
    discountLabel: 'Save 36%',
  },
  {
    id: 'premium_semiannual',
    name: 'Semi-Annual Premium',
    pricePhp: 289,
    durationDays: 180,
    billingCycle: 'semiannual',
    discountLabel: 'Save 51%',
  },
  {
    id: 'premium_annual',
    name: 'Annual Premium',
    pricePhp: 499,
    durationDays: 365,
    billingCycle: 'annual',
    discountLabel: 'Best Value • Save 58%',
    isPopular: true,
  },
];

export interface UserSubscription {
  owner_id: string;
  status: 'free' | 'trialing' | 'active' | 'expired';
  raw_status?: string;
  is_premium: boolean;
  plan_id: string | null;
  plan_name?: string | null;
  plan_price?: number | null;
  auto_renew?: boolean;
  cancel_at_period_end?: boolean;
  trial_eligible: boolean;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  days_remaining: number;
  onboarding_completed: boolean;
}

export interface SubscriptionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  isRpcUnavailable?: boolean;
}

export interface TestCardDetails {
  cardNumber: string;
  expiryDate: string; // MM/YY
  cvv: string;
  cardholderName: string;
}

export type CardNetwork = 'visa' | 'mastercard' | 'amex' | 'discover' | 'diners' | 'jcb' | 'unknown';

export function detectCardNetwork(rawDigits: string): CardNetwork {
  if (/^4/.test(rawDigits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(rawDigits)) return 'mastercard';
  if (/^3[47]/.test(rawDigits)) return 'amex';
  if (/^6(?:011|5)/.test(rawDigits)) return 'discover';
  if (/^3(?:0[0-5]|[68])/.test(rawDigits)) return 'diners';
  if (/^(?:2131|1800|35)/.test(rawDigits)) return 'jcb';
  return 'unknown';
}

export function getMaxCardLength(network: CardNetwork): number {
  switch (network) {
    case 'amex': return 15;
    case 'diners': return 14;
    default: return 16;
  }
}

export function getMaxCvvLength(network: CardNetwork): number {
  return network === 'amex' ? 4 : 3;
}

export function formatCardNumber(value: string): { formatted: string; raw: string; network: CardNetwork } {
  const digitsOnly = value.replace(/\D/g, '');
  const network = detectCardNetwork(digitsOnly);
  const maxLen = getMaxCardLength(network);
  const raw = digitsOnly.slice(0, maxLen);

  let formatted = '';
  if (network === 'amex') {
    // 4 - 6 - 5
    const p1 = raw.slice(0, 4);
    const p2 = raw.slice(4, 10);
    const p3 = raw.slice(10, 15);
    formatted = [p1, p2, p3].filter(Boolean).join(' ');
  } else if (network === 'diners') {
    // 4 - 6 - 4
    const p1 = raw.slice(0, 4);
    const p2 = raw.slice(4, 10);
    const p3 = raw.slice(10, 14);
    formatted = [p1, p2, p3].filter(Boolean).join(' ');
  } else {
    // 4 - 4 - 4 - 4
    const parts = raw.match(/[\s\S]{1,4}/g) || [];
    formatted = parts.join(' ');
  }

  return { formatted, raw, network };
}

export function formatExpiryDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
  }
  return digits;
}

export function luhnCheck(digits: string): boolean {
  if (!digits || digits.length < 13) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export interface CardValidationErrors {
  cardholderName?: string;
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;
}

export function validateCardholderName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'Cardholder name is required.';
  }
  if (trimmed.length < 2) {
    return 'Name must be at least 2 characters.';
  }
  if (!/^[a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s'.-]+$/.test(trimmed)) {
    return 'Name contains invalid characters.';
  }
  return null;
}

export function validateCardNumberField(cardNumber: string): string | null {
  const digits = cardNumber.replace(/\D/g, '');
  if (!digits) {
    return 'Card number is required.';
  }
  const network = detectCardNetwork(digits);
  const expectedLen = getMaxCardLength(network);
  if (digits.length < expectedLen) {
    return `Incomplete card number (${digits.length}/${expectedLen} digits).`;
  }
  if (!luhnCheck(digits)) {
    return 'Invalid card number checksum.';
  }
  return null;
}

export function validateExpiryDateField(expiryDate: string): string | null {
  const digits = expiryDate.replace(/\D/g, '');
  if (!digits) {
    return 'Enter a valid expiration date';
  }
  const match = expiryDate.match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return 'Enter a valid expiration date';
  }
  const month = parseInt(match[1], 10);
  const year = parseInt(`20${match[2]}`, 10);
  if (month < 1 || month > 12) {
    return 'Enter a valid expiration date';
  }
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return 'Enter a valid expiration date';
  }
  if (year > currentYear + 25) {
    return 'Enter a valid expiration date';
  }
  return null;
}

export function validateCvvField(cvv: string, network: CardNetwork = 'unknown'): string | null {
  const digits = cvv.replace(/\D/g, '');
  const expectedLen = getMaxCvvLength(network);
  if (!digits) {
    return 'Security code is required.';
  }
  if (digits.length !== expectedLen) {
    return network === 'amex' ? 'CVV must be 4 digits for Amex.' : 'CVV must be 3 digits.';
  }
  return null;
}

export const TEST_CARDS: Array<{
  label: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}> = [];

/**
 * Validates card inputs on the client before proceeding with checkout.
 * Real card numbers or CVVs are never accepted or stored.
 */
export function validateTestCard(details: TestCardDetails): {
  isValid: boolean;
  error?: string;
  errors: CardValidationErrors;
} {
  const nameErr = validateCardholderName(details.cardholderName);
  const numErr = validateCardNumberField(details.cardNumber);
  const expErr = validateExpiryDateField(details.expiryDate);
  const digits = details.cardNumber.replace(/\D/g, '');
  const network = detectCardNetwork(digits);
  const cvvErr = validateCvvField(details.cvv, network);

  const errors: CardValidationErrors = {};
  if (nameErr) errors.cardholderName = nameErr;
  if (numErr) errors.cardNumber = numErr;
  if (expErr) errors.expiryDate = expErr;
  if (cvvErr) errors.cvv = cvvErr;

  const firstError = nameErr || numErr || expErr || cvvErr;
  return {
    isValid: !firstError,
    error: firstError || undefined,
    errors,
  };
}

/**
 * Determines whether a Supabase error is caused by a missing/undeployed RPC.
 */
export function isRpcNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errObj = error as Record<string, unknown>;
  const msg = typeof errObj.message === 'string' ? errObj.message.toLowerCase() : '';
  const code = typeof errObj.code === 'string' ? errObj.code : '';
  return (
    code === '42883' || // Postgres undefined_function
    code === 'PGRST202' || // PostgREST function not found
    (msg.includes('function') && msg.includes('does not exist')) ||
    msg.includes('could not find the function')
  );
}

/**
 * Fetches the current user's subscription and entitlement details.
 */
export async function getUserSubscription(): Promise<SubscriptionResponse<UserSubscription>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'User is not authenticated' };
    }

    const { data, error } = await supabase.rpc('get_user_subscription');

    if (error) {
      if (isRpcNotFoundError(error)) {
        return {
          success: false,
          isRpcUnavailable: true,
          error: 'Subscription service is temporarily unavailable on the remote database.',
        };
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data as UserSubscription,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error fetching subscription';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Starts the one-time 30-day Premium free trial for the current authenticated user.
 */
export async function startFreeTrial(): Promise<SubscriptionResponse<Record<string, unknown>>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('start_free_trial');

    if (error) {
      if (isRpcNotFoundError(error)) {
        return {
          success: false,
          isRpcUnavailable: true,
          error: 'Trial activation is currently unavailable because database migrations have not been applied yet.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Record<string, unknown> };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error starting free trial';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Records onboarding completion or skip.
 * Preserves trial eligibility if the user chooses to continue with Free.
 */
export async function completeSubscriptionOnboarding(
  choice: string = 'skip'
): Promise<SubscriptionResponse<void>> {
  try {
    const supabase = createClient();
    const { error } = await supabase.rpc('complete_subscription_onboarding', {
      p_choice: choice,
    });

    if (error) {
      if (isRpcNotFoundError(error)) {
        return {
          success: false,
          isRpcUnavailable: true,
          error: 'Onboarding service is temporarily unavailable on the remote database.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error recording onboarding choice';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Simulates subscription payment for a selected plan.
 * Crucially: Only plan ID and simulation method are passed to the server.
 * No card numbers or CVVs are ever transmitted, logged, or stored.
 */
export async function simulateSubscriptionPayment(
  planId: string
): Promise<SubscriptionResponse<Record<string, unknown>>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('simulate_subscription_payment', {
      p_plan_id: planId,
      p_payment_method: 'simulated_card',
    });

    if (error) {
      if (isRpcNotFoundError(error)) {
        return {
          success: false,
          isRpcUnavailable: true,
          error: 'Payment service is unavailable on the database.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Record<string, unknown> };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error executing payment';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Cancels the user's active subscription (auto-renew turned off).
 * Access remains active until current period end.
 */
export async function cancelSubscription(): Promise<SubscriptionResponse<Record<string, unknown>>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('cancel_subscription');

    if (error) {
      if (isRpcNotFoundError(error)) {
        return {
          success: false,
          isRpcUnavailable: true,
          error: 'Cancellation service is temporarily unavailable on the database.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Record<string, unknown> };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error cancelling subscription';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Renews an active or expired subscription for another billing period.
 */
export async function renewSubscription(): Promise<SubscriptionResponse<Record<string, unknown>>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('renew_subscription');

    if (error) {
      if (isRpcNotFoundError(error)) {
        return {
          success: false,
          isRpcUnavailable: true,
          error: 'Renewal service is temporarily unavailable on the database.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Record<string, unknown> };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error renewing subscription';
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Updates the user's auto-renewal setting.
 */
export async function setSubscriptionAutoRenew(
  autoRenew: boolean
): Promise<SubscriptionResponse<Record<string, unknown>>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc('set_subscription_auto_renew', {
      p_auto_renew: autoRenew,
    });

    if (error) {
      if (isRpcNotFoundError(error)) {
        return {
          success: false,
          isRpcUnavailable: true,
          error: 'Auto-renewal toggle is temporarily unavailable on the database.',
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as Record<string, unknown> };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error setting auto-renew';
    return {
      success: false,
      error: message,
    };
  }
}
