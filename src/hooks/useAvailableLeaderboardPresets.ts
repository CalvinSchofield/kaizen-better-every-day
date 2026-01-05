import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, startOfMonth, subDays, subMonths, endOfMonth, format, endOfWeek } from 'date-fns';
import type { TimeframeType } from './useExpandedLeaderboard';

type EntryDateString = string;

interface LeaderboardDataBoundary {
  hasAnyData: boolean;
  entryDates: EntryDateString[];
}

const toEntryDateSet = (entryDates: EntryDateString[]) => new Set(entryDates);

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

export const useLeaderboardDataBoundary = () => {
  return useQuery({
    queryKey: ['leaderboard-data-boundary'],
    queryFn: async (): Promise<LeaderboardDataBoundary> => {
      // Get all entries that have at least some activity (any door knocked OR any sales)
      // Include unfinalized entries since they're valid for leaderboard
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, is_finalized, doors_knocked')
        .or('doors_knocked.gte.1,fp_plus.gte.1,prmr.gte.1')
        .order('entry_date', { ascending: true });

      if (error || !entries || entries.length === 0) {
        return { hasAnyData: false, entryDates: [] };
      }

      const entryDates = Array.from(new Set(entries.map(e => e.entry_date)));

      return {
        hasAnyData: true,
        entryDates,
      };
    },
    staleTime: 1000 * 60 * 5,
  });
};

export const useAvailableLeaderboardPresets = () => {
  const { data: boundary, isLoading } = useLeaderboardDataBoundary();

  const getAvailablePresets = (): TimeframeType[] => {
    if (!boundary?.hasAnyData) {
      return ['live']; // Always show live even with no data
    }

    const entryDatesRaw = Array.isArray(boundary.entryDates) ? boundary.entryDates : [];
    if (entryDatesRaw.length === 0) {
      return ['live'];
    }

    const now = new Date();
    const entryDates = toEntryDateSet(entryDatesRaw);

    // Order from smallest to largest - live is always first
    const available: TimeframeType[] = ['live'];

    // Yesterday
    const yesterday = subDays(now, 1);
    if (entryDates.has(format(yesterday, 'yyyy-MM-dd'))) {
      available.push('yesterday');
    }

    // This week
    const weekStart = startOfWeek(now, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 0 });
    if (hasEntriesInRange(entryDates, weekStart, weekEnd)) {
      available.push('week');
    }

    // This month
    const monthStart = startOfMonth(now);
    if (hasEntriesInRange(entryDates, monthStart, now)) {
      available.push('month');
    }

    // Season (always available if any data)
    available.push('season');

    // YTD (always available if any data)
    available.push('ytd');

    return available;
  };

  // Auto-select: ALWAYS prefer live first - the Live Race section handles empty states gracefully
  // Live is the most engaging view and should be the default during active work hours
  const getAutoSelectedPreset = (): TimeframeType => {
    // Always default to live - it shows real-time data and handles empty states well
    return 'live';
  };

  return {
    availablePresets: getAvailablePresets(),
    autoSelectedPreset: getAutoSelectedPreset(),
    hasAnyData: boundary?.hasAnyData ?? false,
    isLoading,
  };
};
