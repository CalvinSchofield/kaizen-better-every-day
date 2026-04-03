import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/utils/authSession';
import { clearAllRepCaches } from './useRepData';
import { persistTokensToNative, clearNativeTokens } from '@/utils/nativeTokenStorage';

// Shared localStorage key (used by useRepData too)
const USER_ID_STORAGE_KEY = 'kaizen-current-user-id';
const EXPECTED_SIGN_OUT_KEY = 'kaizen-expected-signout-at';
const EXPECTED_SIGN_OUT_WINDOW_MS = 15000;
const UNEXPECTED_SIGN_OUT_RETRY_MS = 4000;
const UNEXPECTED_SIGN_OUT_FINAL_RETRY_MS = 10000;
const UNEXPECTED_SIGN_OUT_SETTLE_MS = 1500;

/**
 * Get cached userId synchronously - for instant hydration
 */
const getCachedUserId = (): string | null => {
  try {
    return localStorage.getItem(USER_ID_STORAGE_KEY);
  } catch {
    return null;
  }
};

/**
 * Store userId for synchronous access across hooks
 */
const storeCachedUserId = (userId: string | null) => {
  try {
    if (userId) {
      localStorage.setItem(USER_ID_STORAGE_KEY, userId);
    } else {
      localStorage.removeItem(USER_ID_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
};

const consumeExpectedSignOut = () => {
  try {
    const raw = sessionStorage.getItem(EXPECTED_SIGN_OUT_KEY);
    sessionStorage.removeItem(EXPECTED_SIGN_OUT_KEY);

    if (!raw) return false;

    const timestamp = Number(raw);
    if (!Number.isFinite(timestamp)) return false;

    return Date.now() - timestamp < EXPECTED_SIGN_OUT_WINDOW_MS;
  } catch {
    return false;
  }
};

/**
 * Clear stale app caches when session ends or user switches.
 * Extracted to avoid duplicated logic.
 */
const clearStaleCaches = () => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('rep-') ||
        key.startsWith('season-config-cache-') ||
        key.startsWith('goals-setup-') ||
        key.startsWith('setup-status-cache:') ||
        key === 'current-user-id'
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Hook to reliably get the current user ID, preventing race conditions
 * where queries might run before auth is ready.
 * 
 * CRITICAL: This hook hydrates from localStorage IMMEDIATELY so that:
 * 1. User-scoped queries get the correct key on first render
 * 2. Persisted React Query cache is accessible instantly
 * 3. No "userId=null" render causes setup wizard flashes
 * 
 * Use this in any hook that needs to query user-specific data.
 */
export const useCurrentUserId = () => {
  // Initialize with cached userId for instant access (prevents flicker)
  const [userId, setUserId] = useState<string | null>(getCachedUserId);
  // isReady means we have verified auth state (not just cached)
  const [isReady, setIsReady] = useState(false);
  // authVerified means we've gotten a response from auth.getUser
  const [authVerified, setAuthVerified] = useState(false);
  const unexpectedSignOutRetryRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const cachedUserId = getCachedUserId();
    const AUTH_READY_TIMEOUT_MS = 4000;

    const clearUnexpectedSignOutRetry = () => {
      if (unexpectedSignOutRetryRef.current !== null) {
        window.clearTimeout(unexpectedSignOutRetryRef.current);
        unexpectedSignOutRetryRef.current = null;
      }
    };

    const finalizeSignedOut = () => {
      clearUnexpectedSignOutRetry();
      clearAllRepCaches();
      clearStaleCaches();
      clearNativeTokens(); // Wipe native storage on explicit sign-out
      setUserId(null);
      storeCachedUserId(null);
      setIsReady(true);
      setAuthVerified(true);
    };

    const verifyUnexpectedSignOut = async (fallbackUserId: string | null, attempt: 1 | 2 | 3 = 1) => {
      if (attempt === 1) {
        await new Promise((resolve) => window.setTimeout(resolve, UNEXPECTED_SIGN_OUT_SETTLE_MS));
      }

      const { user } = await getSessionSafe();

      if (!mounted) return;

      if (user?.id) {
        console.warn('[useCurrentUserId] Recovered session after unexpected SIGNED_OUT event');
        clearUnexpectedSignOutRetry();
        setUserId(user.id);
        storeCachedUserId(user.id);
        setIsReady(true);
        setAuthVerified(true);
        return;
      }

      if (fallbackUserId) {
        console.warn('[useCurrentUserId] Unexpected SIGNED_OUT not yet recovered; preserving cached identity');
        setUserId(fallbackUserId);
        storeCachedUserId(fallbackUserId);
        setIsReady(true);
        setAuthVerified(true);

        if (attempt < 3) {
          clearUnexpectedSignOutRetry();
          const retryDelay = attempt === 1
            ? UNEXPECTED_SIGN_OUT_RETRY_MS
            : UNEXPECTED_SIGN_OUT_FINAL_RETRY_MS;
          unexpectedSignOutRetryRef.current = window.setTimeout(() => {
            void verifyUnexpectedSignOut(fallbackUserId, attempt === 1 ? 2 : 3);
          }, retryDelay);
          return;
        }

        console.warn('[useCurrentUserId] Unable to verify session after repeated retries; keeping cached identity until explicit logout or recovery');
        return;
      }

      console.warn('[useCurrentUserId] Confirmed signed out after verification');
      finalizeSignedOut();
    };

    const getUser = async () => {
      type AuthResult = { userId: string | null; timedOut: boolean };

      let authResult: AuthResult;
      try {
        authResult = await Promise.race<AuthResult>([
          getSessionSafe().then(({ user }) => ({ userId: user?.id ?? null, timedOut: false })),
          new Promise<AuthResult>((resolve) =>
            setTimeout(() => resolve({ userId: cachedUserId, timedOut: true }), AUTH_READY_TIMEOUT_MS)
          ),
        ]);
      } catch {
        authResult = { userId: cachedUserId, timedOut: false };
      }

      if (!mounted) return;

      if (authResult.timedOut) {
        console.warn('[useCurrentUserId] Auth check timed out, using cached user id for recovery');
      }

      const newUserId = authResult.userId;

      clearUnexpectedSignOutRetry();

      // On native iOS we can transiently lose auth visibility even though a relaunch restores it.
      // Preserve the cached identity here and only clear caches on an explicit SIGNED_OUT event.
      if (cachedUserId && !newUserId) {
        console.warn('[useCurrentUserId] Auth returned no user; preserving cached user id until explicit sign-out');
        setUserId(cachedUserId);
        storeCachedUserId(cachedUserId);
        setIsReady(true);
        setAuthVerified(true);
        return;
      }

      // If user changed (e.g., different account), clear old user's caches
      if (cachedUserId && newUserId && cachedUserId !== newUserId) {
        console.log('[useCurrentUserId] User changed, clearing old caches');
        clearAllRepCaches();
      }

      setUserId(newUserId);
      storeCachedUserId(newUserId);
      setIsReady(true);
      setAuthVerified(true);
    };

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      const newUserId = session?.user?.id ?? null;
      const currentCached = getCachedUserId();
      
      // Only treat explicit sign-out as a real logout.
      if (event === 'SIGNED_OUT') {
        const expectedSignOut = consumeExpectedSignOut();

        if (expectedSignOut) {
          console.log('[useCurrentUserId] Auth change: expected sign-out confirmed, clearing caches');
          finalizeSignedOut();
          return;
        }

        console.warn('[useCurrentUserId] Unexpected SIGNED_OUT event received; verifying before clearing auth state');
        void verifyUnexpectedSignOut(currentCached, 1);
        return;
      }

      clearUnexpectedSignOutRetry();
      
      // If user changed, clear old caches
      if (currentCached && newUserId && currentCached !== newUserId) {
        console.log('[useCurrentUserId] Auth change: user switched, clearing caches');
        clearAllRepCaches();
      }

      if (!newUserId && currentCached) {
        console.warn(`[useCurrentUserId] Auth event ${event} returned no session; preserving cached user id`);
        setUserId(currentCached);
        storeCachedUserId(currentCached);
        setIsReady(true);
        setAuthVerified(true);
        return;
      }
      
      setUserId(newUserId);
      storeCachedUserId(newUserId);
      setIsReady(true);
      setAuthVerified(true);

      // Persist tokens to native storage on every auth state change
      if (newUserId) {
        persistTokensToNative();
      }
    });
    
    return () => {
      mounted = false;
      clearUnexpectedSignOutRetry();
      subscription.unsubscribe();
    };
  }, []);

  // hasCachedId: true if we have a cached userId (can render optimistically)
  // isReady: true if auth has been verified
  // authVerified: same as isReady, explicit naming for clarity
  return { 
    userId, 
    isReady, 
    authVerified,
    // Can use cached data immediately if we have a cached userId
    canUseCachedData: !!userId || isReady,
  };
};
