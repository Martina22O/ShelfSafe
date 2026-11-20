/**
 * Navigator: RootNavigator
 * Contains:
 * - Real Supabase session auth guard
 * - AuthLoadingScreen while checking session
 * - If session is null -> AuthNavigator (signed-out screens)
 * - If session exists -> MainTabNavigator (5 bottom tabs) wrapped in StoreSettingsProvider & SaleCartProvider
 */
import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import AuthLoadingScreen from '../screens/auth/AuthLoadingScreen';
import SubscriptionOnboardingScreen from '../screens/subscription/SubscriptionOnboardingScreen';
import { getUserSubscription } from '../services/subscription';
import { StoreSettingsProvider } from '../context/StoreSettingsContext';
import { SaleCartProvider } from '../context/SaleCartContext';
import { RealtimeProvider } from '../services/realtime';

// Global flag to prevent RootNavigator from transitioning newly registered users
// to MainTabNavigator when Supabase automatically returns an active session on signup.
let isRegisteringGlobal = false;

export function setIsRegistering(val: boolean) {
  isRegisteringGlobal = val;
}

export function getIsRegistering(): boolean {
  return isRegisteringGlobal;
}

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingOnboarding, setCheckingOnboarding] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // If registration is in progress, ignore auto-sign-in so user is redirected to SignInScreen
      if (isRegisteringGlobal && event === 'SIGNED_IN') {
        return;
      }

      // Ignore SIGNED_IN, TOKEN_REFRESHED, and USER_UPDATED for the same user
      // so screens like ChangePassword are not unmounted or reset prematurely.
      setSession((prevSession) => {
        const prevUserId = prevSession?.user?.id;
        const newUserId = newSession?.user?.id;

        if (
          prevUserId &&
          newUserId &&
          prevUserId === newUserId &&
          (event === 'SIGNED_IN' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'USER_UPDATED')
        ) {
          return prevSession;
        }

        return newSession;
      });
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Check subscription onboarding status for authenticated user
  useEffect(() => {
    let isMounted = true;
    const userId = session?.user?.id;

    if (!userId) {
      setNeedsOnboarding(false);
      setCheckingOnboarding(false);
      return;
    }

    setCheckingOnboarding(true);
    getUserSubscription()
      .then((res) => {
        if (!isMounted) return;
        // If RPC is unavailable (migrations not yet applied) or onboarding already completed, don't block
        if (res.isRpcUnavailable) {
          setNeedsOnboarding(false);
        } else if (res.success && res.data) {
          setNeedsOnboarding(!res.data.onboarding_completed);
        } else {
          setNeedsOnboarding(false);
        }
      })
      .catch(() => {
        if (isMounted) setNeedsOnboarding(false);
      })
      .finally(() => {
        if (isMounted) setCheckingOnboarding(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  if (loading || checkingOnboarding) {
    return <AuthLoadingScreen />;
  }

  if (!session) {
    return <AuthNavigator />;
  }

  if (needsOnboarding) {
    return (
      <SubscriptionOnboardingScreen
        onComplete={() => setNeedsOnboarding(false)}
      />
    );
  }

  return (
    <StoreSettingsProvider key={session.user.id}>
      <RealtimeProvider>
        <SaleCartProvider>
          <MainTabNavigator />
        </SaleCartProvider>
      </RealtimeProvider>
    </StoreSettingsProvider>
  );
}
