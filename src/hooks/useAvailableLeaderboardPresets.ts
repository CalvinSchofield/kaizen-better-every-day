import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
      // This query benefits from RLS policy "Users can view recent entries for live leaderboards"
      // which allows viewing entries from CURRENT_DATE - 1 day
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
    // Short stale time to quickly detect when someone starts working
    staleTime: 1000 * 60 * 2, // 2 minutes
    // Auto-refetch to catch new workers
    refetchInterval: 1000 * 60 * 2, // Every 2 minutes
  });
};

export const useAvailableLeaderboardPresets = () => {
  const queryClient = useQueryClient();
  const { data: boundary, isLoading } = useLeaderboardDataBoundary();

  // Subscribe to realtime changes on daily_entries to detect when someone starts working
  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-boundary-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_entries',
        },
        () => {
          // Invalidate boundary check when any entry changes (someone starts/updates work)
          queryClient.invalidateQueries({ queryKey: ['leaderboard-data-boundary'], refetchType: 'all' });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

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

  // Auto-select: prefer live if there's today's data, otherwise fall back to most relevant preset
  const getAutoSelectedPreset = (): TimeframeType => {
    const available = getAvailablePresets();
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    
    // Check if there's any activity today
    const entryDates = toEntryDateSet(boundary?.entryDates ?? []);
    const hasToday = entryDates.has(todayStr);
    
    // Only default to live if there's actually data today
    if (hasToday) {
      return 'live';
    }
    
    // Otherwise use the most recent/relevant timeframe with data
    if (available.includes('yesterday')) return 'yesterday';
    if (available.includes('week')) return 'week';
    if (available.includes('month')) return 'month';
    if (available.includes('season')) return 'season';
    
    // Fallback to live (will show empty state)
    return 'live';
  };

  return {
    availablePresets: getAvailablePresets(),
    autoSelectedPreset: getAutoSelectedPreset(),
    hasAnyData: boundary?.hasAnyData ?? false,
    isLoading,
  };
};
