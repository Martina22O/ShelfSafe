'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import { formatErrorMessage } from '../../../lib/error';

export default function SignUpPage() {
  const [name, setName] = useState('');
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

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Name is required');
      return;
    }

    const trimmedEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            name: trimmedName,
          },
        },
      });

      if (signUpError) {
        setError(formatErrorMessage(signUpError));
        setLoading(false);
        return;
      }

      // Check if user already exists (identities array is empty in Supabase when account exists and email enumeration protection is on)
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setError('An account with this email already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      // If no session is returned, user confirmation email was dispatched
      if (!data.session) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/sign-in?registered=true&confirm=pending';
        return;
      }

      // If Supabase issued a session automatically, safely sign out so newly registered user explicitly signs in
      await supabase.auth.signOut();

      // Redirect to sign-in with registration success query flag
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/sign-in?registered=true';
    } catch (err: unknown) {
      setError(formatErrorMessage(err));
      setLoading(false);
    }
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
        <div className="w-full max-w-[445px] lg:w-[43vw] lg:max-w-[540px] bg-[#FAF9F4]/96 rounded-[30px] shadow-[0_14px_44px_rgba(20,45,25,0.07)] border border-white/85 px-7 py-8 sm:px-10 sm:py-9">
          {/* Form Header */}
          <div className="mb-5">
            <h1 className="text-[30px] sm:text-[36px] leading-tight font-extrabold text-[#144721] tracking-tight">
              Create an Account
            </h1>
            <p className="text-[15px] sm:text-[17px] text-[#3F453E] mt-1 font-medium">
              Start keeping your shelves in check!
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

          {infoMessage && (
            <div className="mb-5 p-3.5 bg-green-50/95 border border-green-200 text-green-800 text-sm rounded-xl font-medium">
              {infoMessage}
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-red-50/95 border border-red-200 text-red-700 text-sm rounded-xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                className="flex items-center gap-2.5 text-[15px] font-bold text-[#1B5728] mb-2 pl-1"
                htmlFor="name"
              >
                <svg
                  className="w-[18px] h-[18px] text-[#2B8A38] shrink-0"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
                Full Name
              </label>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 sm:h-[50px] px-5 bg-[#FBFBF9] border border-[#D8DDD5] rounded-full text-[15px] text-[#181413] placeholder-[#8C948B] focus:outline-none focus:ring-2 focus:ring-[#2E8B3C] focus:border-transparent transition"
                placeholder="Your full name"
                disabled={loading}
                maxLength={100}
              />
            </div>

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
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 sm:h-[50px] pl-5 pr-12 bg-[#FBFBF9] border border-[#D8DDD5] rounded-full text-[15px] text-[#181413] placeholder-[#8C948B] focus:outline-none focus:ring-2 focus:ring-[#2E8B3C] focus:border-transparent transition"
                  placeholder="Create a password (min. 8 characters)"
                  disabled={loading}
                />
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-1.5 w-10 flex items-center justify-center rounded-full text-[#747B73] hover:text-[#2E8B3C] focus:outline-none transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5 shrink-0" strokeWidth={2} />
                  ) : (
                    <Eye className="w-5 h-5 shrink-0" strokeWidth={2} />
                  )}
                </button>
              </div>
              <p className="text-xs text-[#6B726A] mt-1.5 ml-3 font-medium">
                Must be at least 8 characters
              </p>
            </div>

            <div className="pt-1.5">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 sm:h-[52px] bg-[#2E8B3C] hover:bg-[#236E2E] text-white font-bold rounded-full text-base sm:text-[18px] shadow-[0_6px_16px_rgba(46,139,60,0.28)] hover:shadow-[0_8px_20px_rgba(46,139,60,0.35)] transition disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2.5"
              >
                <span>{loading ? 'Creating account...' : 'Create Account'}</span>
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

          <div className="mt-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#E1E3DC]" />
            <p className="text-xs sm:text-[13px] text-[#3F453E] whitespace-nowrap">
              Already have an account?{' '}
              <Link
                href="/sign-in"
                className="font-bold text-[#2B8A38] hover:underline ml-1"
              >
                Sign In
              </Link>
            </p>
            <div className="h-px flex-1 bg-[#E1E3DC]" />
          </div>
        </div>
      </div>
    </div>
  );
}
