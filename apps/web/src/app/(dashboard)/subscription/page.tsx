'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  Package,
  Camera,
  TrendingUp,
  Clock,
  ShieldCheck,
  AlertCircle,
  Check,
  RefreshCw,
  CreditCard,
  X,
  RotateCcw,
  Ban,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  getUserSubscription,
  startFreeTrial,
  simulateSubscriptionPayment,
  cancelSubscription,
  renewSubscription,
  setSubscriptionAutoRenew,
  validateTestCard,
  TEST_CARDS,
  SUBSCRIPTION_PLANS,
  UserSubscription,
  SubscriptionPlan,
  TestCardDetails,
} from '../../../lib/subscription';
import { useRealtime } from '../../../lib/realtime';

export default function SubscriptionPage() {
  const { dataVersion } = useRealtime();
  const [loading, setLoading] = useState(true);
  const [activatingTrial, setActivatingTrial] = useState(false);
  const [simulatingPayment, setSimulatingPayment] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [selectedPlanForCheckout, setSelectedPlanForCheckout] = useState<SubscriptionPlan | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Card Form State
  const [cardDetails, setCardDetails] = useState<TestCardDetails>({
    cardholderName: 'Juan Dela Cruz',
    cardNumber: '4242 4242 4242 4242',
    expiryDate: '12/28',
    cvv: '123',
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSubscription() {
      try {
        const res = await getUserSubscription();
        if (cancelled) return;

        if (res.success && res.data) {
          setSubscription(res.data);
        }
      } catch {
        // Silently catch on initial load
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSubscription();

    return () => {
      cancelled = true;
    };
  }, []);

  // Silent background refresh when subscription or store data changes on another device
  useEffect(() => {
    if (dataVersion === 0) return;
    if (activatingTrial || simulatingPayment || processingAction) return;

    let cancelled = false;
    async function silentRefreshSubscription() {
      try {
        const res = await getUserSubscription();
        if (!cancelled && res.success && res.data) {
          setSubscription(res.data);
        }
      } catch {
        // Silently ignore background refresh error
      }
    }

    void silentRefreshSubscription();
    return () => {
      cancelled = true;
    };
  }, [dataVersion, activatingTrial, simulatingPayment, processingAction]);

  const handleManualRefresh = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const res = await getUserSubscription();
      if (res.success && res.data) {
        setSubscription(res.data);
      }
    } catch {
      // Safely handle errors
    } finally {
      setLoading(false);
    }
  };

  const handleActivateTrial = async () => {
    if (activatingTrial) return;
    setActivatingTrial(true);
    setStatusMessage(null);

    try {
      const res = await startFreeTrial();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: '14-Day Free Trial activated successfully! Enjoy unlimited products and full analytics.',
        });
        await handleManualRefresh();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to activate free trial.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error activating free trial.';
      setStatusMessage({
        type: 'error',
        text: message,
      });
    } finally {
      setActivatingTrial(false);
    }
  };

  const handleOpenCheckout = (plan: SubscriptionPlan) => {
    setSelectedPlanForCheckout(plan);
    setFormError(null);
    setCardDetails({
      cardholderName: TEST_CARDS[0].cardholderName,
      cardNumber: TEST_CARDS[0].cardNumber,
      expiryDate: TEST_CARDS[0].expiryDate,
      cvv: TEST_CARDS[0].cvv,
    });
  };

  const handleSelectCard = (testCard: typeof TEST_CARDS[0]) => {
    setCardDetails({
      cardholderName: testCard.cardholderName,
      cardNumber: testCard.cardNumber,
      expiryDate: testCard.expiryDate,
      cvv: testCard.cvv,
    });
    setFormError(null);
  };

  const handleFormatCardNumber = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 16);
    const parts = raw.match(/[\s\S]{1,4}/g) || [];
    setCardDetails((prev) => ({ ...prev, cardNumber: parts.join(' ') }));
  };

  const handleFormatExpiry = (value: string) => {
    const raw = value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      setCardDetails((prev) => ({ ...prev, expiryDate: `${raw.slice(0, 2)}/${raw.slice(2)}` }));
    } else {
      setCardDetails((prev) => ({ ...prev, expiryDate: raw }));
    }
  };

  const handleConfirmSubscription = async () => {
    if (!selectedPlanForCheckout || simulatingPayment) return;

    const validation = validateTestCard(cardDetails);
    if (!validation.isValid) {
      setFormError(validation.error || 'Please check your card details.');
      return;
    }

    setSimulatingPayment(true);
    setFormError(null);

    try {
      const res = await simulateSubscriptionPayment(selectedPlanForCheckout.id);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Payment Successful! You are now subscribed to ${selectedPlanForCheckout.name}.`,
        });
        setSelectedPlanForCheckout(null);
        await handleManualRefresh();
      } else {
        setFormError(res.error || 'Failed to process payment.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unexpected error during checkout.';
      setFormError(message);
    } finally {
      setSimulatingPayment(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    if (processingAction || !subscription) return;
    setProcessingAction(true);
    setStatusMessage(null);

    const targetVal = !(subscription.auto_renew ?? true);

    try {
      const res = await setSubscriptionAutoRenew(targetVal);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: targetVal
            ? 'Auto-renewal has been enabled.'
            : 'Auto-renewal has been disabled. Your plan will expire at the end of the current billing cycle.',
        });
        await handleManualRefresh();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to update auto-renewal setting.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error updating auto-renew setting.';
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (processingAction) return;
    setProcessingAction(true);
    setStatusMessage(null);

    try {
      const res = await cancelSubscription();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Subscription cancelled. Auto-renewal turned off. You will retain Premium access until your current period ends.',
        });
        setShowCancelModal(false);
        await handleManualRefresh();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to cancel subscription.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error cancelling subscription.';
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setProcessingAction(false);
    }
  };

  const handleRenewNow = async () => {
    if (processingAction) return;
    setProcessingAction(true);
    setStatusMessage(null);

    try {
      const res = await renewSubscription();
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Subscription renewed successfully! Billing period extended and auto-renewal enabled.',
        });
        await handleManualRefresh();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error || 'Failed to renew subscription.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error renewing subscription.';
      setStatusMessage({ type: 'error', text: message });
    } finally {
      setProcessingAction(false);
    }
  };

  const isTrial = subscription?.status === 'trialing';
  const isPremium = subscription?.is_premium;
  const isEligibleForTrial = subscription?.status === 'free' && subscription?.trial_eligible;
  const autoRenewEnabled = subscription?.auto_renew ?? true;

  const formatDate = (isoString: string | null | undefined) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6 w-full">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-[#ece3d2]/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black text-[#181413] tracking-tight">
              Subscription &amp; Plans
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#f4ffe1] text-[#207429] border border-[#207429]/20">
              Billing &amp; Entitlement
            </span>
          </div>
          <p className="text-xs text-[#7a7469] mt-1">
            Manage your store membership tier, review feature entitlements, and view subscription plans.
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#ece3d2] bg-white text-xs font-bold text-[#4a443a] hover:bg-[#fef9f0] hover:text-[#181413] transition-colors shadow-2xs self-start md:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs sm:text-sm ${
            statusMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Current Subscription Status Card */}
      <div className="bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-[#ece3d2]/70">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#7a7469] block mb-1">
              Current Membership Status
            </span>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-[#181413]">
                {isTrial
                  ? '14-Day Premium Free Trial'
                  : isPremium
                  ? subscription?.plan_name || 'Active Premium Membership'
                  : subscription?.status === 'expired'
                  ? 'Subscription Expired'
                  : 'ShelfSafe Free Plan'}
              </h2>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  isTrial
                    ? 'bg-[#E8F5E9] text-[#185E21] border-[#C8E6C9]'
                    : isPremium
                    ? 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]'
                    : subscription?.status === 'expired'
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-[#F3F4F6] text-[#4B5563] border-[#E5E7EB]'
                }`}
              >
                {isTrial ? 'Trial Active' : isPremium ? 'Premium Active' : subscription?.status === 'expired' ? 'Expired' : 'Free Tier'}
              </span>
            </div>

            {isPremium && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#524C40]">
                <span>
                  <strong>Period:</strong> {formatDate(subscription?.current_period_start)} – {formatDate(subscription?.current_period_end)}
                </span>
                <span>•</span>
                <span>
                  <strong>Days Remaining:</strong> {subscription?.days_remaining ?? 0} days
                </span>
                <span>•</span>
                <span className={`inline-flex items-center gap-1 font-bold ${autoRenewEnabled ? 'text-[#207429]' : 'text-[#D97706]'}`}>
                  {autoRenewEnabled ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Auto-Renew Enabled
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3.5 h-3.5" />
                      Cancels at Period End
                    </>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons for Active / Trial / Free */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {isTrial ? (
              <div className="flex items-center gap-2 bg-[#F3F9EE] border border-[#D4ECC6] px-4 py-2 rounded-xl text-[#207429]">
                <Clock className="w-4 h-4 shrink-0" />
                <div className="text-xs">
                  <span className="font-extrabold">{subscription?.days_remaining ?? 14} days</span> remaining
                  <span className="block text-[11px] text-[#524C40]">Ends on {formatDate(subscription?.trial_ends_at)}</span>
                </div>
              </div>
            ) : isPremium ? (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleRenewNow}
                  disabled={processingAction}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#207429] text-white text-xs font-bold hover:bg-[#185e21] shadow-2xs transition-colors disabled:opacity-50"
                  title="Extend your billing period"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Renew Plan
                </button>

                <button
                  type="button"
                  onClick={handleToggleAutoRenew}
                  disabled={processingAction}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#ece3d2] bg-white text-xs font-bold text-[#181413] hover:bg-[#FAF8F5] transition-colors disabled:opacity-50"
                >
                  {autoRenewEnabled ? <CheckSquare className="w-3.5 h-3.5 text-[#207429]" /> : <Square className="w-3.5 h-3.5 text-[#7a7469]" />}
                  Auto-Renew
                </button>

                {autoRenewEnabled && (
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    disabled={processingAction}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    Cancel Plan
                  </button>
                )}
              </div>
            ) : isEligibleForTrial ? (
              <button
                type="button"
                onClick={handleActivateTrial}
                disabled={activatingTrial}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#207429] text-white text-xs font-bold hover:bg-[#185e21] shadow-xs transition-colors disabled:opacity-60"
              >
                <Sparkles className="w-4 h-4" />
                <span>{activatingTrial ? 'Activating...' : 'Start 14-Day Free Trial'}</span>
              </button>
            ) : (
              <span className="text-xs text-[#7a7469] font-medium bg-[#FAF8F5] px-3 py-1.5 rounded-lg border border-[#ece3d2]">
                Trial already claimed
              </span>
            )}
          </div>
        </div>

        {/* Plan Feature Summary & Quota Status */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#ECE3D2]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#181413]">
              <Package className="w-4 h-4 text-[#207429]" />
              <span>Active Products</span>
            </div>
            <p className="text-lg font-black text-[#181413] mt-1">
              {isPremium ? 'Unlimited' : '20 SKUs Max'}
            </p>
            <p className="text-[11px] text-[#7a7469] mt-0.5">
              {isPremium ? 'No catalog restrictions' : 'Standard store quota'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#ECE3D2]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#181413]">
              <Camera className="w-4 h-4 text-[#207429]" />
              <span>Product Photos</span>
            </div>
            <p className="text-lg font-black text-[#181413] mt-1">
              {isPremium ? 'Unlimited' : '5 Photos Max'}
            </p>
            <p className="text-[11px] text-[#7a7469] mt-0.5">
              {isPremium ? 'Visual catalog for all items' : 'Essential visual items only'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF8F5] border border-[#ECE3D2]">
            <div className="flex items-center gap-2 text-xs font-bold text-[#181413]">
              <TrendingUp className="w-4 h-4 text-[#207429]" />
              <span>Sales History & Trends</span>
            </div>
            <p className="text-lg font-black text-[#181413] mt-1">
              {isPremium ? 'Full Lifetime' : '7 Days'}
            </p>
            <p className="text-[11px] text-[#7a7469] mt-0.5">
              {isPremium ? 'Complete business analytics' : 'Recent sales review'}
            </p>
          </div>
        </div>
      </div>

      {/* Available Subscription Plans Grid */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#7a7469]">
              Available Subscription Plans
            </h2>
            <p className="text-xs text-[#7a7469]">
              Choose a plan that fits your business size. Flexible billing for growing stores.
            </p>
          </div>
          <span className="text-[11px] font-semibold text-[#207429] bg-[#f4ffe1] px-2.5 py-1 rounded-full border border-[#207429]/20 self-start sm:self-auto">
            All prices in Philippine Peso (PHP)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const isCurrentPlan = subscription?.is_premium && subscription?.plan_id === plan.id;
            return (
              <div
                key={plan.id}
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between relative shadow-2xs hover:shadow-md transition-shadow ${
                  isCurrentPlan
                    ? 'border-[#207429] ring-2 ring-[#207429]'
                    : plan.isPopular
                    ? 'border-[#B9DF9D] ring-2 ring-[#207429]/20'
                    : 'border-[#ece3d2]'
                }`}
              >
                {isCurrentPlan ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#207429] text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-xs">
                    ACTIVE PLAN
                  </div>
                ) : plan.isPopular ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#207429] text-white text-[10px] font-extrabold px-3 py-0.5 rounded-full shadow-xs">
                    BEST VALUE
                  </div>
                ) : null}

                <div>
                  <h3 className="font-bold text-[#181413] text-base">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mt-2">
                    <span className="text-3xl font-black text-[#207429]">₱{plan.pricePhp}</span>
                    <span className="text-xs font-medium text-[#7a7469]">
                      /{plan.billingCycle === 'monthly' ? 'month' : plan.billingCycle === 'quarterly' ? '3 mos' : plan.billingCycle === 'semiannual' ? '6 mos' : 'year'}
                    </span>
                  </div>

                  {plan.discountLabel ? (
                    <span className="inline-block mt-1 text-[11px] font-bold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-md">
                      {plan.discountLabel}
                    </span>
                  ) : (
                    <span className="inline-block mt-1 text-[11px] font-medium text-[#7a7469]">
                      Standard monthly rate
                    </span>
                  )}

                  <ul className="mt-4 space-y-2 text-xs text-[#524C40] border-t border-[#ece3d2]/70 pt-4">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#207429] shrink-0" />
                      <span>Unlimited active products</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#207429] shrink-0" />
                      <span>Unlimited product photos</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#207429] shrink-0" />
                      <span>Full sales history & analytics</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-[#207429] shrink-0" />
                      <span>Priority stock & expiry alerts</span>
                    </li>
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenCheckout(plan)}
                  className={`mt-6 w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-colors ${
                    isCurrentPlan
                      ? 'bg-[#FAF8F5] border border-[#207429] text-[#207429] hover:bg-[#F3F0E6]'
                      : plan.isPopular
                      ? 'bg-[#207429] text-white hover:bg-[#185e21] shadow-2xs'
                      : 'bg-[#FAF8F5] border border-[#ece3d2] text-[#181413] hover:bg-[#F3F0E6]'
                  }`}
                >
                  {isCurrentPlan ? 'Current Plan' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feature Comparison Table */}
      <div className="bg-white border border-[#ece3d2] rounded-2xl p-6 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[#7a7469] mb-4">
          Free vs Premium Feature Comparison
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#ece3d2] text-[#7a7469]">
                <th className="py-2.5 pr-4 font-bold uppercase">Feature Capability</th>
                <th className="py-2.5 px-4 font-bold uppercase">Free Plan</th>
                <th className="py-2.5 pl-4 font-bold uppercase text-[#207429]">Premium Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ece3d2]/60 text-[#332E27]">
              <tr>
                <td className="py-3 pr-4 font-semibold">Active Products in Inventory</td>
                <td className="py-3 px-4 text-[#7a7469]">Up to 20 SKUs</td>
                <td className="py-3 pl-4 font-bold text-[#207429]">Unlimited SKUs</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Uploaded Product Photos</td>
                <td className="py-3 px-4 text-[#7a7469]">Up to 5 Photos</td>
                <td className="py-3 pl-4 font-bold text-[#207429]">Unlimited Photos</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Sales History Analytics Window</td>
                <td className="py-3 px-4 text-[#7a7469]">Last 7 Days</td>
                <td className="py-3 pl-4 font-bold text-[#207429]">Full Lifetime Access</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Batch-Level Expiry (FEFO) Deduction</td>
                <td className="py-3 px-4 text-green-700 font-medium">Included</td>
                <td className="py-3 pl-4 text-green-700 font-bold">Included</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Barcode & Camera Scanning</td>
                <td className="py-3 px-4 text-green-700 font-medium">Included</td>
                <td className="py-3 pl-4 text-green-700 font-bold">Included</td>
              </tr>
              <tr>
                <td className="py-3 pr-4 font-semibold">Multi-Device Real-Time Sync</td>
                <td className="py-3 px-4 text-green-700 font-medium">Included</td>
                <td className="py-3 pl-4 text-green-700 font-bold">Included</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Reassurance & Downgrade Safety Card */}
      <div className="bg-[#FAF7EE] border border-[#EFE7DA] rounded-2xl p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-white border border-[#EFE7DA] flex items-center justify-center shrink-0 text-[#207429]">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#181413]">Safe Downgrading Guaranteed</h3>
          <p className="text-xs text-[#524C40] mt-1 leading-relaxed">
            If your 14-day trial concludes or you choose not to renew a subscription, all your existing products, uploaded photos, and sales records remain 100% safe, readable, and sellable. ShelfSafe never deletes your store data upon plan transitions.
          </p>
        </div>
      </div>

      {/* CARD CHECKOUT MODAL */}
      {selectedPlanForCheckout && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#ece3d2] animate-fade-in space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#ece3d2]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#207429]" />
                <h3 className="font-extrabold text-[#181413] text-base">
                  Payment Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlanForCheckout(null)}
                className="text-[#7a7469] hover:text-[#181413] p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-[11px] font-bold text-[#7a7469] uppercase tracking-wider mb-1.5">
                Select Card
              </label>
              <div className="flex flex-wrap gap-2">
                {TEST_CARDS.map((tc) => (
                  <button
                    key={tc.label}
                    type="button"
                    onClick={() => handleSelectCard(tc)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-[#ece3d2] bg-[#FAF8F5] text-[#181413] hover:border-[#207429] hover:bg-[#F3F9EE] transition-colors"
                  >
                    {tc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error Message */}
            {formError && (
              <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Card Form */}
            <div className="space-y-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-[#181413] mb-1">
                  Cardholder Name
                </label>
                <input
                  type="text"
                  value={cardDetails.cardholderName}
                  onChange={(e) => setCardDetails({ ...cardDetails, cardholderName: e.target.value })}
                  placeholder="Juan Dela Cruz"
                  className="w-full text-xs px-3 py-2 border border-[#ece3d2] rounded-xl focus:outline-none focus:border-[#207429] bg-[#FAF8F5]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#181413] mb-1">
                  Card Number
                </label>
                <input
                  type="text"
                  value={cardDetails.cardNumber}
                  onChange={(e) => handleFormatCardNumber(e.target.value)}
                  placeholder="4242 4242 4242 4242"
                  maxLength={19}
                  className="w-full text-xs font-mono px-3 py-2 border border-[#ece3d2] rounded-xl focus:outline-none focus:border-[#207429] bg-[#FAF8F5]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#181413] mb-1">
                    Expiration Date
                  </label>
                  <input
                    type="text"
                    value={cardDetails.expiryDate}
                    onChange={(e) => handleFormatExpiry(e.target.value)}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full text-xs font-mono px-3 py-2 border border-[#ece3d2] rounded-xl focus:outline-none focus:border-[#207429] bg-[#FAF8F5]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#181413] mb-1">
                    CVV
                  </label>
                  <input
                    type="password"
                    value={cardDetails.cvv}
                    onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value.slice(0, 4) })}
                    placeholder="CVV"
                    maxLength={4}
                    className="w-full text-xs font-mono px-3 py-2 border border-[#ece3d2] rounded-xl focus:outline-none focus:border-[#207429] bg-[#FAF8F5]"
                  />
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="bg-[#FAF8F5] border border-[#ece3d2] rounded-xl p-3 space-y-1.5 text-xs">
              <div className="flex justify-between text-[#7a7469]">
                <span>Plan:</span>
                <span className="font-semibold text-[#181413]">{selectedPlanForCheckout.name}</span>
              </div>
              <div className="flex justify-between text-[#7a7469]">
                <span>Billing Period:</span>
                <span className="font-semibold text-[#181413]">{selectedPlanForCheckout.durationDays} Days</span>
              </div>
              <div className="border-t border-[#ece3d2] pt-1.5 flex justify-between font-black text-sm text-[#181413]">
                <span>Total Amount:</span>
                <span className="text-[#207429]">₱{selectedPlanForCheckout.pricePhp}.00</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlanForCheckout(null)}
                  disabled={simulatingPayment}
                  className="px-4 py-2 rounded-xl border border-[#ece3d2] text-xs font-bold text-[#7a7469] hover:bg-[#FAF8F5] transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleConfirmSubscription}
                  disabled={simulatingPayment}
                  className="px-5 py-2.5 rounded-xl bg-[#207429] text-white text-xs font-bold hover:bg-[#185e21] shadow-2xs transition-colors disabled:opacity-60 flex items-center gap-2"
                >
                  {simulatingPayment ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <span>Confirm Subscription</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CANCELLATION CONFIRMATION MODAL */}
      {showCancelModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#ece3d2] animate-fade-in space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Ban className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-[#181413] text-base">Cancel Subscription?</h3>
                <p className="text-xs text-[#7a7469]">Auto-renewal will be disabled.</p>
              </div>
            </div>

            <p className="text-xs text-[#524C40] leading-relaxed">
              If you cancel now, your plan will <strong>not renew</strong> automatically. You will continue to have full Premium access until the end of your billing cycle on{' '}
              <strong>{formatDate(subscription?.current_period_end)}</strong>.
            </p>

            <div className="p-3 bg-[#FAF7EE] border border-[#EFE7DA] rounded-xl text-[11px] text-[#524C40]">
              <span className="font-bold text-[#181413]">Safe Downgrade:</span> When your billing cycle concludes, your store transitions to the Free tier. None of your products, photos, or sales records will ever be removed.
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                disabled={processingAction}
                className="px-4 py-2 rounded-xl border border-[#ece3d2] text-xs font-bold text-[#7a7469] hover:bg-[#FAF8F5]"
              >
                Keep Subscription
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={processingAction}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {processingAction ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
