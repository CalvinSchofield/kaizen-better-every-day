import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMeVsMe } from './useMeVsMe';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, getMonth } from 'date-fns';
import { getSeasonInfo } from '@/utils/seasonWeekUtils';

interface MeVsMeComparisonData {
  fpPlus: { current: number; historical: number };
  prmr: { current: number; historical: number };
  closes: { current: number; historical: number };
  presentations: { current: number; historical: number };
  transitions: { current: number; historical: number };
  hours: { current: number; historical: number };
  pitches: { current: number; historical: number };
  dms: { current: number; historical: number };
  doors: { current: number; historical: number };
}

export function useRecapMeVsMeComparison(period: 'week' | 'month') {
  const { isEnabled } = useMeVsMe();
  
  return useQuery({
    queryKey: ['recap-me-vs-me', period],
    queryFn: async (): Promise<{ comparison: MeVsMeComparisonData | null; comparisonYear: number; hasHistoricalData: boolean }> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { comparison: null, comparisonYear: 0, hasHistoricalData: false };

      const now = new Date();
      const seasonInfo = getSeasonInfo(now);
      const comparisonYear = seasonInfo.year - 1;
      
      if (period === 'week') {
        // Weekly: season-week aligned comparison
        // Get last week's data (current year)
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
        const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 0 });
        
        const currentStartStr = format(lastWeekStart, 'yyyy-MM-dd');
        const currentEndStr = format(lastWeekEnd, 'yyyy-MM-dd');
        
        // Get current week's entries
        const { data: currentEntries } = await supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_finalized', true)
          .gte('entry_date', currentStartStr)
          .lte('entry_date', currentEndStr);
        
        // Get season info for last week to find matching historical week
        const lastWeekSeasonInfo = getSeasonInfo(lastWeekStart);
        
        // Get historical entries for same season week from historical_entries
        const { data: historicalEntries } = await supabase
          .from('historical_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('season_year', comparisonYear)
          .eq('season_type', lastWeekSeasonInfo?.type || 'preseason')
          .eq('season_week', lastWeekSeasonInfo?.week || 1);
        
        if (!historicalEntries || historicalEntries.length === 0) {
          return { comparison: null, comparisonYear, hasHistoricalData: false };
        }
        
        return {
          comparison: calculateComparison(currentEntries || [], historicalEntries),
          comparisonYear,
          hasHistoricalData: true
        };
      } else {
        // Monthly: true calendar month comparison (Dec vs Dec, not season-aligned)
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        const lastMonthEnd = endOfMonth(lastMonthStart);
        const targetMonth = getMonth(lastMonthStart); // 0-11
        
        const currentStartStr = format(lastMonthStart, 'yyyy-MM-dd');
        const currentEndStr = format(lastMonthEnd, 'yyyy-MM-dd');
        
        // Get current month's entries
        const { data: currentEntries } = await supabase
          .from('daily_entries')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_finalized', true)
          .gte('entry_date', currentStartStr)
          .lte('entry_date', currentEndStr);
        
        // Get same calendar month from last year from historical_entries
        // We need to query by the original_date month
        const lastYearMonthStart = startOfMonth(subMonths(lastMonthStart, 12));
        const lastYearMonthEnd = endOfMonth(lastYearMonthStart);
        const lastYearStartStr = format(lastYearMonthStart, 'yyyy-MM-dd');
        const lastYearEndStr = format(lastYearMonthEnd, 'yyyy-MM-dd');
        
        const { data: historicalEntries } = await supabase
          .from('historical_entries')
          .select('*')
          .eq('user_id', user.id)
          .gte('original_date', lastYearStartStr)
          .lte('original_date', lastYearEndStr);
        
        if (!historicalEntries || historicalEntries.length === 0) {
          return { comparison: null, comparisonYear, hasHistoricalData: false };
        }
        
        return {
          comparison: calculateComparison(currentEntries || [], historicalEntries),
          comparisonYear,
          hasHistoricalData: true
        };
      }
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
  });
}

function calculateHoursFromEntry(entry: any): number {
  // For daily_entries (has work_start_time and work_end_time)
  if (entry.work_start_time && entry.work_end_time) {
    const start = new Date(entry.work_start_time);
    const end = new Date(entry.work_end_time);
    let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    
    if (entry.break_periods && Array.isArray(entry.break_periods)) {
      for (const breakPeriod of entry.break_periods) {
        if (breakPeriod.start && breakPeriod.end) {
          const breakStart = new Date(breakPeriod.start);
          const breakEnd = new Date(breakPeriod.end);
          totalMinutes -= (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
        }
      }
    }
    
    return Math.max(0, totalMinutes / 60);
  }
  
  // For historical_entries (has hours_worked directly)
  if (entry.hours_worked !== undefined && entry.hours_worked !== null) {
    return Number(entry.hours_worked) || 0;
  }
  
  return 0;
}

function calculateComparison(currentEntries: any[], historicalEntries: any[]): MeVsMeComparisonData {
  const sumCurrent = (field: string) => currentEntries.reduce((sum, e) => sum + (Number(e[field]) || 0), 0);
  const sumHistorical = (field: string) => historicalEntries.reduce((sum, e) => sum + (Number(e[field]) || 0), 0);
  
  const currentHours = currentEntries.reduce((sum, e) => sum + calculateHoursFromEntry(e), 0);
  const historicalHours = historicalEntries.reduce((sum, e) => sum + calculateHoursFromEntry(e), 0);
  
  return {
    fpPlus: { current: sumCurrent('fp_plus'), historical: sumHistorical('fp_plus') },
    prmr: { current: sumCurrent('prmr'), historical: sumHistorical('prmr') },
    closes: { current: sumCurrent('closes'), historical: sumHistorical('closes') },
    presentations: { current: sumCurrent('presentations'), historical: sumHistorical('presentations') },
    transitions: { current: sumCurrent('transitions'), historical: sumHistorical('transitions') },
    hours: { current: currentHours, historical: historicalHours },
    pitches: { current: sumCurrent('pitches'), historical: sumHistorical('pitches') },
    dms: { current: sumCurrent('decision_makers'), historical: sumHistorical('decision_makers') },
    doors: { current: sumCurrent('doors_knocked'), historical: sumHistorical('doors_knocked') },
  };
}
