import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from 'date-fns';
import { getSeasonInfo, mapToComparisonDate, SeasonType } from '@/utils/seasonWeekUtils';
import { useMeVsMe } from './useMeVsMe';

interface HistoricalDayData {
  fpPlus: number;
  prmr: number;
  hoursWorked: number;
}

interface CumulativeComparison {
  currentTotal: number;
  historicalTotal: number;
  delta: number;
  throughDayNumber: number;
  seasonType: SeasonType;
}

export const useCalendarHistorical = (
  currentDate: Date,
  viewMode: 'week' | 'month',
  entries: any[]
) => {
  const { isEnabled } = useMeVsMe();
  
  // Get the season year from the current date, then subtract 1 for comparison
  // E.g., Dec 2025 is 2026 preseason, so compare to 2025 preseason
  const currentSeasonInfo = getSeasonInfo(currentDate);
  const comparisonYear = currentSeasonInfo ? currentSeasonInfo.year - 1 : new Date().getFullYear() - 1;

  // Fetch historical entries for the comparison period
  const { data: historicalData, isLoading } = useQuery({
    queryKey: ['calendar-historical', comparisonYear, format(currentDate, 'yyyy-MM')],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get all historical entries for the comparison year
      const { data: entries, error } = await supabase
        .from('historical_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('season_year', comparisonYear);

      if (error) throw error;
      return entries || [];
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
  });

  // Map historical data to calendar days
  const historicalByDate = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return new Map<string, HistoricalDayData>();

    const map = new Map<string, HistoricalDayData>();

    // Build lookup by season_type, week, day_of_week
    const historicalLookup = new Map<string, any>();
    historicalData.forEach(entry => {
      const key = `${entry.season_type}-${entry.season_week}-${entry.day_of_week}`;
      historicalLookup.set(key, entry);
    });

    // Get current view's date range
    const viewStart = viewMode === 'week' 
      ? startOfWeek(currentDate)
      : startOfMonth(currentDate);
    const viewEnd = viewMode === 'week'
      ? endOfWeek(currentDate)
      : endOfMonth(currentDate);

    // For each day in the current view, find matching historical entry
    const days = eachDayOfInterval({ start: viewStart, end: viewEnd });
    
    days.forEach(day => {
      const seasonInfo = getSeasonInfo(day);
      if (!seasonInfo) return;

      const key = `${seasonInfo.type}-${seasonInfo.week}-${seasonInfo.dayOfWeek}`;
      const historicalEntry = historicalLookup.get(key);

      if (historicalEntry) {
        map.set(format(day, 'yyyy-MM-dd'), {
          fpPlus: historicalEntry.fp_plus || 0,
          prmr: historicalEntry.prmr || 0,
          hoursWorked: historicalEntry.hours_worked || 0,
        });
      }
    });

    return map;
  }, [historicalData, currentDate, viewMode]);

  // Calculate cumulative comparison ("through this point" in the season)
  const cumulativeComparison = useMemo((): CumulativeComparison | null => {
    if (!historicalData || historicalData.length === 0) return null;

    const today = new Date();
    const todaySeasonInfo = getSeasonInfo(today);
    if (!todaySeasonInfo) return null;

    // Calculate current cumulative (from all entries in current season up to today)
    const currentCumulative = entries.reduce((sum, entry) => {
      if (!entry.is_finalized) return sum;
      const entryDate = new Date(entry.entry_date + 'T12:00:00');
      const entrySeasonInfo = getSeasonInfo(entryDate);
      if (!entrySeasonInfo) return sum;
      
      // Same season type and year as current
      if (entrySeasonInfo.type !== todaySeasonInfo.type) return sum;
      if (entrySeasonInfo.year !== todaySeasonInfo.year) return sum;
      
      // Must be on or before today in season progression
      if (entrySeasonInfo.week > todaySeasonInfo.week) return sum;
      if (entrySeasonInfo.week === todaySeasonInfo.week && entrySeasonInfo.dayOfWeek > todaySeasonInfo.dayOfWeek) return sum;
      
      return sum + (entry.fp_plus || 0);
    }, 0);

    // Calculate historical cumulative (same point last year)
    const historicalCumulative = historicalData.reduce((sum, entry) => {
      if (entry.season_type !== todaySeasonInfo.type) return sum;
      
      // Must be on or before equivalent day in historical season
      if (entry.season_week > todaySeasonInfo.week) return sum;
      if (entry.season_week === todaySeasonInfo.week && entry.day_of_week > todaySeasonInfo.dayOfWeek) return sum;
      
      return sum + (entry.fp_plus || 0);
    }, 0);

    // Calculate day number in season (week * 7 + day)
    const throughDayNumber = (todaySeasonInfo.week - 1) * 7 + todaySeasonInfo.dayOfWeek + 1;

    return {
      currentTotal: currentCumulative,
      historicalTotal: historicalCumulative,
      delta: currentCumulative - historicalCumulative,
      throughDayNumber,
      seasonType: todaySeasonInfo.type,
    };
  }, [entries, historicalData]);

  // Calculate period historical totals (this week vs same week last year)
  // IMPORTANT: Use latest FINALIZED entry date, not calendar date - saving signals day complete
  const periodHistoricalTotals = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return null;

    // Get the season info for the start of the current view period
    const viewStart = viewMode === 'week' 
      ? startOfWeek(currentDate)
      : startOfMonth(currentDate);
    const viewEnd = viewMode === 'week'
      ? endOfWeek(currentDate)
      : endOfMonth(currentDate);
    
    const startSeasonInfo = getSeasonInfo(viewStart);
    if (!startSeasonInfo) return null;

    // Find the latest FINALIZED entry within the current view period
    // This determines "through which day" we compare - finalization signals day complete
    const today = new Date();
    const isCurrentWeek = viewMode === 'week' && 
      today >= startOfWeek(currentDate) && today <= endOfWeek(currentDate);
    const isCurrentMonth = viewMode === 'month' && 
      today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();

    // Get finalized entries in the current view period
    const periodFinalizedEntries = entries.filter(e => {
      if (!e.is_finalized) return false;
      const entryDate = new Date(e.entry_date + 'T12:00:00');
      return entryDate >= viewStart && entryDate <= viewEnd;
    });

    // Find the latest finalized date in this period
    let latestFinalizedDate: Date | null = null;
    if (periodFinalizedEntries.length > 0) {
      const sortedEntries = [...periodFinalizedEntries].sort((a, b) => 
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
      );
      latestFinalizedDate = new Date(sortedEntries[0].entry_date + 'T12:00:00');
    }

    // Determine the cutoff for historical comparison
    // If viewing current period: use latest finalized entry's day position
    // If viewing past period: include all days (full comparison)
    const throughDayOfWeek = latestFinalizedDate ? latestFinalizedDate.getDay() : -1; // -1 means no finalized entries
    const throughDayOfMonth = latestFinalizedDate ? latestFinalizedDate.getDate() : 0;

    if (viewMode === 'week') {
      // Week comparison: same season week, but only through latest finalized day if current week
      const weekTotal = historicalData
        .filter(e => {
          if (e.season_type !== startSeasonInfo.type || e.season_week !== startSeasonInfo.week) return false;
          // If viewing current week, only count historical days up through latest finalized day
          if (isCurrentWeek && e.day_of_week > throughDayOfWeek) return false;
          return true;
        })
        .reduce((sum, e) => sum + (e.fp_plus || 0), 0);
      
      const weekPrmr = historicalData
        .filter(e => {
          if (e.season_type !== startSeasonInfo.type || e.season_week !== startSeasonInfo.week) return false;
          if (isCurrentWeek && e.day_of_week > throughDayOfWeek) return false;
          return true;
        })
        .reduce((sum, e) => sum + (e.prmr || 0), 0);

      return { 
        fpPlus: weekTotal, 
        prmr: weekPrmr, 
        week: startSeasonInfo.week, 
        throughToday: isCurrentWeek,
        latestFinalizedDate 
      };
    } else {
      // Month comparison: same calendar month, but only through latest finalized day if current month
      const monthNum = currentDate.getMonth();
      const monthTotal = historicalData
        .filter(e => {
          const originalDate = new Date(e.original_date + 'T12:00:00');
          if (originalDate.getMonth() !== monthNum) return false;
          // If viewing current month, only count historical days up through latest finalized day
          if (isCurrentMonth && originalDate.getDate() > throughDayOfMonth) return false;
          return true;
        })
        .reduce((sum, e) => sum + (e.fp_plus || 0), 0);
      
      const monthPrmr = historicalData
        .filter(e => {
          const originalDate = new Date(e.original_date + 'T12:00:00');
          if (originalDate.getMonth() !== monthNum) return false;
          if (isCurrentMonth && originalDate.getDate() > throughDayOfMonth) return false;
          return true;
        })
        .reduce((sum, e) => sum + (e.prmr || 0), 0);

      return { 
        fpPlus: monthTotal, 
        prmr: monthPrmr, 
        throughToday: isCurrentMonth,
        latestFinalizedDate 
      };
    }
  }, [historicalData, currentDate, viewMode, entries]);

  return {
    historicalByDate,
    cumulativeComparison,
    periodHistoricalTotals,
    comparisonYear,
    hasHistoricalData: (historicalData?.length || 0) > 0,
    isLoading,
    isEnabled,
  };
};
