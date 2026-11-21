import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useStoreSettings } from '../context/StoreSettingsContext';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

export interface RealtimeContextValue {
  dataVersion: number;
  status: RealtimeStatus;
  lastChangeAt: Date | null;
}

const RealtimeContext = createContext<RealtimeContextValue | undefined>(undefined);

const DEBOUNCE_MS = 800;
const MIN_INTERVAL_MS = 2000;
const MAX_WAIT_MS = 2000;

type TimeoutHandle = ReturnType<typeof setTimeout>;

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [status, setStatus] = useState<RealtimeStatus>('connecting');
  const [lastChangeAt, setLastChangeAt] = useState<Date | null>(null);

  const { refresh: refreshStoreSettings } = useStoreSettings();

  // References for debounce, throttling, and app state
  const lastIncrementTimeRef = useRef<number>(0);
  const debounceTimerRef = useRef<TimeoutHandle | null>(null);
  const maxWaitTimerRef = useRef<TimeoutHandle | null>(null);
  const throttleTimerRef = useRef<TimeoutHandle | null>(null);

  const pendingRefreshRef = useRef<boolean>(false);
  const pendingSettingsRefreshRef = useRef<boolean>(false);
  const wasOfflineRef = useRef<boolean>(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const currentSubscribedUserIdRef = useRef<string | null>(null);

  const appStateRef = useRef<AppStateStatus>(
    (AppState.currentState as AppStateStatus) || 'active'
  );
  const isForegroundRef = useRef<boolean>(AppState.currentState === 'active');

  // Commit a debounced / throttled refresh
  const commitRefresh = useRef(() => {
    // Clear debounce and max-wait timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (maxWaitTimerRef.current) {
      clearTimeout(maxWaitTimerRef.current);
      maxWaitTimerRef.current = null;
    }

    // If app is not in the foreground, do not trigger reloads now; keep pending flag
    if (!isForegroundRef.current) {
      pendingRefreshRef.current = true;
      return;
    }

    const now = Date.now();
    const elapsed = now - lastIncrementTimeRef.current;

    // Throttle: enforce minimum interval of 2 seconds
    if (elapsed < MIN_INTERVAL_MS) {
      pendingRefreshRef.current = true;
      if (!throttleTimerRef.current) {
        throttleTimerRef.current = setTimeout(() => {
          throttleTimerRef.current = null;
          if (pendingRefreshRef.current) {
            commitRefresh.current();
          }
        }, MIN_INTERVAL_MS - elapsed);
      }
      return;
    }

    // Execute refresh
    lastIncrementTimeRef.current = Date.now();
    pendingRefreshRef.current = false;
    const shouldRefreshSettings = pendingSettingsRefreshRef.current;
    pendingSettingsRefreshRef.current = false;

    const nowTime = new Date();
    setLastChangeAt(nowTime);
    setDataVersion((prev) => prev + 1);

    if (shouldRefreshSettings) {
      // Silently refresh store settings
      void refreshStoreSettings();
    }
  });

  // Signal incoming database change
  const triggerChange = useRef((isSettingsChange: boolean) => {
    if (isSettingsChange) {
      pendingSettingsRefreshRef.current = true;
    }
    pendingRefreshRef.current = true;

    // Start max wait timer so rapid continuous events cannot postpone refresh indefinitely
    if (!maxWaitTimerRef.current) {
      maxWaitTimerRef.current = setTimeout(() => {
        commitRefresh.current();
      }, MAX_WAIT_MS);
    }

    // Debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      commitRefresh.current();
    }, DEBOUNCE_MS);
  });

  // Supabase Realtime channel and AppState management
  useEffect(() => {
    let isCancelled = false;

    const setupChannel = (userId: string) => {
      if (isCancelled || !isForegroundRef.current) return;

      // If already subscribed to this user's channel, do nothing
      if (channelRef.current && currentSubscribedUserIdRef.current === userId) {
        return;
      }

      // Cleanup old channel if switching users
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      currentSubscribedUserIdRef.current = userId;
      setStatus('connecting');

      const channelName = `realtime:mobile-${userId}`;
      const channel = supabase.channel(channelName);

      channel
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'products',
          },
          () => {
            // Signal only: never read, log, or store payload
            triggerChange.current(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'batches',
          },
          () => {
            triggerChange.current(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'categories',
          },
          () => {
            triggerChange.current(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'deductions',
          },
          () => {
            triggerChange.current(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'sales_scans',
          },
          () => {
            triggerChange.current(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory_edits',
          },
          () => {
            triggerChange.current(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'store_settings',
          },
          () => {
            // Signal store settings change
            triggerChange.current(true);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_subscriptions',
          },
          () => {
            triggerChange.current(false);
          }
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'subscription_events',
          },
          () => {
            triggerChange.current(false);
          }
        )
        .subscribe((subStatus) => {
          if (isCancelled) return;

          if (subStatus === 'SUBSCRIBED') {
            setStatus('live');
            // If reconnecting after being offline, trigger coalesced refresh
            if (wasOfflineRef.current) {
              wasOfflineRef.current = false;
              triggerChange.current(true);
            }
          } else if (
            subStatus === 'CLOSED' ||
            subStatus === 'CHANNEL_ERROR' ||
            subStatus === 'TIMED_OUT'
          ) {
            wasOfflineRef.current = true;
            setStatus('offline');
          }
        });

      channelRef.current = channel;
    };

    const cleanupChannel = () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      currentSubscribedUserIdRef.current = null;
      setStatus('offline');
    };

    // AppState change listener: manage subscription and background pause
    const appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const isNowActive = nextAppState === 'active';
        const wasActive = appStateRef.current === 'active';
        appStateRef.current = nextAppState;
        isForegroundRef.current = isNowActive;

        if (wasActive && !isNowActive) {
          // Going to background/inactive: remove channel and cancel pending timers
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
          }
          if (maxWaitTimerRef.current) {
            clearTimeout(maxWaitTimerRef.current);
            maxWaitTimerRef.current = null;
          }
          cleanupChannel();
        } else if (!wasActive && isNowActive) {
          // Returning to foreground: re-subscribe and trigger catch-up refresh once
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (isCancelled) return;
            if (user) {
              setupChannel(user.id);
            }
          });
          triggerChange.current(true);
        }
      }
    );

    // Initial check: if foreground, subscribe current user
    if (isForegroundRef.current) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (isCancelled) return;
        if (user) {
          setupChannel(user.id);
        } else {
          cleanupChannel();
        }
      });
    }

    // Web / iPhone PWA network recovery listeners
    const handleOnline = () => {
      if (isCancelled) return;
      wasOfflineRef.current = false;
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (isCancelled) return;
        if (user) {
          setupChannel(user.id);
        }
      });
      triggerChange.current(true);
    };

    const handleOffline = () => {
      if (isCancelled) return;
      wasOfflineRef.current = true;
      setStatus('offline');
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }

    // Handle auth state changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (isCancelled) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        cleanupChannel();
        return;
      }

      if (
        isForegroundRef.current &&
        session.user.id !== currentSubscribedUserIdRef.current
      ) {
        setupChannel(session.user.id);
      }
    });

    return () => {
      isCancelled = true;
      appStateSubscription.remove();
      authSubscription.unsubscribe();
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      }
      cleanupChannel();

      // Clear all timers on unmount
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (maxWaitTimerRef.current) {
        clearTimeout(maxWaitTimerRef.current);
        maxWaitTimerRef.current = null;
      }
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
        throttleTimerRef.current = null;
      }
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{
        dataVersion,
        status,
        lastChangeAt,
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider');
  }
  return context;
}
