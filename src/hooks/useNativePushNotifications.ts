import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { App } from '@capacitor/app';
import { supabase } from '@/integrations/supabase/client';

type NativePushPermission = 'prompt' | 'granted' | 'denied';

type NativePushPhase =
  | 'init'
  | 'permission_checked'
  | 'register_called'
  | 'token_received'
  | 'token_saved'
  | 'error';

type NativePushDebug = {
  phase: NativePushPhase;
  lastRegistrationError?: string;
  lastRegistrationErrorAt?: string;
  lastTokenPrefix?: string;
  lastTokenAt?: string;
  lastTokenStoreError?: string;
};

/** Pending token waiting for an authenticated session */
let pendingToken: string | null = null;

export function useNativePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [permission, setPermission] = useState<NativePushPermission>('prompt');
  const [isLoading, setIsLoading] = useState(true);
  const [debug, setDebug] = useState<NativePushDebug>({ phase: 'init' });
  const listenersSetUp = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  // ── Store token for the current user (upsert) ──────────────────────
  const storeToken = useCallback(async (token: string): Promise<boolean> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const user = session?.user;
      if (!user) {
        // Park the token and retry when a session appears
        pendingToken = token;
        console.warn('[NativePush] No session – token parked for retry');
        setDebug(prev => ({ ...prev, lastTokenStoreError: 'No session – will retry' }));
        return false;
      }

      // Upsert: delete other tokens for this user, then upsert current one
      await supabase.from('apns_device_tokens').delete().eq('user_id', user.id).neq('device_token', token);

      const { error } = await supabase.from('apns_device_tokens').upsert(
        { user_id: user.id, device_token: token, platform: 'ios', updated_at: new Date().toISOString() },
        { onConflict: 'device_token' }
      );

      if (error) {
        console.error('[NativePush] Token store error:', error);
        setDebug(prev => ({ ...prev, phase: 'error', lastTokenStoreError: error.message }));
        return false;
      }

      console.log('[NativePush] Token stored ✓');
      pendingToken = null;
      setIsRegistered(true);
      setDebug(prev => ({ ...prev, phase: 'token_saved', lastTokenStoreError: undefined }));
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[NativePush] storeToken error:', msg);
      setDebug(prev => ({ ...prev, phase: 'error', lastTokenStoreError: msg }));
      return false;
    }
  }, []);

  // ── Check if token exists for current user ─────────────────────────
  const refreshStoredTokenFlag = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { count } = await supabase
        .from('apns_device_tokens')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setIsRegistered((count ?? 0) > 0);
    } catch (error) {
      console.warn('[NativePush] refreshStoredTokenFlag error:', error);
    }
  }, []);

  // ── Core: set up listeners + register ──────────────────────────────
  useEffect(() => {
    if (!isNative) {
      setIsSupported(false);
      setIsLoading(false);
      return;
    }

    setIsSupported(true);

    // Only set up listeners once
    if (listenersSetUp.current) {
      setIsLoading(false);
      return;
    }
    listenersSetUp.current = true;

    let isCancelled = false;

    const run = async () => {
      try {
        // ── Listeners ────────────────────────────────────────────
        const registrationListener = await PushNotifications.addListener('registration', async (token) => {
          const tokenPrefix = token.value?.slice(0, 12) || 'missing';
          console.log('[NativePush] registration event, prefix:', tokenPrefix);

          setDebug(prev => ({
            ...prev,
            phase: 'token_received',
            lastTokenPrefix: tokenPrefix,
            lastTokenAt: new Date().toISOString(),
            lastTokenStoreError: undefined,
          }));

          await storeToken(token.value);
        });

        const errorListener = await PushNotifications.addListener('registrationError', (error) => {
          const message = (error as any)?.error || (error as any)?.message || JSON.stringify(error);
          console.error('[NativePush] registrationError:', message);
          setDebug(prev => ({
            ...prev,
            phase: 'error',
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
          if (data?.url) window.location.href = data.url;
        });

        // ── Permission check + register ──────────────────────────
        const permStatus = await PushNotifications.checkPermissions();
        console.log('[NativePush] Permission:', permStatus.receive);
        setDebug(prev => ({ ...prev, phase: 'permission_checked' }));

        if (permStatus.receive === 'granted') {
          setPermission('granted');
          setDebug(prev => ({ ...prev, phase: 'register_called' }));
          await PushNotifications.register();
        } else if (permStatus.receive === 'denied') {
          setPermission('denied');
        } else {
          const result = await PushNotifications.requestPermissions();
          if (result.receive === 'granted') {
            setPermission('granted');
            setDebug(prev => ({ ...prev, phase: 'register_called' }));
            await PushNotifications.register();
          } else {
            setPermission('denied');
          }
        }

        await refreshStoredTokenFlag();

        if (!isCancelled) setIsLoading(false);

        // ── Resume listener: re-register when app comes back ─────
        const resumeListener = await App.addListener('resume', async () => {
          console.log('[NativePush] App resumed – re-registering');
          try {
            const perm = await PushNotifications.checkPermissions();
            if (perm.receive === 'granted') {
              await PushNotifications.register();
            }
            // Retry parked token
            if (pendingToken) {
              await storeToken(pendingToken);
            }
            await refreshStoredTokenFlag();
          } catch (err) {
            console.warn('[NativePush] Resume re-register error:', err);
          }
        });

        return () => {
          registrationListener.remove();
          errorListener.remove();
          receivedListener.remove();
          actionListener.remove();
          resumeListener.remove();
        };
      } catch (error) {
        console.error('[NativePush] Init error:', error);
        if (!isCancelled) setIsLoading(false);
      }
    };

    const cleanupPromise = run();
    return () => {
      isCancelled = true;
      void cleanupPromise.then(cleanup => cleanup?.());
    };
  }, [isNative, storeToken, refreshStoredTokenFlag]);

  // ── Retry parked token when auth state changes ─────────────────────
  useEffect(() => {
    if (!isNative) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && pendingToken) {
        console.log('[NativePush] Auth event – retrying parked token');
        await storeToken(pendingToken);
      }
      // Always refresh flag on sign-in
      if (event === 'SIGNED_IN') {
        await refreshStoredTokenFlag();
      }
    });

    return () => subscription.unsubscribe();
  }, [isNative, storeToken, refreshStoredTokenFlag]);

  // ── Public API ─────────────────────────────────────────────────────
  const register = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      const permResult = await PushNotifications.requestPermissions();
      if (permResult.receive !== 'granted') {
        setPermission('denied');
        return false;
      }
      setPermission('granted');
      setDebug(prev => ({ ...prev, phase: 'register_called' }));
      await PushNotifications.register();
      // Token will arrive via listener → storeToken
      await refreshStoredTokenFlag();
      return true;
    } catch (error) {
      console.error('[NativePush] register() error:', error);
      return false;
    }
  }, [isNative, refreshStoredTokenFlag]);

  const unregister = useCallback(async (): Promise<boolean> => {
    if (!isNative) return false;
    try {
      try { await PushNotifications.unregister(); } catch {}
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('apns_device_tokens').delete().eq('user_id', session.user.id);
      }
      setIsRegistered(false);
      setDebug(prev => ({ ...prev, phase: 'init' }));
      return true;
    } catch (error) {
      console.error('[NativePush] unregister() error:', error);
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
    refreshStoredTokenFlag,
  };
}
