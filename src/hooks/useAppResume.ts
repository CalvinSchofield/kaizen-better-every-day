import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/utils/authSession';
import { persistTokensToNative } from '@/utils/nativeTokenStorage';

/**
 * Comprehensive app resume handler for Capacitor/TestFlight reliability.
 *
 * On native we explicitly manage auth auto-refresh lifecycle because backgrounded
 * webviews can stop refreshing tokens and then emit transient auth-loss events
 * when the app returns.
 */
export function useAppResume() {
  const queryClient = useQueryClient();
  const lastResumeRef = useRef(0);
  const DEBOUNCE_MS = 2000;

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();

    const startAutoRefresh = async () => {
      try {
        await supabase.auth.startAutoRefresh();
        console.log('[useAppResume] Auth auto-refresh started');
      } catch (error) {
        console.warn('[useAppResume] Failed to start auth auto-refresh:', error);
      }
    };

    const stopAutoRefresh = async () => {
      try {
        await supabase.auth.stopAutoRefresh();
        console.log('[useAppResume] Auth auto-refresh stopped');
      } catch (error) {
        console.warn('[useAppResume] Failed to stop auth auto-refresh:', error);
      }
    };

    const handleResume = async () => {
      const now = Date.now();
      if (now - lastResumeRef.current < DEBOUNCE_MS) {
        console.log('[useAppResume] Debounced – skipping duplicate resume');
        return;
      }
      lastResumeRef.current = now;

      console.log('[useAppResume] App resumed – restoring auth & invalidating queries');

      if (isNative) {
        await startAutoRefresh();
      }

      try {
        const { session, user } = await getSessionSafe();
        if (!session?.user && !user) {
          console.warn('[useAppResume] No validated session after resume; preserving current UI until auth settles');
          return;
        }
        console.log('[useAppResume] Session verified successfully');
        // Re-persist tokens to native storage after successful refresh
        persistTokensToNative();
      } catch (err) {
        console.error('[useAppResume] Auth recovery error:', err);
        return;
      }

      queryClient.invalidateQueries({ type: 'active' });
    };

    let resumeListener: Awaited<ReturnType<typeof App.addListener>> | null = null;
    let appStateListener: Awaited<ReturnType<typeof App.addListener>> | null = null;

    if (isNative) {
      void startAutoRefresh();
      App.addListener('resume', handleResume).then((listener) => {
        resumeListener = listener;
      });
      App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void handleResume();
        } else {
          void stopAutoRefresh();
        }
      }).then((listener) => {
        appStateListener = listener;
      });
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void handleResume();
      } else if (isNative) {
        void stopAutoRefresh();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (isNative) {
        void stopAutoRefresh();
      }
      resumeListener?.remove();
      appStateListener?.remove();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);
}
