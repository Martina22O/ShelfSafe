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
import { StoreSettingsProvider } from '../context/StoreSettingsContext';
import { SaleCartProvider } from '../context/SaleCartContext';
import { RealtimeProvider } from '../services/realtime';

export default function RootNavigator() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return <AuthLoadingScreen />;
  }

  return session ? (
    <StoreSettingsProvider key={session.user.id}>
      <RealtimeProvider>
        <SaleCartProvider>
          <MainTabNavigator />
        </SaleCartProvider>
      </RealtimeProvider>
    </StoreSettingsProvider>
  ) : (
    <AuthNavigator />
  );
}
