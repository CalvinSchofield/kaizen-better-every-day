import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfDay, endOfDay, differenceInMinutes, startOfWeek, endOfWeek } from 'date-fns';

export interface InsightsData {
  // Ratios
  doorsToFp: number;
  pitchesToFp: number;
  transitionsToFp: number;
  presentationsToClose: number;
  
  // Overall averages (for comparison)
  overallDoorsToFp: number;
  overallPitchesToFp: number;
  overallTransitionsToFp: number;
  overallPresentationsToClose: number;
  
  // Time-based productivity (per hour)
  doorsPerHour: number;
  pitchesPerHour: number;
  transitionsPerHour: number;
  presentationsPerHour: number;
  hoursToFp: number;
  
  // Best periods
  bestDay: { date: string; fpPlus: number; stats: string } | null;
  bestWeek: { weekStart: string; weekEnd: string; fpPlus: number; stats: string } | null;
  bestMonth: { month: string; fpPlus: number; stats: string } | null;
  bestRatioDay: { date: string; ratio: number; fpPlus: number } | null;
  
  // Timing patterns
  avgStartTime: string;
  avgEndTime: string;
  avgHoursWorked: number;
  mostProductiveHour: number | null;
  
  // Totals for the period
  totalFp: number;
  totalPrmr: number;
  totalDoors: number;
  totalCloses: number;
  daysWorked: number;
}

const calculateLocalTime = (utcTimestamp: string, timezone: string): { hour: number; minute: number } => {
  const date = new Date(utcTimestamp);
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).format(date);
  
  const [hour, minute] = localTime.split(':').map(Number);
  return { hour, minute };
};

const timeToDecimal = (hour: number, minute: number): number => {
  return hour + minute / 60;
};

const decimalToTime = (decimal: number): string => {
  const hour = Math.floor(decimal);
  const minute = Math.round((decimal - hour) * 60);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`;
};

export const useInsightsData = (dateRange: { start: Date; end: Date }) => {
  return useQuery({
    queryKey: ['insights-data', format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd')],
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<InsightsData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch all finalized entries
      const { data: allEntries, error: allError } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .order('entry_date', { ascending: false });

      if (allError) throw allError;

      // Filter entries within date range
      const rangeEntries = allEntries.filter(entry => {
        const entryDate = parseISO(entry.entry_date);
        return entryDate >= startOfDay(dateRange.start) && entryDate <= endOfDay(dateRange.end);
      });

      // Calculate totals for the period
      const totals = rangeEntries.reduce((acc, entry) => {
        acc.fpPlus += entry.fp_plus || 0;
        acc.prmr += entry.prmr || 0;
        acc.doors += entry.doors_knocked || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        acc.daysWorked += 1;
        
        // Calculate work hours
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          let minutes = differenceInMinutes(end, start);
          
          // Subtract break periods
          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((breakPeriod: any) => {
              const breakStart = new Date(breakPeriod.start);
              const breakEnd = new Date(breakPeriod.end);
              minutes -= differenceInMinutes(breakEnd, breakStart);
            });
          }
          
          acc.totalHours += minutes / 60;
        }
        
        return acc;
      }, { fpPlus: 0, prmr: 0, doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, daysWorked: 0, totalHours: 0 });

      // Calculate overall averages (all-time)
      const overallTotals = allEntries.reduce((acc, entry) => {
        acc.fpPlus += entry.fp_plus || 0;
        acc.doors += entry.doors_knocked || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        return acc;
      }, { fpPlus: 0, doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0 });

      // Calculate ratios
      const doorsToFp = totals.fpPlus > 0 ? totals.doors / totals.fpPlus : 0;
      const pitchesToFp = totals.fpPlus > 0 ? totals.pitches / totals.fpPlus : 0;
      const transitionsToFp = totals.fpPlus > 0 ? totals.transitions / totals.fpPlus : 0;
      const presentationsToClose = totals.closes > 0 ? totals.presentations / totals.closes : 0;

      const overallDoorsToFp = overallTotals.fpPlus > 0 ? overallTotals.doors / overallTotals.fpPlus : 0;
      const overallPitchesToFp = overallTotals.fpPlus > 0 ? overallTotals.pitches / overallTotals.fpPlus : 0;
      const overallTransitionsToFp = overallTotals.fpPlus > 0 ? overallTotals.transitions / overallTotals.fpPlus : 0;
      const overallPresentationsToClose = overallTotals.closes > 0 ? overallTotals.presentations / overallTotals.closes : 0;

      // Time-based productivity
      const doorsPerHour = totals.totalHours > 0 ? totals.doors / totals.totalHours : 0;
      const pitchesPerHour = totals.totalHours > 0 ? totals.pitches / totals.totalHours : 0;
      const transitionsPerHour = totals.totalHours > 0 ? totals.transitions / totals.totalHours : 0;
      const presentationsPerHour = totals.totalHours > 0 ? totals.presentations / totals.totalHours : 0;
      const hoursToFp = totals.fpPlus > 0 ? totals.totalHours / totals.fpPlus : 0;

      // Best day (highest FP+)
      const bestDay = rangeEntries.length > 0
        ? rangeEntries.reduce((best, entry) => {
            return (entry.fp_plus || 0) > (best.fp_plus || 0) ? entry : best;
          })
        : null;

      const bestDayData = bestDay
        ? {
            date: format(parseISO(bestDay.entry_date), 'MMM d, yyyy'),
            fpPlus: bestDay.fp_plus || 0,
            stats: `${bestDay.doors_knocked} doors · ${bestDay.closes} closes`,
          }
        : null;

      // Best ratio day (best doors-to-FP+ efficiency)
      const bestRatioDay = rangeEntries.length > 0
        ? rangeEntries
            .filter(entry => (entry.fp_plus || 0) > 0 && (entry.doors_knocked || 0) > 0)
            .reduce<any>((best, entry) => {
              const ratio = (entry.doors_knocked || 0) / (entry.fp_plus || 0);
              if (!best || ratio < best.ratio) {
                return { entry, ratio };
              }
              return best;
            }, null)
        : null;

      const bestRatioDayData = bestRatioDay
        ? {
            date: format(parseISO(bestRatioDay.entry.entry_date), 'MMM d, yyyy'),
            ratio: bestRatioDay.ratio,
            fpPlus: bestRatioDay.entry.fp_plus || 0,
          }
        : null;

      // Average start/end times (timezone-relative) - use user's timezone or default to 'America/Denver'
      const { data: repData } = await supabase
        .from('reps')
        .select('*')
        .eq('user_id', user.id)
        .single();
      
      const userTimezone = 'America/Denver'; // Default timezone for all users
      
      const timesData = rangeEntries
        .filter(entry => entry.work_start_time && entry.work_end_time)
        .map(entry => {
          const startLocal = calculateLocalTime(entry.work_start_time!, userTimezone);
          const endLocal = calculateLocalTime(entry.work_end_time!, userTimezone);
          return {
            startDecimal: timeToDecimal(startLocal.hour, startLocal.minute),
            endDecimal: timeToDecimal(endLocal.hour, endLocal.minute),
          };
        });

      const avgStartTime = timesData.length > 0
        ? decimalToTime(timesData.reduce((sum, t) => sum + t.startDecimal, 0) / timesData.length)
        : 'No data';

      const avgEndTime = timesData.length > 0
        ? decimalToTime(timesData.reduce((sum, t) => sum + t.endDecimal, 0) / timesData.length)
        : 'No data';

      const avgHoursWorked = totals.daysWorked > 0 ? totals.totalHours / totals.daysWorked : 0;

      // Most productive hour (hour with most pitches)
      const hourlyPitches: Record<number, number> = {};
      rangeEntries.forEach(entry => {
        if (entry.counter_timestamps && typeof entry.counter_timestamps === 'object') {
          const timestamps = entry.counter_timestamps as Record<string, string[]>;
          const pitchTimestamps = timestamps.pitches || [];
          pitchTimestamps.forEach((timestamp: string) => {
            const local = calculateLocalTime(timestamp, userTimezone);
            hourlyPitches[local.hour] = (hourlyPitches[local.hour] || 0) + 1;
          });
        }
      });

      const mostProductiveHour = Object.keys(hourlyPitches).length > 0
        ? parseInt(Object.entries(hourlyPitches).reduce((best, [hour, count]) => {
            return count > best[1] ? [hour, count] : best;
          }, ['0', 0])[0])
        : null;

      // Best week (Monday-Saturday chunks only)
      const weeklyData: Record<string, { entries: any[], fpPlus: number, doors: number, closes: number }> = {};
      rangeEntries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date);
        const dayOfWeek = entryDate.getDay();
        
        // Skip Sundays (0)
        if (dayOfWeek === 0) return;
        
        // Get Monday of this week
        const monday = startOfWeek(entryDate, { weekStartsOn: 1 });
        const weekKey = format(monday, 'yyyy-MM-dd');
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { entries: [], fpPlus: 0, doors: 0, closes: 0 };
        }
        
        weeklyData[weekKey].entries.push(entry);
        weeklyData[weekKey].fpPlus += entry.fp_plus || 0;
        weeklyData[weekKey].doors += entry.doors_knocked || 0;
        weeklyData[weekKey].closes += entry.closes || 0;
      });

      const bestWeekEntry = Object.entries(weeklyData).reduce<any>((best, [weekStart, data]) => {
        if (!best || data.fpPlus > best.fpPlus) {
          return { weekStart, ...data };
        }
        return best;
      }, null);

      const bestWeekData = bestWeekEntry
        ? {
            weekStart: format(parseISO(bestWeekEntry.weekStart), 'MMM d'),
            weekEnd: format(endOfWeek(parseISO(bestWeekEntry.weekStart), { weekStartsOn: 1 }), 'MMM d'),
            fpPlus: bestWeekEntry.fpPlus,
            stats: `${bestWeekEntry.doors} doors · ${bestWeekEntry.closes} closes`,
          }
        : null;

      // Best month
      const monthlyData: Record<string, { fpPlus: number, doors: number, closes: number }> = {};
      rangeEntries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date);
        const monthKey = format(entryDate, 'yyyy-MM');
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { fpPlus: 0, doors: 0, closes: 0 };
        }
        
        monthlyData[monthKey].fpPlus += entry.fp_plus || 0;
        monthlyData[monthKey].doors += entry.doors_knocked || 0;
        monthlyData[monthKey].closes += entry.closes || 0;
      });

      const bestMonthEntry = Object.entries(monthlyData).reduce<any>((best, [month, data]) => {
        if (!best || data.fpPlus > best.fpPlus) {
          return { month, ...data };
        }
        return best;
      }, null);

      const bestMonthData = bestMonthEntry && Object.keys(monthlyData).length > 1
        ? {
            month: format(parseISO(bestMonthEntry.month + '-01'), 'MMMM yyyy'),
            fpPlus: bestMonthEntry.fpPlus,
            stats: `${bestMonthEntry.doors} doors · ${bestMonthEntry.closes} closes`,
          }
        : null;

      return {
        doorsToFp,
        pitchesToFp,
        transitionsToFp,
        presentationsToClose,
        overallDoorsToFp,
        overallPitchesToFp,
        overallTransitionsToFp,
        overallPresentationsToClose,
        doorsPerHour,
        pitchesPerHour,
        transitionsPerHour,
        presentationsPerHour,
        hoursToFp,
        bestDay: bestDayData,
        bestWeek: bestWeekData,
        bestMonth: bestMonthData,
        bestRatioDay: bestRatioDayData,
        avgStartTime,
        avgEndTime,
        avgHoursWorked,
        mostProductiveHour,
        totalFp: totals.fpPlus,
        totalPrmr: totals.prmr,
        totalDoors: totals.doors,
        totalCloses: totals.closes,
        daysWorked: totals.daysWorked,
      };
    },
  });
};
