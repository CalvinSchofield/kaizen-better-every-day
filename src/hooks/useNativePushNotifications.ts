import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { supabase } from '@/integrations/supabase/client';

export function useNativePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [permission, setPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isLoading, setIsLoading] = useState(true);

  // Check if we're running as a native app
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    const init = async () => {
      if (!isNative) {
        setIsSupported(false);
        setIsLoading(false);
        return;
      }

      setIsSupported(true);

      try {
        // Check current permission status
        const permStatus = await PushNotifications.checkPermissions();
        console.log('[NativePush] Permission status:', permStatus.receive);
        
        if (permStatus.receive === 'granted') {
          setPermission('granted');
          // Check if we have a token stored
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: tokens } = await supabase
              .from('apns_device_tokens')
              .select('id')
              .eq('user_id', user.id)
              .limit(1);
            setIsRegistered(!!tokens?.length);
          }
        } else if (permStatus.receive === 'denied') {
          setPermission('denied');
        }
      } catch (error) {
        console.error('[NativePush] Error checking permissions:', error);
      }

      setIsLoading(false);
    };

    init();
  }, [isNative]);

  // Set up push notification listeners
  useEffect(() => {
    if (!isNative) return;

    // Handle registration success
    const registrationListener = PushNotifications.addListener('registration', async (token) => {
      console.log('[NativePush] Registration success, token:', token.value);
      
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
            platform: 'ios'
          });

        if (error) {
          console.error('[NativePush] Error storing token:', error);
        } else {
          console.log('[NativePush] Token stored successfully');
          setIsRegistered(true);
        }
      } catch (err) {
        console.error('[NativePush] Error in registration handler:', err);
      }
    });

    // Handle registration error
    const errorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('[NativePush] Registration error:', error);
    });

    // Handle push notification received while app is in foreground
    const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[NativePush] Notification received:', notification);
    });

    // Handle push notification action (user tapped on notification)
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[NativePush] Action performed:', action);
      
      // Handle deep linking based on notification data
      const data = action.notification.data;
      if (data?.url) {
        window.location.href = data.url;
      }
    });

    // Cleanup listeners on unmount
    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      receivedListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [isNative]);

  // Request permission and register for push notifications
  const register = useCallback(async (): Promise<boolean> => {
    if (!isNative) {
      console.log('[NativePush] Not a native platform');
      return false;
    }

    try {
      // Request permission
      const permResult = await PushNotifications.requestPermissions();
      console.log('[NativePush] Permission result:', permResult.receive);

      if (permResult.receive !== 'granted') {
        setPermission('denied');
        return false;
      }

      setPermission('granted');

      // Register with APNs
      await PushNotifications.register();
      console.log('[NativePush] Registered with APNs');
      
      return true;
    } catch (error) {
      console.error('[NativePush] Error registering:', error);
      return false;
    }
  }, [isNative]);

  // Unregister from push notifications
  const unregister = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Remove all tokens for this user
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
    unregister
  };
}
