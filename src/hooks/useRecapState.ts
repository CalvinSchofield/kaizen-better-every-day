import { useState, useEffect, useCallback } from 'react';
import { startOfWeek, subWeeks, startOfMonth, subMonths, format, isAfter, isBefore, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface RecapState {
  weekRecapAvailable: boolean;
  monthRecapAvailable: boolean;
  weekRecapViewed: boolean;
  monthRecapViewed: boolean;
  markWeekViewed: () => void;
  markMonthViewed: () => void;
  weekPeriodKey: string;
  monthPeriodKey: string;
}

function getStorageKey(userId: string, type: 'week' | 'month', periodKey: string): string {
  return `recap-viewed-${userId}-${type}-${periodKey}`;
}

export function useRecapState(): RecapState {
  const [userId, setUserId] = useState<string | null>(null);
  const [weekRecapViewed, setWeekRecapViewed] = useState(true);
  const [monthRecapViewed, setMonthRecapViewed] = useState(true);

  const now = new Date();
  
  // Week recap available Sun night through Tuesday (day 0-2)
  const dayOfWeek = now.getDay();
  const weekRecapAvailable = dayOfWeek >= 0 && dayOfWeek <= 2;
  
  // Month recap available 1st through 5th
  const dayOfMonth = now.getDate();
  const monthRecapAvailable = dayOfMonth >= 1 && dayOfMonth <= 5;

  // Period keys for storage
  const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
  const weekPeriodKey = format(lastWeekStart, 'yyyy-MM-dd');
  
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const monthPeriodKey = format(lastMonthStart, 'yyyy-MM');

  useEffect(() => {
    const loadState = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      setUserId(user.id);

      // Check if already viewed
      const weekKey = getStorageKey(user.id, 'week', weekPeriodKey);
      const monthKey = getStorageKey(user.id, 'month', monthPeriodKey);
      
      setWeekRecapViewed(localStorage.getItem(weekKey) === 'true');
      setMonthRecapViewed(localStorage.getItem(monthKey) === 'true');
    };

    loadState();
  }, [weekPeriodKey, monthPeriodKey]);

  const markWeekViewed = useCallback(() => {
    if (userId) {
      const key = getStorageKey(userId, 'week', weekPeriodKey);
      localStorage.setItem(key, 'true');
      setWeekRecapViewed(true);
    }
  }, [userId, weekPeriodKey]);

  const markMonthViewed = useCallback(() => {
    if (userId) {
      const key = getStorageKey(userId, 'month', monthPeriodKey);
      localStorage.setItem(key, 'true');
      setMonthRecapViewed(true);
    }
  }, [userId, monthPeriodKey]);

  return {
    weekRecapAvailable,
    monthRecapAvailable,
    weekRecapViewed,
    monthRecapViewed,
    markWeekViewed,
    markMonthViewed,
    weekPeriodKey,
    monthPeriodKey
  };
}
