import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { useNativePushNotifications } from '@/hooks/useNativePushNotifications';

/**
 * Lightweight initializer that:
 * - Mounts useNativePushNotifications to set up foreground push listeners
 * - Triggers APNs registration (token is handled by the hook)
 * - Requests location permissions
 */
export function PushNotificationInitializer() {
  // This hook sets up all push listeners including pushNotificationReceived
  // which triggers the InAppNotificationBanner for foreground notifications
  useNativePushNotifications();

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
  }, []);

  return null;
}
