import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Comprehensive app resume handler for Capacitor/TestFlight reliability.
 * 
 * Listens to BOTH:
 * - Capacitor `App.addListener('resume')` (native iOS/Android)
 * - `document.visibilitychange` (web fallback, also fires on some native scenarios)
 * 
 * On resume:
 * 1. Refreshes the Supabase auth token (prevents 401s from expired tokens)
 * 2. Invalidates ALL active React Query queries (forces fresh data fetch)
 * 
 * Debounced to prevent rapid-fire on quick app switches.
 */
export function useAppResume() {
  const queryClient = useQueryClient();
  const lastResumeRef = useRef(0);
  const DEBOUNCE_MS = 2000; // Ignore resume events within 2s of each other

  useEffect(() => {
    const handleResume = async () => {
      const now = Date.now();
      if (now - lastResumeRef.current < DEBOUNCE_MS) {
        console.log('[useAppResume] Debounced – skipping duplicate resume');
        return;
      }
      lastResumeRef.current = now;

      console.log('[useAppResume] App resumed – refreshing auth & invalidating queries');

      // 1. Refresh auth token first (critical for preventing 401s)
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          console.warn('[useAppResume] Session refresh failed:', error.message);
          // Try getSession as fallback – might still have a valid cached token
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) {
            console.warn('[useAppResume] No valid session – user may need to re-login');
            return; // Don't invalidate queries if there's no session
          }
        } else {
          console.log('[useAppResume] Session refreshed successfully');
        }
      } catch (err) {
        console.error('[useAppResume] Auth refresh error:', err);
      }

      // 2. Invalidate all active queries so they refetch with fresh auth
      queryClient.invalidateQueries({ type: 'active' });
    };

    // ── Native: Capacitor resume listener ──
    let capacitorListener: Awaited<ReturnType<typeof App.addListener>> | null = null;
    if (Capacitor.isNativePlatform()) {
      App.addListener('resume', handleResume).then(listener => {
        capacitorListener = listener;
      });
    }

    // ── Web fallback: visibilitychange ──
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      capacitorListener?.remove();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient]);
}
