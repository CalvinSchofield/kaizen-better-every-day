import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

/**
 * Handles app resume from background on native (TestFlight/production).
 * 
 * When the app comes back from background:
 * 1. Refreshes the auth session (prevents 401 errors from expired tokens)
 * 2. Invalidates all active queries so visible data refreshes
 * 
 * This is critical for TestFlight where the WebView can be suspended
 * for long periods, causing stale tokens and stale data.
 */
export function useAppResume() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      // On web, use visibilitychange as a lightweight fallback
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          // Refresh session silently, then invalidate active queries
          supabase.auth.refreshSession().then(() => {
            queryClient.invalidateQueries({ type: 'active' });
          });
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => document.removeEventListener('visibilitychange', handleVisibility);
    }

    // Native: use Capacitor App plugin for reliable resume detection
    let listener: { remove: () => void } | null = null;

    const setup = async () => {
      listener = await App.addListener('resume', async () => {
        console.log('[AppResume] App resumed from background, refreshing...');
        
        try {
          // 1. Refresh auth token first (prevents 401s)
          await supabase.auth.refreshSession();
          
          // 2. Invalidate all active queries so they refetch with fresh token
          await queryClient.invalidateQueries({ type: 'active' });
          
          console.log('[AppResume] Session and data refreshed');
        } catch (err) {
          console.error('[AppResume] Error during resume:', err);
        }
      });
    };

    setup();

    return () => {
      listener?.remove();
    };
  }, [queryClient]);
}
