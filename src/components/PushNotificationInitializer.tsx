import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { Geolocation } from '@capacitor/geolocation';
import { supabase } from '@/integrations/supabase/client';

/**
 * Component that initializes push notifications and location permissions on app startup.
 * This runs after authentication to ensure we have a user to associate the token with.
 */
export function PushNotificationInitializer() {
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    if (!isNative) return;

    const initializePushNotifications = async () => {
      try {
        // Check if user is authenticated
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('[PushInit] No authenticated user, skipping push registration');
          return;
        }

        // Check current permission status
        const permStatus = await PushNotifications.checkPermissions();
        console.log('[PushInit] Permission status:', permStatus.receive);

        if (permStatus.receive === 'granted') {
          // Already granted, ensure we're registered
          console.log('[PushInit] Permission already granted, registering...');
          await PushNotifications.register();
        } else if (permStatus.receive === 'prompt') {
          // Request permission
          console.log('[PushInit] Requesting permission...');
          const result = await PushNotifications.requestPermissions();
          console.log('[PushInit] Permission result:', result.receive);
          
          if (result.receive === 'granted') {
            await PushNotifications.register();
            console.log('[PushInit] Registered after permission grant');
          }
        }
      } catch (error) {
        console.error('[PushInit] Error initializing push notifications:', error);
      }
    };

    const initializeLocationPermissions = async () => {
      try {
        const permStatus = await Geolocation.checkPermissions();
        console.log('[LocationInit] Permission status:', permStatus.location);

        if (permStatus.location === 'prompt' || permStatus.location === 'prompt-with-rationale') {
          console.log('[LocationInit] Requesting location permission...');
          const result = await Geolocation.requestPermissions();
          console.log('[LocationInit] Permission result:', result.location);
        } else if (permStatus.location === 'granted') {
          console.log('[LocationInit] Location permission already granted');
        }
      } catch (error) {
        console.error('[LocationInit] Error requesting location permission:', error);
      }
    };

    // Set up push registration listener to store token
    const setupListeners = async () => {
      // Handle registration success
      const registrationListener = await PushNotifications.addListener('registration', async (token) => {
        console.log('[PushInit] Registration success, token:', token.value);
        
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            console.error('[PushInit] No authenticated user for token storage');
            return;
          }

          // Delete any old tokens for this user first
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
            console.error('[PushInit] Error storing token:', error);
          } else {
            console.log('[PushInit] Token stored successfully for user:', user.id);
          }
        } catch (err) {
          console.error('[PushInit] Error in registration handler:', err);
        }
      });

      // Handle registration error
      const errorListener = await PushNotifications.addListener('registrationError', (error) => {
        console.error('[PushInit] Registration error:', error);
      });

      // Initialize push notifications first, then location
      await initializePushNotifications();
      
      // Small delay between permission prompts for better UX
      setTimeout(async () => {
        await initializeLocationPermissions();
      }, 1000);

      return () => {
        registrationListener.remove();
        errorListener.remove();
      };
    };

    setupListeners();
  }, []);

  return null; // This component doesn't render anything
}
