import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSeasonInfo, getComparisonSeasonInfo, SeasonInfo, SeasonType } from '@/utils/seasonWeekUtils';
import { useMemo } from 'react';

export interface HistoricalEntry {
  id: string;
  season_year: number;
  season_type: SeasonType;
  season_week: number;
  day_of_week: number;
  original_date: string;
  doors_knocked: number;
  decision_makers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp_plus: number;
  prmr: number;
  upgrade_prmr: number;
  hours_worked: number;
}

export interface ComparisonData {
  current: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fpPlus: number;
    prmr: number;
    hours: number;
  };
  historical: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fpPlus: number;
    prmr: number;
    hours: number;
  };
  delta: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fpPlus: number;
    prmr: number;
    hours: number;
  };
}

interface UseHistoricalComparisonParams {
  startDate: Date;
  endDate: Date;
  comparisonYear: number;
  enabled?: boolean;
}

export const useHistoricalComparison = ({
  startDate,
  endDate,
  comparisonYear,
  enabled = true,
}: UseHistoricalComparisonParams) => {
  // Get current season info for date range
  const currentSeasonInfo = useMemo(() => getSeasonInfo(startDate), [startDate]);
  const endSeasonInfo = useMemo(() => getSeasonInfo(endDate), [endDate]);
  
  // Fetch historical entries for comparison year
  const { data: historicalEntries, isLoading: loadingHistorical } = useQuery({
    queryKey: ['historical-entries', comparisonYear, currentSeasonInfo?.type, currentSeasonInfo?.week, endSeasonInfo?.week],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      if (!currentSeasonInfo || !endSeasonInfo) return [];
      
      const { data, error } = await supabase
        .from('historical_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('season_year', comparisonYear)
        .eq('season_type', currentSeasonInfo.type)
        .gte('season_week', currentSeasonInfo.week)
        .lte('season_week', endSeasonInfo.week)
        .order('season_week', { ascending: true })
        .order('day_of_week', { ascending: true });
      
      if (error) {
        console.error('Error fetching historical entries:', error);
        return [];
      }
      
      return data as HistoricalEntry[];
    },
    enabled: enabled && !!currentSeasonInfo && !!endSeasonInfo,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch current period data
  const { data: currentEntries, isLoading: loadingCurrent } = useQuery({
    queryKey: ['current-entries-comparison', startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('entry_date', startDate.toISOString().split('T')[0])
        .lte('entry_date', endDate.toISOString().split('T')[0])
        .eq('is_finalized', true)
        .order('entry_date', { ascending: true });
      
      if (error) {
        console.error('Error fetching current entries:', error);
        return [];
      }
      
      return data;
    },
    enabled: enabled,
    staleTime: 5 * 60 * 1000,
  });

  // Aggregate comparison data
  const comparisonData = useMemo((): ComparisonData | null => {
    if (!currentEntries || !historicalEntries) return null;
    
    const currentTotals = {
      doors: 0, dms: 0, pitches: 0, transitions: 0,
      presentations: 0, closes: 0, fpPlus: 0, prmr: 0, hours: 0,
    };
    
    const historicalTotals = {
      doors: 0, dms: 0, pitches: 0, transitions: 0,
      presentations: 0, closes: 0, fpPlus: 0, prmr: 0, hours: 0,
    };
    
    // Sum current entries
    currentEntries.forEach(entry => {
      currentTotals.doors += entry.doors_knocked || 0;
      currentTotals.dms += entry.decision_makers || 0;
      currentTotals.pitches += entry.pitches || 0;
      currentTotals.transitions += entry.transitions || 0;
      currentTotals.presentations += entry.presentations || 0;
      currentTotals.closes += entry.closes || 0;
      currentTotals.fpPlus += Number(entry.fp_plus) || 0;
      currentTotals.prmr += Number(entry.prmr) || 0;
      
      // Calculate hours from timestamps
      if (entry.work_start_time && entry.work_end_time) {
        const start = new Date(entry.work_start_time);
        const end = new Date(entry.work_end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        currentTotals.hours += hours;
      }
    });
    
    // Sum historical entries
    historicalEntries.forEach(entry => {
      historicalTotals.doors += entry.doors_knocked || 0;
      historicalTotals.dms += entry.decision_makers || 0;
      historicalTotals.pitches += entry.pitches || 0;
      historicalTotals.transitions += entry.transitions || 0;
      historicalTotals.presentations += entry.presentations || 0;
      historicalTotals.closes += entry.closes || 0;
      historicalTotals.fpPlus += Number(entry.fp_plus) || 0;
      historicalTotals.prmr += Number(entry.prmr) || 0;
      historicalTotals.hours += Number(entry.hours_worked) || 0;
    });
    
    return {
      current: currentTotals,
      historical: historicalTotals,
      delta: {
        doors: currentTotals.doors - historicalTotals.doors,
        dms: currentTotals.dms - historicalTotals.dms,
        pitches: currentTotals.pitches - historicalTotals.pitches,
        transitions: currentTotals.transitions - historicalTotals.transitions,
        presentations: currentTotals.presentations - historicalTotals.presentations,
        closes: currentTotals.closes - historicalTotals.closes,
        fpPlus: currentTotals.fpPlus - historicalTotals.fpPlus,
        prmr: currentTotals.prmr - historicalTotals.prmr,
        hours: currentTotals.hours - historicalTotals.hours,
      },
    };
  }, [currentEntries, historicalEntries]);

  // Check if user has historical data for comparison year
  const { data: hasHistoricalData } = useQuery({
    queryKey: ['has-historical-data', comparisonYear],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      
      const { count, error } = await supabase
        .from('historical_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('season_year', comparisonYear);
      
      if (error) return false;
      return (count || 0) > 0;
    },
    enabled: enabled,
    staleTime: 30 * 60 * 1000,
  });

  return {
    comparisonData,
    historicalEntries,
    currentEntries,
    hasHistoricalData: hasHistoricalData || false,
    isLoading: loadingHistorical || loadingCurrent,
    currentSeasonInfo,
  };
};

export const useHistoricalCumulativeData = (comparisonYear: number, enabled: boolean = true, seasonType?: SeasonType) => {
  // Determine current season type if not provided
  const currentSeasonInfo = useMemo(() => getSeasonInfo(new Date()), []);
  const targetSeasonType = seasonType || currentSeasonInfo?.type || 'preseason';
  
  return useQuery({
    queryKey: ['historical-cumulative', comparisonYear, targetSeasonType],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      
      // Only fetch data for the matching season type (preseason vs preseason, summer vs summer)
      const { data, error } = await supabase
        .from('historical_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('season_year', comparisonYear)
        .eq('season_type', targetSeasonType)
        .order('season_week', { ascending: true })
        .order('day_of_week', { ascending: true });
      
      if (error) {
        console.error('Error fetching historical cumulative data:', error);
        return [];
      }
      
      // Convert to cumulative data points
      let cumulativeFp = 0;
      let cumulativePrmr = 0;
      
      return data.map((entry, idx) => {
        cumulativeFp += Number(entry.fp_plus) || 0;
        cumulativePrmr += Number(entry.prmr) || 0;
        
        return {
          date: entry.original_date,
          seasonWeek: entry.season_week,
          dayOfWeek: entry.day_of_week,
          seasonType: entry.season_type as SeasonType,
          cumulativeFp,
          cumulativePrmr,
          dailyFp: Number(entry.fp_plus) || 0,
          dailyPrmr: Number(entry.prmr) || 0,
          knockingDayNumber: idx + 1,
        };
      });
    },
    enabled: enabled,
    staleTime: 10 * 60 * 1000,
  });
};
