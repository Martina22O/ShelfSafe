'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { createClient } from '../lib/supabase/client';
import { formatErrorMessage } from '../lib/error';

export interface StoreSettings {
  owner_id: string;
  store_name: string | null;
  contact_number: string | null;
  near_expiry_days: number;
  created_at: string | null;
  updated_at: string | null;
}

interface StoreSettingsContextValue {
  store_name: string | null;
  contact_number: string | null;
  near_expiry_days: number | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  clearStoreSettings: () => void;
}

const StoreSettingsContext = createContext<StoreSettingsContextValue | undefined>(
  undefined
);

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [storeName, setStoreName] = useState<string | null>(null);
  const [contactNumber, setContactNumber] = useState<string | null>(null);
  const [nearExpiryDays, setNearExpiryDays] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserIdRef = useRef<string | null>(null);

  const performFetch = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc('get_store_settings', {});

      if (rpcError) {
        setError(formatErrorMessage(rpcError));
        setNearExpiryDays(null);
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError('Failed to load store settings. Reload the page and check');
        setNearExpiryDays(null);
        setLoading(false);
        return;
      }

      setStoreName(row.out_store_name ?? row.store_name ?? null);
      setContactNumber(row.out_contact_number ?? row.contact_number ?? null);
      setNearExpiryDays(Number(row.out_near_expiry_days ?? row.near_expiry_days ?? 7));
      currentUserIdRef.current = row.out_owner_id ?? row.owner_id ?? currentUserIdRef.current;
      setError(null);
      setLoading(false);
    } catch (err: unknown) {
      setError(formatErrorMessage(err));
      setNearExpiryDays(null);
      setLoading(false);
    }
  }, []);

  const clearStoreSettings = useCallback(() => {
    setStoreName(null);
    setContactNumber(null);
    setNearExpiryDays(null);
    setLoading(false);
    setError(null);
    currentUserIdRef.current = null;
  }, []);

  useEffect(() => {
    let ignore = false;
    const supabase = createClient();

    async function loadInitial() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        currentUserIdRef.current = user.id;
      }
      if (!ignore) {
        await performFetch();
      }
    }

    void loadInitial();

    // Listen to auth events. For the SAME user (e.g. password verification or profile updates),
    // ignore SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED so settings are not cleared,
    // page is not reloaded, and no loading flash occurs.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUserId = session?.user?.id ?? null;

      if (event === 'SIGNED_OUT') {
        clearStoreSettings();
        return;
      }

      if (newUserId && newUserId === currentUserIdRef.current) {
        // Same user: ignore SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED
        return;
      }

      if (newUserId && newUserId !== currentUserIdRef.current) {
        // Different user signed in: fetch settings for new user
        currentUserIdRef.current = newUserId;
        await performFetch();
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, [performFetch, clearStoreSettings]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performFetch();
  }, [performFetch]);

  const refresh = useCallback(async () => {
    await performFetch();
  }, [performFetch]);

  return (
    <StoreSettingsContext.Provider
      value={{
        store_name: storeName,
        contact_number: contactNumber,
        near_expiry_days: nearExpiryDays,
        loading,
        error,
        reload,
        refresh,
        clearStoreSettings,
      }}
    >
      {children}
    </StoreSettingsContext.Provider>
  );
}

export function useStoreSettings(): StoreSettingsContextValue {
  const context = useContext(StoreSettingsContext);
  if (!context) {
    throw new Error('useStoreSettings must be used within a StoreSettingsProvider');
  }
  return context;
}
