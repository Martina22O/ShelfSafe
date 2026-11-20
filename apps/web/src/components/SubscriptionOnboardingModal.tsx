'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Sparkles,
  Package,
  Camera,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  startFreeTrial,
  completeSubscriptionOnboarding,
  SUBSCRIPTION_PLANS,
} from '../lib/subscription';

interface SubscriptionOnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export function SubscriptionOnboardingModal({
  isOpen,
  onComplete,
}: SubscriptionOnboardingModalProps) {
  const [loadingTrial, setLoadingTrial] = useState(false);
  const [loadingSkip, setLoadingSkip] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewNotice, setPreviewNotice] = useState<string | null>(null);

  const isBusy = loadingTrial || loadingSkip;

  const handleSkip = useCallback(async () => {
    if (isBusy) return;
    setErrorMessage(null);
    setLoadingSkip(true);

    try {
      await completeSubscriptionOnboarding('skip');
    } catch {
      // Ignore network errors on skip
    } finally {
      setLoadingSkip(false);
      onComplete();
    }
  }, [isBusy, onComplete]);

  // Handle escape key to skip/close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBusy) {
        void handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isBusy, handleSkip]);

  if (!isOpen) return null;

  const handleStartTrial = async () => {
    if (isBusy) return;
    setErrorMessage(null);
    setPreviewNotice(null);
    setLoadingTrial(true);

    try {
      const result = await startFreeTrial();

      if (result.isRpcUnavailable) {
        setPreviewNotice(
          'Subscription database migrations are currently in local preview. Continuing to dashboard with full preview access.'
        );
        setTimeout(() => {
          onComplete();
        }, 1200);
        return;
      }

      if (!result.success) {
        setErrorMessage(result.error || 'Could not start free trial.');
        setLoadingTrial(false);
        return;
      }

      // Success
      onComplete();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setErrorMessage(message);
      setLoadingTrial(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-modal-title"
      className="fixed inset-0 z-50 overflow-y-auto flex bg-[#FBF9F2]/95 backdrop-blur-sm animate-fade-in"
    >
      {/* Background artwork matching web sign-in */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40 lg:opacity-70">
        <Image
          src="/images/web-bg.png?v=hd"
          alt="ShelfSafe Artwork"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-left lg:object-center select-none"
        />
      </div>

      {/* Desktop Left Spacer letting background branding show through */}
      <div className="hidden lg:block lg:w-[48%] xl:w-[50%] shrink-0 relative z-10 pointer-events-none" />

      {/* Right Form/Modal Panel matching SignIn form alignment */}
      <div className="w-full lg:w-[52%] xl:w-[50%] min-h-screen flex items-center justify-center lg:justify-start lg:pl-[1.5%] xl:pl-[2%] p-4 sm:p-6 md:p-10 relative z-10">
        <div className="w-full max-w-[520px] bg-[#FAF9F4]/98 rounded-[28px] shadow-[0_20px_60px_rgba(20,45,25,0.14)] border border-white/90 p-6 sm:p-8 relative">
          {/* Close (X) button — equivalent to skipping */}
          <button
            type="button"
            onClick={handleSkip}
            disabled={isBusy}
            aria-label="Skip onboarding and close"
            title="Skip onboarding"
            className="absolute top-5 right-5 p-2 rounded-full text-[#7a7469] hover:text-[#181413] hover:bg-black/5 transition-colors disabled:opacity-40"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Trial Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E8F5E9] border border-[#C8E6C9] text-xs font-bold text-[#185E21] mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>14-DAY PREMIUM FREE TRIAL</span>
          </div>

          {/* Heading & Subtitle */}
          <h1
            id="onboarding-modal-title"
            className="text-2xl sm:text-3xl font-extrabold text-[#144721] tracking-tight"
          >
            Unlock ShelfSafe Premium
          </h1>
          <p className="text-xs sm:text-sm text-[#524C40] mt-1 font-medium leading-relaxed">
            Experience the full power of ShelfSafe with our compliments. No credit card required.
          </p>

          {/* Error & Preview Alerts */}
          {errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {previewNotice && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-start gap-2.5 text-xs text-green-800">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span>{previewNotice}</span>
            </div>
          )}

          {/* Feature Highlights Grid */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[#F4F1EA]/70 p-3.5 rounded-2xl border border-[#ECE3D2]/80">
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white border border-[#E6E0D2] flex items-center justify-center shrink-0 text-[#207429]">
                <Package className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#181413]">Unlimited Products</p>
                <p className="text-[11px] text-[#7a7469] leading-tight">Free is capped at 20 products.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white border border-[#E6E0D2] flex items-center justify-center shrink-0 text-[#207429]">
                <Camera className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#181413]">Unlimited Photos</p>
                <p className="text-[11px] text-[#7a7469] leading-tight">Free is capped at 5 photos.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white border border-[#E6E0D2] flex items-center justify-center shrink-0 text-[#207429]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#181413]">Full Sales History</p>
                <p className="text-[11px] text-[#7a7469] leading-tight">Beyond the 7-day Free window.</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white border border-[#E6E0D2] flex items-center justify-center shrink-0 text-[#207429]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#181413]">Safe Downgrading</p>
                <p className="text-[11px] text-[#7a7469] leading-tight">Your data is never deleted.</p>
              </div>
            </div>
          </div>

          {/* Four Plans Preview */}
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#181413] uppercase tracking-wider">
                Available Subscription Plans
              </span>
              <span className="text-[11px] font-medium text-[#7a7469]">After 14-day trial</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={`p-2.5 rounded-xl border relative transition-all ${
                    plan.isPopular
                      ? 'bg-[#F3F9EE] border-[#B9DF9D]'
                      : 'bg-white border-[#EAE6DC]'
                  }`}
                >
                  {plan.isPopular && (
                    <span className="absolute -top-2 right-2 bg-[#207429] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-2xs">
                      BEST VALUE
                    </span>
                  )}
                  <p className="text-xs font-bold text-[#181413]">{plan.name.replace(' Premium', '')}</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-sm font-extrabold text-[#207429]">₱{plan.pricePhp}</span>
                    <span className="text-[10px] text-[#7a7469]">
                      /{plan.billingCycle === 'monthly' ? 'mo' : plan.billingCycle === 'quarterly' ? '3 mos' : plan.billingCycle === 'semiannual' ? '6 mos' : 'yr'}
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold text-[#D97706] mt-0.5">
                    {plan.discountLabel || 'Standard rate'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="mt-6 space-y-2.5">
            <button
              type="button"
              onClick={handleStartTrial}
              disabled={isBusy}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-[#207429] text-white text-sm font-bold shadow-md hover:bg-[#185E21] active:scale-[0.99] transition-all disabled:opacity-60"
            >
              {loadingTrial ? (
                <span>Activating Trial...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start 14-Day Free Trial</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSkip}
              disabled={isBusy}
              className="w-full py-2.5 text-center text-xs font-semibold text-[#7a7469] hover:text-[#181413] transition-colors disabled:opacity-50"
            >
              {loadingSkip ? 'Loading...' : 'Continue with Free / Skip for Now'}
            </button>

            <p className="text-[11px] text-[#999182] text-center font-normal leading-tight pt-1">
              No credit card required. Cancel anytime or continue on the Free plan after 14 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
