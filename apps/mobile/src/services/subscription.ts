/**
 * Service: subscription.ts
 * Manages ShelfSafe subscription plans, real-time entitlement checks,
 * 14-day free trial activations, onboarding completion, and
 * server-validated payment simulations for the mobile client.
 */
import { supabase } from './supabase';

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

export const TEST_CARDS: Array<{
  label: string;
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
}> = [
  {
    label: 'Visa',
    cardNumber: '4242 4242 4242 4242',
    expiryDate: '12/28',
    cvv: '123',
    cardholderName: 'Juan Dela Cruz',
  },
  {
    label: 'Mastercard',
    cardNumber: '5555 5555 5555 4444',
    expiryDate: '06/29',
    cvv: '888',
    cardholderName: 'Maria Santos',
  },
];

/**
 * Validates card inputs on the client before proceeding with checkout.
 * Real card numbers or CVVs are never accepted or stored.
 */
export function validateTestCard(details: TestCardDetails): { isValid: boolean; error?: string } {
  if (!details.cardholderName || details.cardholderName.trim().length < 2) {
    return { isValid: false, error: 'Please enter a valid cardholder name.' };
  }

  const cleanNum = details.cardNumber.replace(/\s+/g, '');
  if (!/^\d{16}$/.test(cleanNum)) {
    return { isValid: false, error: 'Please enter a valid 16-digit card number.' };
  }

  const expMatch = details.expiryDate.match(/^(\d{2})\/(\d{2})$/);
  if (!expMatch) {
    return { isValid: false, error: 'Expiration date must be in MM/YY format.' };
  }

  const month = parseInt(expMatch[1], 10);
  const year = parseInt(`20${expMatch[2]}`, 10);
  if (month < 1 || month > 12) {
    return { isValid: false, error: 'Invalid expiration month (01-12).' };
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  if (year < currentYear || (year === currentYear && month < currentMonth)) {
    return { isValid: false, error: 'Card has expired. Enter a future date.' };
  }

  const cleanCvv = details.cvv.trim();
  if (!/^\d{3,4}$/.test(cleanCvv)) {
    return { isValid: false, error: 'CVV must be 3 or 4 digits.' };
  }

  return { isValid: true };
}

/**
 * Helper to determine if an error is due to an undeployed or missing database RPC.
 */
function isRpcNotFoundError(error: any): boolean {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
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
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error fetching subscription',
    };
  }
}

/**
 * Starts the one-time 14-day Premium trial for the current authenticated user.
 */
export async function startFreeTrial(): Promise<SubscriptionResponse<any>> {
  try {
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

    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error starting free trial',
    };
  }
}

/**
 * Records that the user has completed or skipped the initial subscription onboarding.
 * Preserves trial eligibility if the user chooses to continue with Free.
 */
export async function completeSubscriptionOnboarding(
  choice: string = 'skip'
): Promise<SubscriptionResponse<void>> {
  try {
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
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error recording onboarding choice',
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
): Promise<SubscriptionResponse<any>> {
  try {
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

    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error executing payment',
    };
  }
}

/**
 * Cancels the user's active subscription (auto-renew turned off).
 * Access remains active until current period end.
 */
export async function cancelSubscription(): Promise<SubscriptionResponse<any>> {
  try {
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

    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error cancelling subscription',
    };
  }
}

/**
 * Renews an active or expired subscription for another billing period.
 */
export async function renewSubscription(): Promise<SubscriptionResponse<any>> {
  try {
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

    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error renewing subscription',
    };
  }
}

/**
 * Updates the user's auto-renewal setting.
 */
export async function setSubscriptionAutoRenew(
  autoRenew: boolean
): Promise<SubscriptionResponse<any>> {
  try {
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

    return { success: true, data };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error setting auto-renew',
    };
  }
}
