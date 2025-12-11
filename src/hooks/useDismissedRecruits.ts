import { useState, useCallback } from 'react';

/**
 * Session-based dismissed recruits tracking.
 * Dismissed recruits are cleared on page refresh/session end.
 * This allows cycling through ALL recruits needing attention, showing 5 at a time.
 */
export const useDismissedRecruits = () => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

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
