import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, subDays, subMonths, endOfMonth, format, endOfWeek } from 'date-fns';

// Preseason dates - fixed constants
export const PRESEASON_START = new Date('2025-09-28');
export const SUMMER_START = new Date('2026-04-12');

export type InsightsDatePreset = 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'custom';
export type ReportsDatePreset = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'ytd' | 'custom';

type EntryDateString = string; // yyyy-MM-dd

interface DataBoundary {
  earliestDate: EntryDateString | null;
  latestDate: EntryDateString | null;
  hasAnyData: boolean;
  // Store entry dates for checking actual working days in periods (serializable for cache persistence)
  entryDates: EntryDateString[];
}

const toEntryDateSet = (entryDates: EntryDateString[]) => new Set(entryDates);

export const useDataBoundary = () => {
  return useQuery({
    // v3 busts persisted cache from older non-serializable shapes (Set/Date)
    queryKey: ['data-boundary-v3'],
    queryFn: async (): Promise<DataBoundary> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { earliestDate: null, latestDate: null, hasAnyData: false, entryDates: [] };
      }

      // Get only "worked" days (finalized + had a real knocking session)
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('doors_knocked', 4)
        .not('work_start_time', 'is', null)
        .not('work_end_time', 'is', null)
        .order('entry_date', { ascending: true });

      if (error || !entries || entries.length === 0) {
        return { earliestDate: null, latestDate: null, hasAnyData: false, entryDates: [] };
      }

      const earliestDate = entries[0].entry_date;
      const latestDate = entries[entries.length - 1].entry_date;
      const entryDates = Array.from(new Set(entries.map(e => e.entry_date)));

      return {
        earliestDate,
        latestDate,
        hasAnyData: true,
        entryDates,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Helper to check if any entries exist within a date range
const hasEntriesInRange = (entryDates: Set<EntryDateString>, start: Date, end: Date): boolean => {
  const current = new Date(start);
  while (current <= end) {
    if (entryDates.has(format(current, 'yyyy-MM-dd'))) {
      return true;
    }
    current.setDate(current.getDate() + 1);
  }
  return false;
};

export const useAvailableInsightsPresets = () => {
  const { data: boundary, isLoading } = useDataBoundary();

  const getAvailablePresets = (): InsightsDatePreset[] => {
    if (!boundary?.hasAnyData) {
      return ['preseason'];
    }

    const entryDatesRaw = Array.isArray(boundary.entryDates) ? boundary.entryDates : [];
    if (entryDatesRaw.length === 0) {
      return ['preseason'];
    }

    const now = new Date();
    const entryDates = toEntryDateSet(entryDatesRaw);

    // Order from smallest to largest (auto-select first/smallest)
    const available: InsightsDatePreset[] = [];

    // Yesterday - only if we actually have an entry for yesterday
    const yesterday = subDays(now, 1);
    if (entryDates.has(format(yesterday, 'yyyy-MM-dd'))) {
      available.push('yesterday');
    }

    // This week - only if we have actual entries this week
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    if (hasEntriesInRange(entryDates, weekStart, weekEnd)) {
      available.push('week');
    }

    // Last week - only if we have actual entries last week
    const lastWeekStart = subDays(weekStart, 7);
    const lastWeekEnd = subDays(weekStart, 1);
    if (hasEntriesInRange(entryDates, lastWeekStart, lastWeekEnd)) {
      available.push('lastWeek');
    }

    // This month - only if we have actual entries this month
    const monthStart = startOfMonth(now);
    if (hasEntriesInRange(entryDates, monthStart, now)) {
      available.push('month');
    }

    // Last month - only if we have actual entries last month
    const lastMonthDate = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);
    if (hasEntriesInRange(entryDates, lastMonthStart, lastMonthEnd)) {
      available.push('lastMonth');
    }

    // Preseason - always available if any data exists
    available.push('preseason');

    return available;
  };

  return {
    availablePresets: getAvailablePresets(),
    hasAnyData: boundary?.hasAnyData ?? false,
    isLoading,
    earliestDate: boundary?.earliestDate,
  };
};

export const useAvailableReportsPresets = () => {
  const { data: boundary, isLoading } = useDataBoundary();

  const getAvailablePresets = (): ReportsDatePreset[] => {
    if (!boundary?.hasAnyData) {
      return ['preseason'];
    }

    const entryDatesRaw = Array.isArray(boundary.entryDates) ? boundary.entryDates : [];
    if (entryDatesRaw.length === 0) {
      return ['preseason'];
    }

    const now = new Date();
    const entryDates = toEntryDateSet(entryDatesRaw);

    // Order from smallest to largest (auto-select first/smallest)
    const available: ReportsDatePreset[] = [];

    // Today - only if we have an entry for today
    if (entryDates.has(format(now, 'yyyy-MM-dd'))) {
      available.push('today');
    }

    // Yesterday - only if we have an entry for yesterday
    const yesterday = subDays(now, 1);
    if (entryDates.has(format(yesterday, 'yyyy-MM-dd'))) {
      available.push('yesterday');
    }

    // This week - only if we have actual entries this week
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    if (hasEntriesInRange(entryDates, weekStart, weekEnd)) {
      available.push('week');
    }

    // Last week - only if we have entries last week
    const lastWeekStart = subDays(weekStart, 7);
    const lastWeekEnd = subDays(weekStart, 1);
    if (hasEntriesInRange(entryDates, lastWeekStart, lastWeekEnd)) {
      available.push('lastWeek');
    }

    // This month - only if we have actual entries this month
    const monthStart = startOfMonth(now);
    if (hasEntriesInRange(entryDates, monthStart, now)) {
      available.push('month');
    }

    // Last month - only if we have entries last month
    const lastMonthDate = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);
    if (hasEntriesInRange(entryDates, lastMonthStart, lastMonthEnd)) {
      available.push('lastMonth');
    }

    // Preseason - always available if any data exists
    available.push('preseason');

    // YTD - always available if any data exists
    available.push('ytd');

    return available;
  };

  return {
    availablePresets: getAvailablePresets(),
    hasAnyData: boundary?.hasAnyData ?? false,
    isLoading,
    earliestDate: boundary?.earliestDate,
  };
};

// Team version - checks data for team members (finalized only - for historical presets)
export const useTeamDataBoundary = (userIds: string[]) => {
  return useQuery({
    // v3 busts persisted cache from older non-serializable shapes (Set/Date)
    queryKey: ['team-data-boundary-v3', userIds],
    queryFn: async (): Promise<DataBoundary> => {
      if (!userIds.length) {
        return { earliestDate: null, latestDate: null, hasAnyData: false, entryDates: [] };
      }

      // Get only "worked" days for the team (finalized + had a real knocking session)
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .in('user_id', userIds)
        .eq('is_finalized', true)
        .gte('doors_knocked', 4)
        .not('work_start_time', 'is', null)
        .not('work_end_time', 'is', null)
        .order('entry_date', { ascending: true });

      if (error || !entries || entries.length === 0) {
        return { earliestDate: null, latestDate: null, hasAnyData: false, entryDates: [] };
      }

      const earliestDate = entries[0].entry_date;
      const latestDate = entries[entries.length - 1].entry_date;
      const entryDates = Array.from(new Set(entries.map(e => e.entry_date)));

      return {
        earliestDate,
        latestDate,
        hasAnyData: true,
        entryDates,
      };
    },
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// Team version for LIVE data - includes unfinalized entries for "today" detection
export const useTeamLiveDataBoundary = (userIds: string[]) => {
  return useQuery({
    queryKey: ['team-live-data-boundary', userIds],
    queryFn: async (): Promise<DataBoundary> => {
      if (!userIds.length) {
        return { earliestDate: null, latestDate: null, hasAnyData: false, entryDates: [] };
      }

      // Include unfinalized entries for live/today detection - any activity counts
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .in('user_id', userIds)
        .or('doors_knocked.gte.1,fp_plus.gte.1,prmr.gte.1')
        .order('entry_date', { ascending: true });

      if (error || !entries || entries.length === 0) {
        return { earliestDate: null, latestDate: null, hasAnyData: false, entryDates: [] };
      }

      const entryDates = Array.from(new Set(entries.map(e => e.entry_date)));
      return {
        earliestDate: entryDates[0],
        latestDate: entryDates[entryDates.length - 1],
        hasAnyData: true,
        entryDates,
      };
    },
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes for more responsive live updates
    refetchInterval: 1000 * 60 * 2, // Auto-refetch every 2 minutes to catch when downline starts working
  });
};

export const useAvailableTeamReportsPresets = (userIds: string[]) => {
  const queryClient = useQueryClient();
  const { data: liveBoundary, isFetching: liveFetching } = useTeamLiveDataBoundary(userIds);
  const { data: finalizedBoundary, isLoading, isFetching } = useTeamDataBoundary(userIds);

  // Subscribe to realtime changes to detect when downline starts working
  useEffect(() => {
    const channel = supabase
      .channel('reports-boundary-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_entries',
        },
        () => {
          // Invalidate boundary checks when any entry changes
          queryClient.invalidateQueries({ queryKey: ['team-live-data-boundary'], refetchType: 'all' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getAvailablePresets = (): ReportsDatePreset[] => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    
    // Use live boundary to check for today's data
    const liveEntryDates = toEntryDateSet(liveBoundary?.entryDates ?? []);
    // Use finalized boundary for historical data
    const finalizedEntryDates = toEntryDateSet(finalizedBoundary?.entryDates ?? []);

    // Order from smallest to largest
    const available: ReportsDatePreset[] = [];

    // Today/Live - check live boundary (includes unfinalized)
    if (liveEntryDates.has(todayStr)) {
      available.push('today');
    }

    // Yesterday - check finalized boundary
    const yesterday = subDays(now, 1);
    if (finalizedEntryDates.has(format(yesterday, 'yyyy-MM-dd'))) {
      available.push('yesterday');
    }

    // This week - check finalized boundary
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    if (hasEntriesInRange(finalizedEntryDates, weekStart, weekEnd)) {
      available.push('week');
    }

    // Last week
    const lastWeekStart = subDays(weekStart, 7);
    const lastWeekEnd = subDays(weekStart, 1);
    if (hasEntriesInRange(finalizedEntryDates, lastWeekStart, lastWeekEnd)) {
      available.push('lastWeek');
    }

    // This month
    const monthStart = startOfMonth(now);
    if (hasEntriesInRange(finalizedEntryDates, monthStart, now)) {
      available.push('month');
    }

    // Last month
    const lastMonthDate = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);
    if (hasEntriesInRange(finalizedEntryDates, lastMonthStart, lastMonthEnd)) {
      available.push('lastMonth');
    }

    // Preseason - always available if any data exists
    if (finalizedBoundary?.hasAnyData || liveBoundary?.hasAnyData) {
      available.push('preseason');
    }

    // YTD - always available if any data exists
    if (finalizedBoundary?.hasAnyData || liveBoundary?.hasAnyData) {
      available.push('ytd');
    }

    return available;
  };

  // Smart auto-selection logic - prioritize live if available, then fall back
  const getAutoSelectedPreset = (): ReportsDatePreset => {
    const available = getAvailablePresets();
    
    // Priority order: today (live) > yesterday > week > lastWeek > month > lastMonth > preseason
    const priority: ReportsDatePreset[] = ['today', 'yesterday', 'week', 'lastWeek', 'month', 'lastMonth', 'preseason', 'ytd'];
    
    for (const preset of priority) {
      if (available.includes(preset)) {
        return preset;
      }
    }
    
    return 'preseason';
  };

  return {
    availablePresets: getAvailablePresets(),
    autoSelectedPreset: getAutoSelectedPreset(),
    hasAnyData: finalizedBoundary?.hasAnyData || liveBoundary?.hasAnyData || false,
    isLoading,
    isFetching: isFetching || liveFetching,
    earliestDate: finalizedBoundary?.earliestDate,
  };
};
