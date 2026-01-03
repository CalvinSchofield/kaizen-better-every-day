import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// Convert base64 to Uint8Array for VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(true);
  const vapidKeyRef = useRef<string | null>(null);

  // Check if push notifications are supported and fetch VAPID key
  useEffect(() => {
    const checkSupport = async () => {
      const supported = 
        'serviceWorker' in navigator && 
        'PushManager' in window && 
        'Notification' in window;
      
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
        
        // Fetch VAPID public key from edge function
        try {
          const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
          if (!error && data?.vapidPublicKey) {
            vapidKeyRef.current = data.vapidPublicKey;
            console.log('VAPID public key loaded');
          } else {
            console.error('Failed to fetch VAPID key:', error);
          }
        } catch (err) {
          console.error('Error fetching VAPID key:', err);
        }
        
        // Check if already subscribed
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (error) {
          console.error('Error checking subscription:', error);
        }
      }
      
      setIsLoading(false);
    };

    checkSupport();
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !vapidKeyRef.current) {
      console.error('Push notifications not supported or VAPID key missing');
      return false;
    }

    try {
      // Request notification permission
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult !== 'granted') {
        console.log('Notification permission denied');
        return false;
      }

      // Get service worker registration
      const registration = await navigator.serviceWorker.ready;

      // Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKeyRef.current) as BufferSource
      });

      // Extract keys from subscription
      const subscriptionJson = subscription.toJSON();
      const { endpoint, keys } = subscriptionJson;

      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw new Error('Invalid subscription data');
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Save subscription to database
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,endpoint'
        });

      if (error) {
        throw error;
      }

      setIsSubscribed(true);
      console.log('Push notification subscription saved');
      return true;

    } catch (error) {
      console.error('Error subscribing to push notifications:', error);
      return false;
    }
  }, [isSupported]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Unsubscribe from push manager
        await subscription.unsubscribe();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Remove from database
          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
        }
      }

      setIsSubscribed(false);
      return true;

    } catch (error) {
      console.error('Error unsubscribing from push notifications:', error);
      return false;
    }
  }, []);

  return {
    isSupported,
    isSubscribed,
    permission,
    isLoading,
    subscribe,
    unsubscribe
  };
}
