import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from '@/utils/authSession';
import { clearAllRepCaches } from './useRepData';

// Shared localStorage key (used by useRepData too)
const USER_ID_STORAGE_KEY = 'kaizen-current-user-id';

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

  useEffect(() => {
    let mounted = true;
    const cachedUserId = getCachedUserId();
    const AUTH_READY_TIMEOUT_MS = 4000;

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
        console.log('[useCurrentUserId] Auth change: session ended, clearing caches');
        clearAllRepCaches();
        clearStaleCaches();
        setUserId(null);
        storeCachedUserId(null);
        setIsReady(true);
        setAuthVerified(true);
        return;
      }
      
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
    });
    
    return () => {
      mounted = false;
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
