import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { format } from 'date-fns';

const STORAGE_KEY = 'kaizen-dismissed-recruits';
const DATE_KEY = 'kaizen-dismissed-date';

/**
 * Dismissed recruits tracking - resets daily.
 * When you contact/schedule a recruit, they're dismissed for the REST OF TODAY only.
 * The list automatically clears at midnight (when the date changes).
 */
export const useDismissedRecruits = () => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isLoaded, setIsLoaded] = useState(false);
  const isSyncing = useRef(false);

  // Get today's date string for comparison
  const getTodayString = () => format(new Date(), 'yyyy-MM-dd');

  // Load from database on mount, with daily reset logic
  useEffect(() => {
    const loadFromDatabase = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsLoaded(true);
          return;
        }

        const today = getTodayString();
        
        // Check if we need to reset (new day)
        const lastDismissedDate = localStorage.getItem(DATE_KEY);
        const needsReset = lastDismissedDate !== today;

        if (needsReset) {
          // New day - clear everything
          console.log('[DismissedRecruits] New day detected, clearing dismissed list');
          setDismissedIds(new Set());
          sessionStorage.removeItem(STORAGE_KEY);
          localStorage.setItem(DATE_KEY, today);
          
          // Clear in database
          await supabase
            .from('reps')
            .update({ dismissed_recruit_ids: [] })
            .eq('user_id', user.id);
          
          setIsLoaded(true);
          return;
        }

        // Same day - load from cache/database
        // First check sessionStorage for fast initial load
        const cached = sessionStorage.getItem(STORAGE_KEY);
        if (cached) {
          try {
            const cachedIds = JSON.parse(cached);
            if (Array.isArray(cachedIds)) {
              setDismissedIds(new Set(cachedIds));
            }
          } catch (e) {
            console.error('[DismissedRecruits] Error parsing cache:', e);
          }
        }

        // Then load from database (in case of cross-device sync same day)
        const { data: repData, error } = await supabase
          .from('reps')
          .select('dismissed_recruit_ids')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('[DismissedRecruits] Error loading from database:', error);
          setIsLoaded(true);
          return;
        }

        if (repData?.dismissed_recruit_ids) {
          const dbIds = Array.isArray(repData.dismissed_recruit_ids) 
            ? repData.dismissed_recruit_ids as string[]
            : [];
          setDismissedIds(new Set(dbIds));
          // Update session cache
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(dbIds));
        }

        setIsLoaded(true);
      } catch (e) {
        console.error('[DismissedRecruits] Error in loadFromDatabase:', e);
        setIsLoaded(true);
      }
    };

    loadFromDatabase();
  }, []);

  // Sync to database when dismissedIds changes (debounced)
  useEffect(() => {
    if (!isLoaded || isSyncing.current) return;

    const syncToDatabase = async () => {
      isSyncing.current = true;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const idsArray = [...dismissedIds];
        
        // Update session cache immediately
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(idsArray));
        // Also update the date
        localStorage.setItem(DATE_KEY, getTodayString());

        // Sync to database
        const { error } = await supabase
          .from('reps')
          .update({ dismissed_recruit_ids: idsArray })
          .eq('user_id', user.id);

        if (error) {
          console.error('[DismissedRecruits] Error syncing to database:', error);
        }
      } catch (e) {
        console.error('[DismissedRecruits] Error in syncToDatabase:', e);
      } finally {
        isSyncing.current = false;
      }
    };

    // Debounce sync to avoid too many requests
    const timeout = setTimeout(syncToDatabase, 500);
    return () => clearTimeout(timeout);
  }, [dismissedIds, isLoaded]);

  const dismissRecruit = useCallback((recruitNotionId: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(recruitNotionId);
      return newSet;
    });
  }, []);

  const undismissRecruit = useCallback((recruitNotionId: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(recruitNotionId);
      return newSet;
    });
  }, []);

  const isRecuitDismissed = useCallback((recruitNotionId: string) => {
    return dismissedIds.has(recruitNotionId);
  }, [dismissedIds]);

  const clearDismissed = useCallback(async () => {
    setDismissedIds(new Set());
    sessionStorage.removeItem(STORAGE_KEY);
    
    // Also clear in database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('reps')
          .update({ dismissed_recruit_ids: [] })
          .eq('user_id', user.id);
      }
    } catch (e) {
      console.error('[DismissedRecruits] Error clearing in database:', e);
    }
  }, []);

  return {
    dismissedIds,
    dismissRecruit,
    undismissRecruit,
    isRecuitDismissed,
    clearDismissed,
    dismissedCount: dismissedIds.size,
    isLoaded,
  };
};
