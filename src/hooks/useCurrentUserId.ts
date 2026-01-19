import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (!mounted) return;
      
      const newUserId = user?.id ?? null;
      
      // CRITICAL: If we had a cached userId but auth returns null/error,
      // the session is invalid/expired - clear all caches to prevent stale data display
      if (cachedUserId && !newUserId) {
        console.log('[useCurrentUserId] Session invalid/expired, clearing all caches');
        clearAllRepCaches();
        // Also clear other app caches that might cause stale UI
        try {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.startsWith('rep-') ||
              key.startsWith('season-config-cache-') ||
              key.startsWith('goals-setup-') ||
              key === 'current-user-id' // Also clear the inconsistent key used by useAppMode
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch {
          // Ignore storage errors
        }
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
      
      // Handle session expiry/logout - clear all caches
      if (currentCached && !newUserId) {
        console.log('[useCurrentUserId] Auth change: session ended, clearing caches');
        clearAllRepCaches();
        try {
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (
              key.startsWith('rep-') ||
              key.startsWith('season-config-cache-') ||
              key.startsWith('goals-setup-') ||
              key === 'current-user-id'
            )) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
        } catch {
          // Ignore storage errors
        }
      }
      
      // If user changed, clear old caches
      if (currentCached && newUserId && currentCached !== newUserId) {
        console.log('[useCurrentUserId] Auth change: user switched, clearing caches');
        clearAllRepCaches();
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
