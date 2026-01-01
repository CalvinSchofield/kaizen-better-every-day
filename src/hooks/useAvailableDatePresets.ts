import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, subDays, subMonths, endOfMonth, format, endOfWeek } from 'date-fns';

// Preseason dates - fixed constants
export const PRESEASON_START = new Date('2025-09-28');
export const SUMMER_START = new Date('2026-04-12');

export type InsightsDatePreset = 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'custom';
export type ReportsDatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'preseason' | 'ytd' | 'custom';

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

    // This month - only if we have actual entries this month
    const monthStart = startOfMonth(now);
    if (hasEntriesInRange(entryDates, monthStart, now)) {
      available.push('month');
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

// Team version - checks data for team members
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

export const useAvailableTeamReportsPresets = (userIds: string[]) => {
  const { data: boundary, isLoading } = useTeamDataBoundary(userIds);

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

    // Order from smallest to largest
    const available: ReportsDatePreset[] = [];

    // Today - only if we have entries today
    if (entryDates.has(format(now, 'yyyy-MM-dd'))) {
      available.push('today');
    }

    // Yesterday - only if we have entries yesterday
    const yesterday = subDays(now, 1);
    if (entryDates.has(format(yesterday, 'yyyy-MM-dd'))) {
      available.push('yesterday');
    }

    // This week - only if we have entries this week
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    if (hasEntriesInRange(entryDates, weekStart, weekEnd)) {
      available.push('week');
    }

    // This month - only if we have entries this month
    const monthStart = startOfMonth(now);
    if (hasEntriesInRange(entryDates, monthStart, now)) {
      available.push('month');
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
