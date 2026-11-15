'use client';

import React, { useState } from 'react';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
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
    <div className="relative min-h-screen w-full flex overflow-hidden bg-[#FAF8F5]">
      {/* Full-bleed background image across entire page */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/images/auth-background.jpg"
          alt="ShelfSafe Background"
          fill
          priority
          className="object-cover object-center select-none"
        />
      </div>

      {/* Left empty spacer to let background illustration & headline show through */}
      <div className="hidden lg:block lg:w-[52%] xl:w-[54%] shrink-0 relative z-10" />

      {/* Right Form Panel aligned transparently over the cream section */}
      <div className="w-full lg:w-[48%] xl:w-[46%] min-h-screen flex items-center justify-center p-6 sm:p-12 md:p-16 relative z-10 bg-transparent">
        <div className="w-full max-w-[440px]">
          {/* Mobile Logo Only (shown on small screens where left artwork is hidden) */}
          <div className="lg:hidden flex justify-center mb-8">
            <Image
              src="/images/shelfsafe-logo.jpg?v=20261116"
              alt="ShelfSafe"
              width={72}
              height={72}
              className="rounded-2xl shadow-sm object-cover"
              unoptimized
            />
          </div>

          {/* Form Header */}
          <div className="mb-8">
            <h1 className="text-4xl sm:text-5xl font-black text-[#181413] tracking-tight">
              Sign In
            </h1>
            <p className="text-base sm:text-lg text-[#554e42] mt-2 font-medium">
              Welcome back to ShelfSafe
            </p>
          </div>

          {/* Alert notifications */}
          {infoMessage && (
            <div className="mb-5 p-4 bg-amber-50/90 border border-amber-200 text-amber-800 text-sm rounded-xl font-medium backdrop-blur-xs">
              {infoMessage}
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 bg-red-50/90 border border-red-200 text-red-700 text-sm rounded-xl font-medium backdrop-blur-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                className="block text-sm sm:text-base font-bold text-[#181413] mb-2"
                htmlFor="email"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoCapitalize="none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-13 sm:h-14 px-4 bg-white/95 border border-[#dfd7c2] rounded-xl text-base text-[#181413] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#207429] focus:border-transparent transition shadow-xs"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label
                className="block text-sm sm:text-base font-bold text-[#181413] mb-2"
                htmlFor="password"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-13 sm:h-14 px-4 pr-12 bg-white/95 border border-[#dfd7c2] rounded-xl text-base text-[#181413] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#207429] focus:border-transparent transition shadow-xs"
                  placeholder="Enter your password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none p-1 cursor-pointer"
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

              <div className="flex justify-end mt-2.5">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-semibold text-[#207429] hover:underline focus:outline-none cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-13 sm:h-14 bg-[#207429] hover:bg-[#185e21] text-white font-bold rounded-xl text-base sm:text-lg shadow-sm hover:shadow transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

          <div className="mt-8 text-center">
            <p className="text-sm sm:text-base text-[#554e42]">
              Don&apos;t have an account?{' '}
              <Link
                href="/sign-up"
                className="font-bold text-[#207429] hover:underline ml-1"
              >
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
