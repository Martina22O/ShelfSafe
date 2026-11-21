import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;

const rawSupabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  extra.EXPO_PUBLIC_SUPABASE_URL ||
  extra.supabaseUrl ||
  '';

const rawSupabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  extra.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  extra.supabaseAnonKey ||
  '';

const supabaseUrl = rawSupabaseUrl.trim();
const supabaseAnonKey = rawSupabaseAnonKey.trim();

export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  /^https?:\/\//i.test(supabaseUrl);

export function getSupabaseConfigError(): string | null {
  if (isSupabaseConfigured) {
    return null;
  }
  const missing: string[] = [];
  if (!supabaseUrl) {
    missing.push('EXPO_PUBLIC_SUPABASE_URL');
  } else if (!/^https?:\/\//i.test(supabaseUrl)) {
    return 'Invalid EXPO_PUBLIC_SUPABASE_URL format (must start with https://).';
  }
  if (!supabaseAnonKey) {
    missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  return `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Configure ${missing.join(' and ')} in your EAS Environment Variables or local .env before building.`;
}

// Never pass empty strings into createClient() at module import time:
// @supabase/supabase-js throws synchronously ("Error: supabaseUrl is required.")
// if given '', which causes an immediate native crash on Android/iOS startup.
const safeUrl = isSupabaseConfigured
  ? supabaseUrl
  : 'https://placeholder-unconfigured.supabase.co';
const safeAnonKey = isSupabaseConfigured
  ? supabaseAnonKey
  : 'placeholder-unconfigured-anon-key';

const webStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore quota or private-browsing storage errors
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore storage removal errors
    }
  },
};

export const supabase = createClient(safeUrl, safeAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? webStorageAdapter : AsyncStorage,
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated.
AppState.addEventListener('change', (state) => {
  if (!isSupabaseConfigured) {
    return;
  }
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
