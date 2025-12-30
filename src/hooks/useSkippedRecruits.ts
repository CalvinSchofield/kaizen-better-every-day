import { useState, useCallback, useEffect } from 'react';
import { endOfDay, isBefore } from 'date-fns';

const SESSION_STORAGE_KEY = 'kaizen-skipped-recruits-session';
const LOCAL_STORAGE_KEY = 'kaizen-skipped-recruits-today';

interface SkippedToday {
  ids: string[];
  expiresAt: string; // ISO string of midnight local time
}

/**
 * Temporary skip system for recruits.
 * - "Skip for now": sessionStorage (clears on navigation/tab close)
 * - "Skip today": localStorage with midnight expiration (local timezone)
 */
export const useSkippedRecruits = () => {
  const [sessionSkipped, setSessionSkipped] = useState<Set<string>>(new Set());
  const [todaySkipped, setTodaySkipped] = useState<Set<string>>(new Set());

  // Load from storage on mount
  useEffect(() => {
    // Load session skips
    const sessionCached = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (sessionCached) {
      try {
        const ids = JSON.parse(sessionCached);
        if (Array.isArray(ids)) {
          setSessionSkipped(new Set(ids));
        }
      } catch (e) {
        console.error('[SkippedRecruits] Error parsing session cache:', e);
      }
    }

    // Load today skips (with expiration check)
    const localCached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (localCached) {
      try {
        const data: SkippedToday = JSON.parse(localCached);
        const now = new Date();
        const expiresAt = new Date(data.expiresAt);
        
        // Check if still valid (before midnight)
        if (isBefore(now, expiresAt)) {
          setTodaySkipped(new Set(data.ids));
        } else {
          // Expired - clear storage
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      } catch (e) {
        console.error('[SkippedRecruits] Error parsing local cache:', e);
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  }, []);

  // Sync session skips to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify([...sessionSkipped]));
  }, [sessionSkipped]);

  // Sync today skips to localStorage
  useEffect(() => {
    if (todaySkipped.size === 0) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      return;
    }

    // Get end of today in local timezone
    const midnight = endOfDay(new Date());
    
    const data: SkippedToday = {
      ids: [...todaySkipped],
      expiresAt: midnight.toISOString(),
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  }, [todaySkipped]);

  const skipForNow = useCallback((recruitId: string) => {
    setSessionSkipped(prev => {
      const newSet = new Set(prev);
      newSet.add(recruitId);
      return newSet;
    });
  }, []);

  const skipToday = useCallback((recruitId: string) => {
    setTodaySkipped(prev => {
      const newSet = new Set(prev);
      newSet.add(recruitId);
      return newSet;
    });
  }, []);

  const unskip = useCallback((recruitId: string) => {
    setSessionSkipped(prev => {
      const newSet = new Set(prev);
      newSet.delete(recruitId);
      return newSet;
    });
    setTodaySkipped(prev => {
      const newSet = new Set(prev);
      newSet.delete(recruitId);
      return newSet;
    });
  }, []);

  const isSkipped = useCallback((recruitId: string) => {
    return sessionSkipped.has(recruitId) || todaySkipped.has(recruitId);
  }, [sessionSkipped, todaySkipped]);

  // Clear session skips (called when leaving page)
  const clearSessionSkips = useCallback(() => {
    setSessionSkipped(new Set());
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
  }, []);

  const totalSkipped = sessionSkipped.size + todaySkipped.size;

  return {
    skipForNow,
    skipToday,
    unskip,
    isSkipped,
    clearSessionSkips,
    sessionSkippedCount: sessionSkipped.size,
    todaySkippedCount: todaySkipped.size,
    totalSkipped,
  };
};
