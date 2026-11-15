import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = {
  title: 'ShelfSafe — Smarter Stock, Safer Shelves',
  description: 'Smart retail inventory, batch expiration tracking, and FEFO sales deductions.',
};

export default function HomePage() {
  return (
    <main className="min-h-screen w-full bg-[#FAF8F5] relative flex flex-col justify-between overflow-x-hidden">
      {/* Background artwork */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <Image
          src="/images/landing-background.jpg"
          alt="ShelfSafe - Smarter Stock, Safer Shelves"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
      </div>

      {/* Top Bar for Mobile & Tablet Branding / Shortcuts */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {/* Accessible brand tag */}
          <span className="sr-only">ShelfSafe</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-[#181413] hover:text-[#207429] bg-white/70 backdrop-blur-xs border border-[#ece3d2] shadow-2xs hover:bg-white transition-all"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-[#207429] hover:bg-[#185e21] shadow-xs transition-all"
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* Main Interactive Button Area Aligned with Left Promotional Content */}
      <div className="w-full max-w-7xl mx-auto px-6 sm:px-12 lg:px-16 pb-16 sm:pb-24 lg:pb-32 z-10 flex-1 flex flex-col justify-end">
        <div className="w-full max-w-xl">
          {/* Buttons positioned directly beneath the left promotional text */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4 mt-6">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-sm sm:text-base font-bold text-white bg-[#207429] hover:bg-[#185e21] shadow-md hover:shadow-lg transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-xl text-sm sm:text-base font-bold text-[#181413] bg-white hover:bg-[#fef9f0] border-1.5 border-[#ece3d2] shadow-sm hover:shadow-md transition-all"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
