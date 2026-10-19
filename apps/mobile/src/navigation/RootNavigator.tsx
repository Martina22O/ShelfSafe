/**
 * Navigator: RootNavigator
 * Contains:
 * - Real Supabase session auth guard
 * - AuthLoadingScreen while checking session
 * - If session is null -> AuthNavigator (signed-out screens)
 * - If session exists -> MainTabNavigator (5 bottom tabs)
 */
import React, { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import AuthLoadingScreen from '../screens/auth/AuthLoadingScreen';

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <AuthLoadingScreen />;
  }

  return session ? <MainTabNavigator /> : <AuthNavigator />;
}
