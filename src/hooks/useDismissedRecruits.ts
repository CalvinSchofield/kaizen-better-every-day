import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'kaizen-dismissed-recruits';

/**
 * Session-based dismissed recruits tracking.
 * Dismissed recruits persist in sessionStorage across page navigations
 * but are cleared on full browser refresh/session end.
 */
export const useDismissedRecruits = () => {
  // Initialize from sessionStorage
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {
      console.error('[DismissedRecruits] Error reading from sessionStorage:', e);
    }
    return new Set();
  });

  // Persist to sessionStorage whenever dismissedIds changes
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissedIds]));
    } catch (e) {
      console.error('[DismissedRecruits] Error writing to sessionStorage:', e);
    }
  }, [dismissedIds]);

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

  const clearDismissed = useCallback(() => {
    setDismissedIds(new Set());
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignore
    }
  }, []);

  return {
    dismissedIds,
    dismissRecruit,
    undismissRecruit,
    isRecuitDismissed,
    clearDismissed,
    dismissedCount: dismissedIds.size,
  };
};
