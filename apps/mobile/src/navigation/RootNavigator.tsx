/**
 * Navigator: RootNavigator
 * Contains:
 * - Real Supabase session auth guard
 * - AuthLoadingScreen while checking session
 * - If session is null -> AuthNavigator (signed-out screens)
 * - If session exists -> MainTabNavigator (5 bottom tabs) wrapped in StoreSettingsProvider & SaleCartProvider
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import {
  supabase,
  isSupabaseConfigured,
  getSupabaseConfigError,
} from '../services/supabase';
import AuthNavigator from './AuthNavigator';
import MainTabNavigator from './MainTabNavigator';
import AuthLoadingScreen from '../screens/auth/AuthLoadingScreen';
import SubscriptionOnboardingScreen from '../screens/subscription/SubscriptionOnboardingScreen';
import { getUserSubscription } from '../services/subscription';
import { StoreSettingsProvider } from '../context/StoreSettingsContext';
import { SaleCartProvider } from '../context/SaleCartContext';
import { RealtimeProvider } from '../services/realtime';
import { COLORS, FONTS } from '../theme';

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
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Get initial session safely
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession } }) => {
        if (!isMounted) return;
        setSession(initialSession);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setLoading(false);
      });

    // 2. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!isMounted) return;

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
      isMounted = false;
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

  if (!isSupabaseConfigured) {
    const configError =
      getSupabaseConfigError() ||
      'Supabase environment variables are missing from this build.';
    return (
      <SafeAreaView style={styles.diagContainer} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.diagCard}>
          <Image
            source={require('../../assets/designs/shelfsafe-logo.jpg')}
            style={styles.diagLogo}
            resizeMode="contain"
          />
          <Text style={styles.diagTitle}>Configuration Required</Text>
          <Text style={styles.diagMessage}>{configError}</Text>
          <View style={styles.diagCodeBox}>
            <Text style={styles.diagCodeText}>EXPO_PUBLIC_SUPABASE_URL</Text>
            <Text style={styles.diagCodeText}>EXPO_PUBLIC_SUPABASE_ANON_KEY</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

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

const styles = StyleSheet.create({
  diagContainer: {
    flex: 1,
    backgroundColor: COLORS.canvas,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  diagCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  diagLogo: {
    width: 64,
    height: 64,
    borderRadius: 14,
    marginBottom: 16,
  },
  diagTitle: {
    fontSize: 20,
    fontFamily: FONTS.extraBold,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  diagMessage: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 16,
  },
  diagCodeBox: {
    width: '100%',
    backgroundColor: COLORS.bgWarm,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  diagCodeText: {
    fontSize: 12,
    fontFamily: FONTS.bold,
    fontWeight: '700',
    color: COLORS.primary,
  },
});
