import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { startOfWeek, endOfWeek, subWeeks, format } from 'date-fns';

export interface WeeklyStats {
  doors: number;
  dms: number;
  pitches: number;
  presentations: number;
  closes: number;
  fpPlus: number;
  prmr: number;
  hours: number;
  daysWorked: number;
}

export interface WeeklyComparisonData {
  thisWeek: WeeklyStats;
  lastWeek: WeeklyStats;
  delta: WeeklyStats;
  hasLastWeek: boolean;
  currentStreak: number;
}

const emptyStats: WeeklyStats = {
  doors: 0, dms: 0, pitches: 0, presentations: 0,
  closes: 0, fpPlus: 0, prmr: 0, hours: 0, daysWorked: 0,
};

function sumEntries(entries: any[]): WeeklyStats {
  const stats = { ...emptyStats };
  entries.forEach(e => {
    stats.doors += e.doors_knocked || 0;
    stats.dms += e.decision_makers || 0;
    stats.pitches += e.pitches || 0;
    stats.presentations += e.presentations || 0;
    stats.closes += e.closes || 0;
    stats.fpPlus += Number(e.fp_plus) || 0;
    stats.prmr += Number(e.prmr) || 0;
    stats.daysWorked += 1;
    if (e.work_start_time && e.work_end_time) {
      const start = new Date(e.work_start_time);
      const end = new Date(e.work_end_time);
      stats.hours += (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    }
  });
  return stats;
}

export const useWeeklyComparison = (enabled: boolean = true) => {
  const now = new Date();
  // Business week: Sun-Sat (weekStartsOn: 0)
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 0 });
  const thisWeekEnd = endOfWeek(now, { weekStartsOn: 0 });
  const lastWeekStart = subWeeks(thisWeekStart, 1);
  const lastWeekEnd = subWeeks(thisWeekEnd, 1);

  const { data: entries, isLoading } = useQuery({
    queryKey: ['weekly-comparison', format(thisWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (!user) return [];

      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('entry_date', format(lastWeekStart, 'yyyy-MM-dd'))
        .lte('entry_date', format(thisWeekEnd, 'yyyy-MM-dd'))
        .eq('is_finalized', true)
        .order('entry_date', { ascending: true });

      if (error) {
        console.error('Error fetching weekly comparison:', error);
        return [];
      }
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  // Also fetch streak (consecutive finalized days ending today or yesterday)
  const { data: streakEntries } = useQuery({
    queryKey: ['current-streak', format(now, 'yyyy-MM-dd')],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession(); const user = session?.user;
      if (!user) return [];

      // Fetch last 14 days to calculate streak
      const twoWeeksAgo = subWeeks(now, 2);
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', format(twoWeeksAgo, 'yyyy-MM-dd'))
        .lte('entry_date', format(now, 'yyyy-MM-dd'))
        .order('entry_date', { ascending: false });

      if (error) return [];
      return data;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const comparisonData = useMemo((): WeeklyComparisonData | null => {
    if (!entries) return null;

    const thisWeekStartStr = format(thisWeekStart, 'yyyy-MM-dd');
    const lastWeekStartStr = format(lastWeekStart, 'yyyy-MM-dd');
    const lastWeekEndStr = format(lastWeekEnd, 'yyyy-MM-dd');

    const thisWeekEntries = entries.filter(e =>
      e.entry_date >= thisWeekStartStr
    );
    const lastWeekEntries = entries.filter(e =>
      e.entry_date >= lastWeekStartStr && e.entry_date <= lastWeekEndStr
    );

    const thisWeek = sumEntries(thisWeekEntries);
    const lastWeek = sumEntries(lastWeekEntries);

    // Calculate streak
    let currentStreak = 0;
    if (streakEntries && streakEntries.length > 0) {
      const today = format(now, 'yyyy-MM-dd');
      const yesterday = format(subWeeks(now, 0), 'yyyy-MM-dd'); // just use dates set
      const dates = new Set(streakEntries.map(e => e.entry_date));

      // Start from today or yesterday and count backwards
      let checkDate = new Date(now);
      // If today isn't finalized, start from yesterday
      if (!dates.has(format(checkDate, 'yyyy-MM-dd'))) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (dates.has(format(checkDate, 'yyyy-MM-dd'))) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    return {
      thisWeek,
      lastWeek,
      delta: {
        doors: thisWeek.doors - lastWeek.doors,
        dms: thisWeek.dms - lastWeek.dms,
        pitches: thisWeek.pitches - lastWeek.pitches,
        presentations: thisWeek.presentations - lastWeek.presentations,
        closes: thisWeek.closes - lastWeek.closes,
        fpPlus: thisWeek.fpPlus - lastWeek.fpPlus,
        prmr: thisWeek.prmr - lastWeek.prmr,
        hours: thisWeek.hours - lastWeek.hours,
        daysWorked: thisWeek.daysWorked - lastWeek.daysWorked,
      },
      hasLastWeek: lastWeekEntries.length > 0,
      currentStreak,
    };
  }, [entries, streakEntries, thisWeekStart, lastWeekStart, lastWeekEnd, now]);

  return { comparisonData, isLoading };
};
