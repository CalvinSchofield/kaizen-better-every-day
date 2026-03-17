import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';

/**
 * Lightweight initializer that:
 * - Triggers APNs registration (token is handled by useNativePushNotifications)
 * - Requests location permissions
 *
 * Does NOT set up its own 'registration' listener – that's consolidated
 * in useNativePushNotifications to avoid duplicate/racing listeners.
 */
export function PushNotificationInitializer() {
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
        // If not granted yet, the hook or Settings UI will request later.
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
