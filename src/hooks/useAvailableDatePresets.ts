import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, subDays, subMonths, endOfMonth, startOfYear, isAfter, isBefore } from 'date-fns';

export type InsightsDatePreset = 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'custom';
export type ReportsDatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'preseason' | 'ytd' | 'custom';

interface DataBoundary {
  earliestDate: Date | null;
  latestDate: Date | null;
  hasAnyData: boolean;
}

export const useDataBoundary = () => {
  return useQuery({
    queryKey: ['data-boundary'],
    queryFn: async (): Promise<DataBoundary> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { earliestDate: null, latestDate: null, hasAnyData: false };
      }

      // Get earliest and latest entry dates
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .eq('user_id', user.id)
        .order('entry_date', { ascending: true });

      if (error || !entries || entries.length === 0) {
        return { earliestDate: null, latestDate: null, hasAnyData: false };
      }

      const earliestDate = new Date(entries[0].entry_date + 'T00:00:00');
      const latestDate = new Date(entries[entries.length - 1].entry_date + 'T00:00:00');

      return {
        earliestDate,
        latestDate,
        hasAnyData: true,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAvailableInsightsPresets = () => {
  const { data: boundary, isLoading } = useDataBoundary();

  const getAvailablePresets = (): InsightsDatePreset[] => {
    if (!boundary?.hasAnyData) {
      return ['preseason']; // Only YTD/preseason as fallback
    }

    const now = new Date();
    const { earliestDate, latestDate } = boundary;
    if (!earliestDate || !latestDate) return ['preseason'];

    const available: InsightsDatePreset[] = [];
    
    // Yesterday - only if we have data from yesterday or before
    const yesterday = subDays(now, 1);
    if (!isAfter(yesterday, latestDate) && !isBefore(yesterday, earliestDate)) {
      available.push('yesterday');
    }

    // This week - if data overlaps with current week
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    if (!isAfter(weekStart, latestDate)) {
      available.push('week');
    }

    // Last week - if data overlaps with last week
    const lastWeekStart = subDays(weekStart, 7);
    const lastWeekEnd = subDays(weekStart, 1);
    if (!isAfter(lastWeekStart, latestDate) && !isBefore(lastWeekEnd, earliestDate)) {
      available.push('lastWeek');
    }

    // This month - if data overlaps with current month
    const monthStart = startOfMonth(now);
    if (!isAfter(monthStart, latestDate)) {
      available.push('month');
    }

    // Last month - if data overlaps with last month
    const lastMonthDate = subMonths(now, 1);
    const lastMonthStart = startOfMonth(lastMonthDate);
    const lastMonthEnd = endOfMonth(lastMonthDate);
    if (!isAfter(lastMonthStart, latestDate) && !isBefore(lastMonthEnd, earliestDate)) {
      available.push('lastMonth');
    }

    // Preseason/YTD - always available if any data exists
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
      return ['ytd']; // Only YTD as fallback
    }

    const now = new Date();
    const { earliestDate, latestDate } = boundary;
    if (!earliestDate || !latestDate) return ['ytd'];

    const available: ReportsDatePreset[] = [];
    
    // Today - always show but might be empty
    available.push('today');

    // Yesterday - only if we have data from yesterday or before
    const yesterday = subDays(now, 1);
    if (!isAfter(yesterday, latestDate) && !isBefore(yesterday, earliestDate)) {
      available.push('yesterday');
    }

    // This week - if data overlaps with current week
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    if (!isAfter(weekStart, latestDate)) {
      available.push('week');
    }

    // This month - if data overlaps with current month
    const monthStart = startOfMonth(now);
    if (!isAfter(monthStart, latestDate)) {
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
    queryKey: ['team-data-boundary', userIds],
    queryFn: async (): Promise<DataBoundary> => {
      if (!userIds.length) {
        return { earliestDate: null, latestDate: null, hasAnyData: false };
      }

      // Get earliest and latest entry dates for the team
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .in('user_id', userIds)
        .order('entry_date', { ascending: true });

      if (error || !entries || entries.length === 0) {
        return { earliestDate: null, latestDate: null, hasAnyData: false };
      }

      const earliestDate = new Date(entries[0].entry_date + 'T00:00:00');
      const latestDate = new Date(entries[entries.length - 1].entry_date + 'T00:00:00');

      return {
        earliestDate,
        latestDate,
        hasAnyData: true,
      };
    },
    enabled: userIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAvailableTeamReportsPresets = (userIds: string[]) => {
  const { data: boundary, isLoading } = useTeamDataBoundary(userIds);

  const getAvailablePresets = (): ReportsDatePreset[] => {
    // Always show today for live view
    const available: ReportsDatePreset[] = ['today'];
    
    if (!boundary?.hasAnyData) {
      available.push('ytd'); // YTD as fallback
      return available;
    }

    const now = new Date();
    const { earliestDate, latestDate } = boundary;
    if (!earliestDate || !latestDate) {
      available.push('ytd');
      return available;
    }
    
    // Yesterday - only if we have data from yesterday or before
    const yesterday = subDays(now, 1);
    if (!isAfter(yesterday, latestDate) && !isBefore(yesterday, earliestDate)) {
      available.push('yesterday');
    }

    // This week - if data overlaps with current week
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    if (!isAfter(weekStart, latestDate)) {
      available.push('week');
    }

    // This month - if data overlaps with current month
    const monthStart = startOfMonth(now);
    if (!isAfter(monthStart, latestDate)) {
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
