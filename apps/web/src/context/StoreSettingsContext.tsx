'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
      setError(null);
      setLoading(false);
    } catch (err: unknown) {
      setError(formatErrorMessage(err));
      setNearExpiryDays(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadInitial() {
      try {
        const supabase = createClient();
        const { data, error: rpcError } = await supabase.rpc('get_store_settings', {});

        if (ignore) return;

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
        setError(null);
        setLoading(false);
      } catch (err: unknown) {
        if (ignore) return;
        setError(formatErrorMessage(err));
        setNearExpiryDays(null);
        setLoading(false);
      }
    }

    void loadInitial();

    return () => {
      ignore = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    await performFetch();
  }, [performFetch]);

  const refresh = useCallback(async () => {
    await performFetch();
  }, [performFetch]);

  const clearStoreSettings = useCallback(() => {
    setStoreName(null);
    setContactNumber(null);
    setNearExpiryDays(null);
    setLoading(false);
    setError(null);
  }, []);

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
