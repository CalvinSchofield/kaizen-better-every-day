import { useState, useCallback, useEffect } from 'react';
import { format } from 'date-fns';

const STORAGE_KEY = 'dismissed-recruits';

interface DismissedData {
  date: string;
  recruitIds: string[];
}

export const useDismissedRecruits = () => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load dismissed recruits from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data: DismissedData = JSON.parse(stored);
        const today = format(new Date(), 'yyyy-MM-dd');
        
        // Only use stored data if it's from today
        if (data.date === today) {
          setDismissedIds(new Set(data.recruitIds));
        } else {
          // Clear old data
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const dismissRecruit = useCallback((recruitNotionId: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(recruitNotionId);
      
      // Save to localStorage
      const data: DismissedData = {
        date: format(new Date(), 'yyyy-MM-dd'),
        recruitIds: Array.from(newSet),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      return newSet;
    });
  }, []);

  const undismissRecruit = useCallback((recruitNotionId: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(recruitNotionId);
      
      // Save to localStorage
      const data: DismissedData = {
        date: format(new Date(), 'yyyy-MM-dd'),
        recruitIds: Array.from(newSet),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      
      return newSet;
    });
  }, []);

  const isRecuitDismissed = useCallback((recruitNotionId: string) => {
    return dismissedIds.has(recruitNotionId);
  }, [dismissedIds]);

  const clearDismissed = useCallback(() => {
    setDismissedIds(new Set());
    localStorage.removeItem(STORAGE_KEY);
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
