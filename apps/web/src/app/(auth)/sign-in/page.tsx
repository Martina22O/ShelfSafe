'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import { formatErrorMessage } from '../../../lib/error';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isSuccessMessage, setIsSuccessMessage] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('registered') === 'true') {
        const timer = setTimeout(() => {
          setIsSuccessMessage(true);
          if (params.get('confirm') === 'pending') {
            setInfoMessage('Account created! Please check your email to confirm your account before signing in.');
          } else {
            setInfoMessage('Account created successfully! Please sign in to continue.');
          }
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setIsSuccessMessage(false);
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        if (/invalid login credentials/i.test(signInError.message)) {
          setError('Invalid email or password');
        } else if (/email not confirmed/i.test(signInError.message)) {
          setError(
            'Please confirm your email address before signing in. Check your inbox for the confirmation email.'
          );
        } else {
          setError(signInError.message || formatErrorMessage(signInError));
        }
        setLoading(false);
        return;
      }

      // Navigate to dashboard
      router.push('/dashboard');
      router.refresh();

      // Reliable hard redirect fallback if client-side navigation stalls
      setTimeout(() => {
        if (typeof window !== 'undefined' && window.location.pathname !== '/dashboard') {
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = '/dashboard';
        }
      }, 400);
    } catch (err: unknown) {
      setError(formatErrorMessage(err));
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setError(null);
    setInfoMessage('Password reset by email is not available yet.');
  };

  return (
    <div className="relative min-h-screen w-full flex overflow-y-auto bg-[#FBF9F2]">
      {/* Full-bleed HD background image across entire page */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <Image
          src="/images/web-bg.png?v=hd"
          alt="ShelfSafe Background"
          fill
          priority
          unoptimized
          sizes="100vw"
          className="object-cover object-left lg:object-center select-none"
        />
      </div>

      {/* Left empty spacer to let background logo & branding show through on desktop */}
      <div className="hidden lg:block lg:w-[48%] xl:w-[50%] shrink-0 relative z-10 pointer-events-none select-none" />

      {/* Right Form Panel matching the exact position and dimensions in the reference */}
      <div className="w-full lg:w-[52%] xl:w-[50%] min-h-screen flex flex-col lg:flex-row items-center justify-center lg:justify-start lg:pl-[1.5%] xl:pl-[2%] p-4 sm:p-8 md:p-12 relative z-10 bg-transparent">
        {/* Mobile Logo & Wordmark (shown on small screens where left artwork is off-center) */}
        <div className="lg:hidden flex justify-center mb-6">
          <Image
            src="/shelfsafe-logo.png"
            alt="ShelfSafe"
            width={165}
            height={152}
            unoptimized
            className="object-contain"
            priority
          />
        </div>

        {/* Form Card matching webnew-signin-reference.jpg */}
        <div className="w-full max-w-[445px] lg:w-[43vw] lg:max-w-[540px] bg-[#FAF9F4]/96 rounded-[30px] shadow-[0_14px_44px_rgba(20,45,25,0.07)] border border-white/85 px-7 py-8 sm:px-10 sm:py-10">
          {/* Form Header */}
          <div className="mb-6">
            <h1 className="text-[32px] sm:text-[38px] leading-tight font-extrabold text-[#144721] tracking-tight">
              Sign In
            </h1>
            <p className="text-[15px] sm:text-[17px] text-[#3F453E] mt-1 font-medium">
              Welcome back to ShelfSafe!
            </p>
            <svg
              className="w-24 h-3 mt-1 text-[#2E8B3C]"
              viewBox="0 0 110 12"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M2 10C34 2.5 74 1.5 108 5.5C74 4.5 34 5.5 2 10Z"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Alert notifications */}
          {infoMessage && (
            <div
              className={`mb-5 p-3.5 border text-sm rounded-xl font-medium flex items-start gap-2.5 ${
                isSuccessMessage
                  ? 'bg-green-50/95 border-green-200 text-green-800'
                  : 'bg-amber-50/95 border-amber-200 text-amber-800'
              }`}
            >
              {isSuccessMessage && (
                <svg
                  className="w-5 h-5 text-green-600 shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              <span>{infoMessage}</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-red-50/95 border border-red-200 text-red-700 text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                className="flex items-center gap-2.5 text-[15px] font-bold text-[#1B5728] mb-2 pl-1"
                htmlFor="email"
              >
                <svg
                  className="w-[18px] h-[18px] text-[#2B8A38] shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4.25-8 5-8-5V6l8 5 8-5v2.25z" />
                </svg>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 sm:h-[50px] px-5 bg-[#FBFBF9] border border-[#D8DDD5] rounded-full text-[15px] text-[#181413] placeholder-[#8C948B] focus:outline-none focus:ring-2 focus:ring-[#2E8B3C] focus:border-transparent transition"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label
                className="flex items-center gap-2.5 text-[15px] font-bold text-[#1B5728] mb-2 pl-1"
                htmlFor="password"
              >
                <svg
                  className="w-[18px] h-[18px] text-[#2B8A38] shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm3 11c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                </svg>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 sm:h-[50px] px-5 pr-12 bg-[#FBFBF9] border border-[#D8DDD5] rounded-full text-[15px] text-[#181413] placeholder-[#8C948B] focus:outline-none focus:ring-2 focus:ring-[#2E8B3C] focus:border-transparent transition"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#747B73] hover:text-[#3F453E] focus:outline-none p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.8}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              <div className="flex justify-end mt-2 pr-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs sm:text-[13px] font-semibold text-[#2B8A38] hover:underline focus:outline-none cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div className="pt-1">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-[52px] bg-[#2E8B3C] hover:bg-[#236E2E] text-white font-bold rounded-full text-base sm:text-[18px] shadow-[0_6px_16px_rgba(46,139,60,0.28)] hover:shadow-[0_8px_20px_rgba(46,139,60,0.35)] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2.5"
              >
                <span>{loading ? 'Signing in...' : 'Sign In'}</span>
                {!loading && (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.3}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 12h14m-6-6 6 6-6 6"
                    />
                  </svg>
                )}
              </button>
            </div>
          </form>

          <div className="mt-7 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E1E3DC]" />
            <p className="text-xs sm:text-[13px] text-[#3F453E] whitespace-nowrap">
              Don&apos;t have an account?{' '}
              <Link
                href="/sign-up"
                className="font-bold text-[#2B8A38] hover:underline ml-1"
              >
                Sign Up
              </Link>
            </p>
            <div className="h-px flex-1 bg-[#E1E3DC]" />
          </div>
        </div>
      </div>
    </div>
  );
}
