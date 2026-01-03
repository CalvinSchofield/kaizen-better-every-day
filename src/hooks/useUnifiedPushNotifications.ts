import { Capacitor } from '@capacitor/core';
import { usePushNotifications } from './usePushNotifications';
import { useNativePushNotifications } from './useNativePushNotifications';

/**
 * Unified push notification hook that automatically uses:
 * - Native APNs for iOS/Android Capacitor apps
 * - Web Push for PWA/browser
 */
export function useUnifiedPushNotifications() {
  const isNative = Capacitor.isNativePlatform();

  // Use native push for Capacitor apps, web push for browsers
  const webPush = usePushNotifications();
  const nativePush = useNativePushNotifications();

  if (isNative) {
    return {
      isSupported: nativePush.isSupported,
      isSubscribed: nativePush.isRegistered,
      permission:
        nativePush.permission === 'granted'
          ? ('granted' as const)
          : nativePush.permission === 'denied'
            ? ('denied' as const)
            : ('default' as const),
      isLoading: nativePush.isLoading,
      subscribe: nativePush.register,
      unsubscribe: nativePush.unregister,
      isNative: true,
      platform: 'native' as const,
      debug: nativePush.debug,
    };
  }

  return {
    isSupported: webPush.isSupported,
    isSubscribed: webPush.isSubscribed,
    permission: webPush.permission,
    isLoading: webPush.isLoading,
    subscribe: webPush.subscribe,
    unsubscribe: webPush.unsubscribe,
    isNative: false,
    platform: 'web' as const,
    debug: undefined,
  };
}
