'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Bell,
  History,
  User,
  HelpCircle,
  LogOut,
  Menu,
  X,
  Search,
  Store,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { createClient } from '../lib/supabase/client';
import { useStoreSettings } from '../context/StoreSettingsContext';
import { useRealtime } from '../lib/realtime';
import { SubscriptionOnboardingModal } from './SubscriptionOnboardingModal';
import { getUserSubscription } from '../lib/subscription';

interface AppShellProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'History', href: '/history', icon: History },
  { name: 'Subscription', href: '/subscription', icon: Sparkles },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Help', href: '/help', icon: HelpCircle },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { store_name, loading: settingsLoading, error: settingsError, reload, clearStoreSettings } = useStoreSettings();
  const { status: realtimeStatus, dataVersion } = useRealtime();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);

  const currentUserIdRef = useRef<string | null>(null);
  const onboardingCheckedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        currentUserIdRef.current = user.id;
        const name = user.user_metadata?.name || user.email?.split('@')[0] || '';
        setUserName(name);
        setUserEmail(user.email || '');

        if (!onboardingCheckedRef.current) {
          getUserSubscription()
            .then((res) => {
              if (!isMounted) return;
              if (res.isRpcUnavailable) {
                setShowOnboarding(false);
              } else if (res.success && res.data) {
                setShowOnboarding(!res.data.onboarding_completed);
              }
              onboardingCheckedRef.current = true;
            })
            .catch(() => {
              if (isMounted) setShowOnboarding(false);
            });
        }
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null;
        setUserName('');
        setUserEmail('');
        setShowOnboarding(false);
        onboardingCheckedRef.current = false;
        return;
      }
      if (session?.user) {
        currentUserIdRef.current = session.user.id;
        const name = session.user.user_metadata?.name || session.user.email?.split('@')[0] || '';
        setUserName(name);
        setUserEmail(session.user.email || '');
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // Re-check onboarding status if subscription changes on another device while modal is open
  useEffect(() => {
    if (!showOnboarding || dataVersion === 0) return;
    let isMounted = true;
    getUserSubscription()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data && res.data.onboarding_completed) {
          setShowOnboarding(false);
        }
      })
      .catch(() => {
        // Ignore silent background error
      });
    return () => {
      isMounted = false;
    };
  }, [dataVersion, showOnboarding]);

  // Keyboard accessibility: Escape closes the sign-out confirmation modal or mobile sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSignOutConfirm && !signingOut) {
          setShowSignOutConfirm(false);
        } else if (sidebarOpen) {
          setSidebarOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSignOutConfirm, signingOut, sidebarOpen]);

  const handleConfirmSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      const supabase = createClient();
      clearStoreSettings();
      await supabase.auth.signOut();
      setShowSignOutConfirm(false);
      router.push('/sign-in');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }, [clearStoreSettings, router]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/inventory?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const userInitial = (userName || userEmail || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen flex bg-[#faf8f5]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        style={{
          backgroundImage: "url('/images/navbar-background.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
        className={`
          fixed top-0 inset-y-0 left-0 z-50 w-64 h-screen border-r border-[#ece3d2]
          flex flex-col justify-between transition-transform duration-200 ease-in-out
          lg:sticky lg:top-0 lg:z-30 lg:shrink-0
          ${sidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full pointer-events-none lg:pointer-events-auto lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full relative z-10 overflow-y-auto">
          {/* Mobile close button (positioned absolute in top right) */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden absolute top-4 right-4 p-1.5 rounded-lg text-[#7a7469] hover:text-[#181413] hover:bg-white/80 transition-colors z-20"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Centered Vertical Branding Header */}
          <div className="pt-8 pb-5 px-6 border-b border-[#ece3d2]/70 flex flex-col items-center text-center">
            <Link
              href="/dashboard"
              className="flex flex-col items-center group focus:outline-none"
              onClick={() => setSidebarOpen(false)}
            >
              {/* Enlarged Centered ShelfSafe Logo */}
              <div className="w-20 h-20 flex items-center justify-center mb-3 overflow-hidden rounded-2xl shadow-xs">
                <Image
                  src="/images/shelfsafe-logo.jpg?v=20261116"
                  alt="ShelfSafe Logo"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                  priority
                  unoptimized
                />
              </div>

              {/* ShelfSafe Title Directly Below Logo */}
              <span className="font-extrabold text-xl tracking-tight text-[#207429]">
                Shelf<span className="text-[#faab06]">Safe</span>
              </span>
            </Link>

            {/* Store Info Pill Centered Below Title */}
            <div className="mt-3 w-full max-w-[200px]">
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-2xs border border-[#ece3d2] text-xs text-[#524c40] shadow-2xs">
                <Store className="w-3.5 h-3.5 text-[#207429] shrink-0" />
                <span className="font-semibold truncate">{store_name || 'Retail Inventory'}</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex-1 px-3.5 py-5 space-y-1.5">
            <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-[#7a7469]">
              Main Menu
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/');

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150
                    ${
                      isActive
                        ? 'bg-[#207429] text-white shadow-sm'
                        : 'text-[#332e27] hover:bg-white/70 hover:text-[#181413]'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 transition-colors ${
                        isActive ? 'text-white' : 'text-[#7a7469] group-hover:text-[#207429]'
                      }`}
                    />
                    <span>{item.name}</span>
                  </div>

                  {item.badge ? (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-[#f4ffe1] text-[#207429] border border-[#207429]/20'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>

          {/* User Account / Footer */}
          <div className="p-3 border-t border-[#ece3d2]/70 bg-white/40 backdrop-blur-2xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/95 border border-[#ece3d2] shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#207429] text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#181413] truncate">
                    {userName || 'Store Manager'}
                  </p>
                  <p className="text-[11px] text-[#7a7469] truncate">
                    {userEmail || 'Active session'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(true)}
                disabled={signingOut}
                aria-label="Sign out"
                title="Sign out"
                className="p-1.5 rounded-md text-[#7a7469] hover:text-[#d32f2f] hover:bg-red-50 transition-colors shrink-0 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Layout Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-[#e5e7eb] px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-3 shadow-2xs">
          {/* Left: Mobile hamburger & Global Search */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-xl">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 rounded-lg border border-[#e5e7eb] text-[#4a443a] hover:bg-[#f3f4f6] transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Quick search input matching desktop reference */}
            <form onSubmit={handleSearchSubmit} className="relative w-full min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search inventory, SKU, batch code..."
                className="w-full pl-9 pr-4 py-2 text-xs md:text-sm bg-[#faf8f5] border border-[#e5e7eb] rounded-lg text-[#181413] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-[#207429] focus:bg-white transition-all"
              />
            </form>
          </div>

          {/* Right: Live Status, Notification Bell & User Badge */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Realtime Status Indicator */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold select-none ${
                realtimeStatus === 'live'
                  ? 'border-[#207429]/30 bg-[#f4ffe1]/70 text-[#207429]'
                  : 'border-[#ece3d2] bg-[#fef9f0] text-[#7a7469]'
              }`}
              title={
                realtimeStatus === 'live'
                  ? 'Realtime updates are live and active'
                  : 'Connecting to realtime service...'
              }
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  realtimeStatus === 'live'
                    ? 'bg-[#207429]'
                    : 'bg-amber-500'
                }`}
              />
              <span>{realtimeStatus === 'live' ? 'Live' : 'Reconnecting...'}</span>
            </div>

            <Link
              href="/notifications"
              className="relative p-2 rounded-lg border border-[#e5e7eb] text-[#4a443a] hover:bg-[#f8faf8] hover:text-[#207429] transition-colors"
              aria-label="View notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#faab06] ring-2 ring-white" />
            </Link>

            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-[#e5e7eb] hover:bg-[#f8faf8] transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-[#f4ffe1] text-[#207429] border border-[#207429]/30 font-bold text-[11px] flex items-center justify-center">
                {userInitial}
              </div>
              <span className="text-xs font-semibold text-[#181413] max-w-[120px] truncate">
                {userName || store_name || 'Profile'}
              </span>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full overflow-y-auto min-w-0">
          {settingsError ? (
            <div className="border border-red-200 bg-red-50/80 p-4 rounded-xl text-red-900 mb-6 flex items-center justify-between shadow-2xs">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Error loading store settings</p>
                  <p className="text-xs text-red-700 mt-0.5">{settingsError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => reload()}
                className="inline-flex items-center gap-1.5 text-xs font-bold bg-[#d32f2f] text-white px-3 py-1.5 rounded-lg hover:bg-red-700 transition-colors shadow-2xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
            </div>
          ) : settingsLoading ? (
            <div className="flex items-center gap-2 text-[#7a7469] text-sm py-6">
              <div className="w-4 h-4 border-2 border-[#207429] border-t-transparent rounded-full animate-spin" />
              <span>Loading store settings...</span>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="signout-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full border border-[#ece3d2] shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-xl bg-red-50 text-[#d32f2f] flex items-center justify-center mb-4">
              <LogOut className="w-5 h-5" />
            </div>
            <h2 id="signout-modal-title" className="text-lg font-bold text-[#181413] mb-1.5">
              Sign out of ShelfSafe?
            </h2>
            <p className="text-xs text-[#6b7280] leading-relaxed mb-6">
              Are you sure you want to end your current session? You will need to sign back in to manage your inventory.
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                disabled={signingOut}
                className="px-4 py-2 text-xs font-semibold border border-[#d1d5db] rounded-lg text-[#374151] hover:bg-[#f9fafb] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSignOut}
                disabled={signingOut}
                className="px-4 py-2 text-xs font-bold bg-[#d32f2f] text-white rounded-lg hover:bg-red-700 transition-colors shadow-2xs disabled:opacity-50"
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Subscription Onboarding Modal for New Users */}
      <SubscriptionOnboardingModal
        isOpen={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />
    </div>
  );
}
