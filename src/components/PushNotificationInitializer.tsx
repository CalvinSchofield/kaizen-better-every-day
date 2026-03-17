import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { useQueryClient } from '@tanstack/react-query';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';

/**
 * Lightweight initializer that:
 * - Mounts useNativePushNotifications to set up foreground push listeners
 * - Triggers APNs registration (token is handled by the hook)
 * - Requests location permissions
 * - Invalidates live queries on app resume for real-time freshness
 */
export function PushNotificationInitializer() {
  // This hook sets up all push listeners including pushNotificationReceived
  // which triggers the InAppNotificationBanner for foreground notifications
  useNativePushNotifications();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const init = async () => {
      // ── Push: just call register() if permission is already granted ──
      try {
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'granted') {
          await PushNotifications.register();
          console.log('[PushInit] register() called (permission already granted)');
        }
      } catch (err) {
        console.error('[PushInit] Push init error:', err);
      }

      // ── Location: request after a short delay ───────────────────────
      setTimeout(async () => {
        try {
          const locPerm = await Geolocation.checkPermissions();
          if (locPerm.location === 'prompt' || locPerm.location === 'prompt-with-rationale') {
            await Geolocation.requestPermissions();
          }
        } catch (err) {
          console.error('[PushInit] Location error:', err);
        }
      }, 1000);
    };

    init();

    // ── App resume: force-refetch leaderboard & competitor data ──────
    let resumeListener: Awaited<ReturnType<typeof App.addListener>> | null = null;
    App.addListener('resume', () => {
      console.log('[PushInit] App resumed – invalidating live queries');
      queryClient.invalidateQueries({ queryKey: ['today-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['weekly-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['expanded-leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard-data-boundary'] });
      queryClient.invalidateQueries({ queryKey: ['daily-entry'] });
    }).then(listener => {
      resumeListener = listener;
    });

    return () => {
      resumeListener?.remove();
    };
  }, [queryClient]);

  return null;
}
