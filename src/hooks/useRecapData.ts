import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, parseISO } from 'date-fns';

export interface RecapStats {
  period: 'week' | 'month';
  periodLabel: string;
  dateRange: { start: Date; end: Date };
  
  // Activity totals
  totalDoors: number;
  totalDecisionMakers: number;
  totalPitches: number;
  totalTransitions: number;
  totalPresentations: number;
  totalCloses: number;
  
  // Time stats
  daysWorked: number;
  totalHoursWorked: number;
  avgStartTime: string | null;
  avgEndTime: string | null;
  peakHour: number | null;
  
  // Best day
  bestDay: {
    date: string;
    doors: number;
    fpPlus: number;
  } | null;
  
  // Results
  totalFpPlus: number;
  totalPrmr: number;
  
  // Comparisons to previous period
  comparison: {
    doors: number; // percentage change
    fpPlus: number;
    hoursWorked: number;
    daysWorked: number;
  };
  
  // Personal records (if any were set this period)
  records: {
    mostDoorsInDay: { isRecord: boolean; value: number; previousBest: number };
    mostFpInDay: { isRecord: boolean; value: number; previousBest: number };
    mostHoursInDay: { isRecord: boolean; value: number; previousBest: number };
    earliestStart: { isRecord: boolean; value: string | null; previousBest: string | null };
  };
}

function calculateHoursWorked(entry: any): number {
  if (!entry.work_start_time || !entry.work_end_time) return 0;
  
  const start = new Date(entry.work_start_time);
  const end = new Date(entry.work_end_time);
  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  
  // Subtract break time
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

function getLocalHour(timestamp: string, timezone: string): number {
  try {
    const date = new Date(timestamp);
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    return new Date(timestamp).getHours();
  }
}

// Get decimal time (hours + minutes as fraction) in user's timezone
function getLocalDecimalTime(timestamp: string, timezone: string): number {
  try {
    const date = new Date(timestamp);
    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone
    });
    const minuteFormatter = new Intl.DateTimeFormat('en-US', {
      minute: 'numeric',
      timeZone: timezone
    });
    const hour = parseInt(hourFormatter.format(date), 10);
    const minute = parseInt(minuteFormatter.format(date), 10);
    return hour + minute / 60;
  } catch {
    const date = new Date(timestamp);
    return date.getHours() + date.getMinutes() / 60;
  }
}

function formatTimeFromDecimal(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

export function useRecapData(period: 'week' | 'month') {
  return useQuery({
    queryKey: ['recap-data', period],
    queryFn: async (): Promise<RecapStats | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user timezone
      const { data: repData } = await supabase
        .from('reps')
        .select('timezone')
        .eq('user_id', user.id)
        .single();
      
      const timezone = repData?.timezone || 'America/Los_Angeles';

      // Calculate date ranges
      const now = new Date();
      let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;
      let periodLabel: string;

      if (period === 'week') {
        // Last week (Mon-Sat)
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
        currentStart = lastWeekStart;
        currentEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
        prevStart = startOfWeek(subWeeks(now, 2), { weekStartsOn: 1 });
        prevEnd = endOfWeek(prevStart, { weekStartsOn: 1 });
        periodLabel = `Week of ${format(currentStart, 'MMM d')}`;
      } else {
        // Last month
        const lastMonthStart = startOfMonth(subMonths(now, 1));
        currentStart = lastMonthStart;
        currentEnd = endOfMonth(lastMonthStart);
        prevStart = startOfMonth(subMonths(now, 2));
        prevEnd = endOfMonth(prevStart);
        periodLabel = format(currentStart, 'MMMM yyyy');
      }

      const currentStartStr = format(currentStart, 'yyyy-MM-dd');
      const currentEndStr = format(currentEnd, 'yyyy-MM-dd');
      const prevStartStr = format(prevStart, 'yyyy-MM-dd');
      const prevEndStr = format(prevEnd, 'yyyy-MM-dd');

      // Fetch current period entries
      const { data: currentEntries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', currentStartStr)
        .lte('entry_date', currentEndStr);

      // Fetch previous period entries
      const { data: prevEntries } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', prevStartStr)
        .lte('entry_date', prevEndStr);

      // Fetch all-time entries for records
      const { data: allEntries } = await supabase
        .from('daily_entries')
        .select('doors_knocked, fp_plus, work_start_time, work_end_time, break_periods')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .lt('entry_date', currentStartStr);

      if (!currentEntries || currentEntries.length === 0) return null;

      // Calculate current period stats
      const totalDoors = currentEntries.reduce((sum, e) => sum + (e.doors_knocked || 0), 0);
      const totalDecisionMakers = currentEntries.reduce((sum, e) => sum + (e.decision_makers || 0), 0);
      const totalPitches = currentEntries.reduce((sum, e) => sum + (e.pitches || 0), 0);
      const totalTransitions = currentEntries.reduce((sum, e) => sum + (e.transitions || 0), 0);
      const totalPresentations = currentEntries.reduce((sum, e) => sum + (e.presentations || 0), 0);
      const totalCloses = currentEntries.reduce((sum, e) => sum + (e.closes || 0), 0);
      const totalFpPlus = currentEntries.reduce((sum, e) => sum + (e.fp_plus || 0), 0);
      const totalPrmr = currentEntries.reduce((sum, e) => sum + (e.prmr || 0), 0);
      
      const daysWorked = currentEntries.filter(e => 
        (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
      ).length;
      
      const totalHoursWorked = currentEntries.reduce((sum, e) => sum + calculateHoursWorked(e), 0);

      // Calculate average start/end times
      const startTimes: number[] = [];
      const endTimes: number[] = [];
      const hourCounts: Record<number, number> = {};

      currentEntries.forEach(entry => {
        if (entry.work_start_time) {
          // Use timezone-aware conversion to get local time
          startTimes.push(getLocalDecimalTime(entry.work_start_time, timezone));
        }
        if (entry.work_end_time) {
          // Use timezone-aware conversion to get local time
          endTimes.push(getLocalDecimalTime(entry.work_end_time, timezone));
        }
        // Count doors per hour for peak hour
        if (entry.counter_timestamps && typeof entry.counter_timestamps === 'object') {
          const timestamps = entry.counter_timestamps as Record<string, string[]>;
          const doorTimestamps = timestamps.doors_knocked || [];
          doorTimestamps.forEach((ts: string) => {
            const hour = getLocalHour(ts, timezone);
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          });
        }
      });

      const avgStartTime = startTimes.length > 0 
        ? formatTimeFromDecimal(startTimes.reduce((a, b) => a + b, 0) / startTimes.length)
        : null;
      const avgEndTime = endTimes.length > 0
        ? formatTimeFromDecimal(endTimes.reduce((a, b) => a + b, 0) / endTimes.length)
        : null;

      // Find peak hour
      let peakHour: number | null = null;
      let maxDoors = 0;
      Object.entries(hourCounts).forEach(([hour, count]) => {
        if (count > maxDoors) {
          maxDoors = count;
          peakHour = parseInt(hour, 10);
        }
      });

      // Find best day
      let bestDay: RecapStats['bestDay'] = null;
      currentEntries.forEach(entry => {
        const score = (entry.doors_knocked || 0) + ((entry.fp_plus || 0) * 100);
        if (!bestDay || score > ((bestDay.doors || 0) + (bestDay.fpPlus * 100))) {
          bestDay = {
            date: entry.entry_date,
            doors: entry.doors_knocked || 0,
            fpPlus: entry.fp_plus || 0
          };
        }
      });

      // Calculate previous period stats for comparison
      const prevDoors = prevEntries?.reduce((sum, e) => sum + (e.doors_knocked || 0), 0) || 0;
      const prevFpPlus = prevEntries?.reduce((sum, e) => sum + (e.fp_plus || 0), 0) || 0;
      const prevHours = prevEntries?.reduce((sum, e) => sum + calculateHoursWorked(e), 0) || 0;
      const prevDaysWorked = prevEntries?.filter(e => 
        (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
      ).length || 0;

      const comparison = {
        doors: prevDoors > 0 ? ((totalDoors - prevDoors) / prevDoors) * 100 : 0,
        fpPlus: prevFpPlus > 0 ? ((totalFpPlus - prevFpPlus) / prevFpPlus) * 100 : 0,
        hoursWorked: prevHours > 0 ? ((totalHoursWorked - prevHours) / prevHours) * 100 : 0,
        daysWorked: prevDaysWorked > 0 ? ((daysWorked - prevDaysWorked) / prevDaysWorked) * 100 : 0
      };

      // Check for personal records
      const allTimeBestDoors = allEntries?.reduce((max, e) => Math.max(max, e.doors_knocked || 0), 0) || 0;
      const allTimeBestFp = allEntries?.reduce((max, e) => Math.max(max, e.fp_plus || 0), 0) || 0;
      const allTimeBestHours = allEntries?.reduce((max, e) => Math.max(max, calculateHoursWorked(e)), 0) || 0;
      
      // Get earliest start time from all-time entries
      let allTimeEarliestStart: number | null = null;
      allEntries?.forEach(e => {
        if (e.work_start_time) {
          const decimal = getLocalDecimalTime(e.work_start_time, timezone);
          if (allTimeEarliestStart === null || decimal < allTimeEarliestStart) {
            allTimeEarliestStart = decimal;
          }
        }
      });
      
      const currentBestDoors = Math.max(...currentEntries.map(e => e.doors_knocked || 0));
      const currentBestFp = Math.max(...currentEntries.map(e => e.fp_plus || 0));
      const currentBestHours = Math.max(...currentEntries.map(e => calculateHoursWorked(e)));
      
      // Get earliest start time from current period
      let currentEarliestStart: number | null = null;
      currentEntries.forEach(e => {
        if (e.work_start_time) {
          const decimal = getLocalDecimalTime(e.work_start_time, timezone);
          if (currentEarliestStart === null || decimal < currentEarliestStart) {
            currentEarliestStart = decimal;
          }
        }
      });

      const records = {
        mostDoorsInDay: {
          isRecord: currentBestDoors > allTimeBestDoors,
          value: currentBestDoors,
          previousBest: allTimeBestDoors
        },
        mostFpInDay: {
          isRecord: currentBestFp > allTimeBestFp,
          value: currentBestFp,
          previousBest: allTimeBestFp
        },
        mostHoursInDay: {
          isRecord: currentBestHours > allTimeBestHours,
          value: Math.round(currentBestHours * 10) / 10,
          previousBest: Math.round(allTimeBestHours * 10) / 10
        },
        earliestStart: {
          isRecord: currentEarliestStart !== null && (allTimeEarliestStart === null || currentEarliestStart < allTimeEarliestStart),
          value: currentEarliestStart !== null ? formatTimeFromDecimal(currentEarliestStart) : null,
          previousBest: allTimeEarliestStart !== null ? formatTimeFromDecimal(allTimeEarliestStart) : null
        }
      };

      return {
        period,
        periodLabel,
        dateRange: { start: currentStart, end: currentEnd },
        totalDoors,
        totalDecisionMakers,
        totalPitches,
        totalTransitions,
        totalPresentations,
        totalCloses,
        daysWorked,
        totalHoursWorked,
        avgStartTime,
        avgEndTime,
        peakHour,
        bestDay,
        totalFpPlus,
        totalPrmr,
        comparison,
        records
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
