import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

type NativePushPermission = 'prompt' | 'granted' | 'denied';

type NativePushDebug = {
  lastRegistrationError?: string;
  lastRegistrationErrorAt?: string;
  lastTokenPrefix?: string;
  lastTokenAt?: string;
  lastTokenStoreError?: string;
};

export function useNativePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [permission, setPermission] = useState<NativePushPermission>('prompt');
  const [isLoading, setIsLoading] = useState(true);
  const [debug, setDebug] = useState<NativePushDebug>({});

  // Check if we're running as a native app
  const isNative = Capacitor.isNativePlatform();

  const refreshStoredTokenFlag = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tokens } = await supabase
        .from('apns_device_tokens')
        .select('id')
        .limit(1);

      setIsRegistered(!!tokens?.length);
    } catch (error) {
      console.warn('[NativePush] Failed to refresh stored token flag:', error);
    }
  }, []);

  useEffect(() => {
    if (!isNative) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setIsSupported(true);

    let isCancelled = false;

    const run = async () => {
      try {
        // 1) Register listeners FIRST (prevents missing the registration event)
        const registrationListener = await PushNotifications.addListener('registration', async (token) => {
          const tokenPrefix = token.value?.slice(0, 12) || 'missing';
          console.log('[NativePush] Registration success, token prefix:', tokenPrefix);

          setDebug((prev) => ({
            ...prev,
            lastTokenPrefix: tokenPrefix,
            lastTokenAt: new Date().toISOString(),
            lastTokenStoreError: undefined,
          }));

          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
              console.error('[NativePush] No authenticated user');
              return;
            }

            // Delete any old tokens for this user first (device token may have changed)
            await supabase
              .from('apns_device_tokens')
              .delete()
              .eq('user_id', user.id);

            // Insert the new token
            const { error } = await supabase
              .from('apns_device_tokens')
              .insert({
                user_id: user.id,
                device_token: token.value,
                platform: 'ios',
              });

            if (error) {
              console.error('[NativePush] Error storing token:', error);
              setDebug((prev) => ({
                ...prev,
                lastTokenStoreError: error.message,
              }));
              return;
            }

            console.log('[NativePush] Token stored successfully');
            setIsRegistered(true);
          } catch (err) {
            console.error('[NativePush] Error in registration handler:', err);
            setDebug((prev) => ({
              ...prev,
              lastTokenStoreError: err instanceof Error ? err.message : String(err),
            }));
          }
        });

        const errorListener = await PushNotifications.addListener('registrationError', (error) => {
          console.error('[NativePush] Registration error:', error);
          const message = (error as any)?.error || (error as any)?.message || JSON.stringify(error);
          setDebug((prev) => ({
            ...prev,
            lastRegistrationError: message,
            lastRegistrationErrorAt: new Date().toISOString(),
          }));
        });

        const receivedListener = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[NativePush] Notification received:', notification);
        });

        const actionListener = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[NativePush] Action performed:', action);

          const data = action.notification.data as any;
          if (data?.url) {
            window.location.href = data.url;
          }
        });

        // 2) Permission + register
        const permStatus = await PushNotifications.checkPermissions();
        console.log('[NativePush] Permission status:', permStatus.receive);

        if (permStatus.receive === 'granted') {
          setPermission('granted');
          await PushNotifications.register();
        } else if (permStatus.receive === 'denied') {
          setPermission('denied');
        } else {
          console.log('[NativePush] Requesting permission...');
          const result = await PushNotifications.requestPermissions();
          console.log('[NativePush] Permission result:', result.receive);

          if (result.receive === 'granted') {
            setPermission('granted');
            await PushNotifications.register();
          } else {
            setPermission('denied');
          }
        }

        // 3) Confirm backend token state (helpful if token existed already)
        await refreshStoredTokenFlag();

        if (!isCancelled) {
          setIsLoading(false);
        }

        return () => {
          registrationListener.remove();
          errorListener.remove();
          receivedListener.remove();
          actionListener.remove();
        };
      } catch (error) {
        console.error('[NativePush] Error initializing:', error);
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    const cleanupPromise = run();

    return () => {
      isCancelled = true;
      void cleanupPromise.then((cleanup) => cleanup?.());
    };
  }, [isNative, refreshStoredTokenFlag]);

  const register = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      console.log('[NativePush] Not a native platform');
      return false;
    }

    try {
      const permResult = await PushNotifications.requestPermissions();
      console.log('[NativePush] Permission result:', permResult.receive);

      if (permResult.receive !== 'granted') {
        setPermission('denied');
        return false;
      }

      setPermission('granted');
      await PushNotifications.register();
      console.log('[NativePush] Registered with APNs');

      await refreshStoredTokenFlag();
      return true;
    } catch (error) {
      console.error('[NativePush] Error registering:', error);
      return false;
    }
  }, [isNative, refreshStoredTokenFlag]);

  const unregister = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('apns_device_tokens')
          .delete()
          .eq('user_id', user.id);
      }

      setIsRegistered(false);
      return true;
    } catch (error) {
      console.error('[NativePush] Error unregistering:', error);
      return false;
    }
  }, [isNative]);

  return {
    isSupported,
    isRegistered,
    permission,
    isLoading,
    isNative,
    register,
    unregister,
    debug,
  };
}

