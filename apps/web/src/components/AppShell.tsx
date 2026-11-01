'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '../lib/supabase/client';
import { useStoreSettings } from '../context/StoreSettingsContext';

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_LINKS = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Inventory', href: '/inventory' },
  { name: 'Notifications', href: '/notifications' },
  { name: 'History', href: '/history' },
  { name: 'Profile', href: '/profile' },
];

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { store_name, loading: settingsLoading, error: settingsError, reload, clearStoreSettings } = useStoreSettings();

  const [userName, setUserName] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.name || user.email || '');
      }
    });
  }, []);

  // Keyboard accessibility: Escape closes the sign-out confirmation modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSignOutConfirm && !signingOut) {
        setShowSignOutConfirm(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSignOutConfirm, signingOut]);

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {/* Mobile hamburger toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden p-1.5 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div>
            <span className="font-bold text-lg text-gray-900 tracking-tight">ShelfSafe</span>
            <span className="text-gray-400 mx-2">•</span>
            <span className="text-sm font-medium text-gray-700">
              {store_name || 'Your store'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:inline">
            {userName}
          </span>
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="text-sm border border-gray-300 px-3 py-1.5 rounded text-gray-700 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-20 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`
            fixed md:static inset-y-0 left-0 z-20 w-64 bg-white border-r border-gray-200 p-4 transform transition-transform duration-200 ease-in-out md:translate-x-0
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="text-xs font-semibold uppercase text-gray-400 mb-3 tracking-wider">
            Navigation
          </div>
          <nav className="space-y-1">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    block px-3 py-2 rounded text-sm font-medium transition-colors
                    ${isActive ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}
                  `}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6 max-w-6xl w-full">
          {settingsError ? (
            <div className="border border-red-300 bg-red-50 p-4 rounded text-red-800 mb-6 flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Error loading store settings</p>
                <p className="text-xs mt-0.5">{settingsError}</p>
              </div>
              <button
                type="button"
                onClick={() => reload()}
                className="text-xs font-medium bg-red-700 text-white px-3 py-1.5 rounded hover:bg-red-800"
              >
                Retry
              </button>
            </div>
          ) : settingsLoading ? (
            <div className="flex items-center gap-2 text-gray-500 text-sm py-4">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div className="bg-white rounded p-6 max-w-sm w-full border border-gray-300 shadow-lg">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Sign out?</h2>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to sign out of your account?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                disabled={signingOut}
                className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSignOut}
                disabled={signingOut}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

