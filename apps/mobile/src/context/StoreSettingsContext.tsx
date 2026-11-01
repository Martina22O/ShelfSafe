import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { getStoreSettings, StoreSettings } from '../services/storeSettings';
import { NEAR_EXPIRY_DAYS } from '../utils/date';

interface StoreSettingsContextValue {
  store_name: string | null;
  contact_number: string | null;
  near_expiry_days: number;
  loading: boolean;
  error: string | null;
  lastLoadedAt: string | null;
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
  const [nearExpiryDays, setNearExpiryDays] = useState<number>(NEAR_EXPIRY_DAYS);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const fetchSettings = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
    }
    setError(null);

    const res = await getStoreSettings();

    if (res.kind === 'success') {
      setStoreName(res.data.store_name);
      setContactNumber(res.data.contact_number);
      setNearExpiryDays(res.data.near_expiry_days);
      setLastLoadedAt(new Date().toISOString());
      setError(null);
    } else {
      setError(res.message);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSettings(true);
  }, [fetchSettings]);

  const reload = useCallback(async () => {
    await fetchSettings(true);
  }, [fetchSettings]);

  const refresh = useCallback(async () => {
    await fetchSettings(false);
  }, [fetchSettings]);

  const clearStoreSettings = useCallback(() => {
    setStoreName(null);
    setContactNumber(null);
    setNearExpiryDays(NEAR_EXPIRY_DAYS);
    setLoading(false);
    setError(null);
    setLastLoadedAt(null);
  }, []);

  const value: StoreSettingsContextValue = {
    store_name: storeName,
    contact_number: contactNumber,
    near_expiry_days: nearExpiryDays,
    loading,
    error,
    lastLoadedAt,
    reload,
    refresh,
    clearStoreSettings,
  };

  return (
    <StoreSettingsContext.Provider value={value}>
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

