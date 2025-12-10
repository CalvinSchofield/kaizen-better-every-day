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
  
  // EFP metrics
  totalEfp: number;
  doorsToEfp: number;
  pitchesToEfp: number;
  transitionsToEfp: number;
  hoursToEfp: number;
  overallDoorsToEfp: number;
  overallPitchesToEfp: number;
  overallTransitionsToEfp: number;
  
  // Upgrade metrics
  totalUpgradePrmr: number;
  totalUpgradeFp: number;
  totalNewFp: number;
  totalNewPrmr: number;
  upgradeRate: number;
  doorsToNewFp: number;
  
  // Sales log breakdown (accurate from sales_log)
  fpCount: number;
  fpPrmrTotal: number;
  upgradeCount: number;
  upgradePrmrTotal: number;
  avgPrmrPerFp: number;
  avgPrmrPerUpgrade: number;
  
  // Best periods
  bestDay: { date: string; fpPlus: number; efp: number; stats: string } | null;
  bestWeek: { weekStart: string; weekEnd: string; fpPlus: number; efp: number; stats: string } | null;
  bestMonth: { month: string; fpPlus: number; efp: number; stats: string } | null;
  bestTransitionsDay: { date: string; transitions: number; fpPlus: number; efp: number } | null;
  bestDayOfWeek: { day: string; avgFp: number; avgEfp: number; daysWorked: number } | null;
  
  // Timing patterns
  avgStartTime: string;
  avgEndTime: string;
  avgHoursWorked: number;
  mostProductiveHour: number | null;
  
  // Totals for the period
  totalFp: number;
  totalPrmr: number;
  totalDoors: number;
  totalDecisionMakers: number;
  totalPitches: number;
  totalTransitions: number;
  totalPresentations: number;
  totalCloses: number;
  daysWorked: number;
  totalWorkMinutes: number;
  customCounterTotals: Record<string, number>;
  
  // New visualizations data
  dayOfWeekData: {
    [key: string]: {
      avgFp: number;
      avgEfp: number;
      avgDoors: number;
      avgPitches: number;
      avgTransitions: number;
      avgPresentations: number;
      avgCloses: number;
      avgHours: number;
      daysWorked: number;
    };
  };
  funnelData: {
    doors: { total: number; conversionToNext: number };
    decisionMakers: { total: number; conversionToNext: number };
    pitches: { total: number; conversionToNext: number };
    transitions: { total: number; conversionToNext: number };
    presentations: { total: number; conversionToNext: number };
    closes: { total: number };
  };
  hourlyActivity: {
    doors: Record<number, number>;
    pitches: Record<number, number>;
    transitions: Record<number, number>;
    presentations: Record<number, number>;
    closes: Record<number, number>;
  };
  peakHours: {
    doors: number | null;
    pitches: number | null;
    transitions: number | null;
    presentations: number | null;
    closes: number | null;
  };
  hourRange: {
    minHour: number;
    maxHour: number;
  };
  dailyTrend: Array<{
    date: string;
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    fp: number;
    efp: number;
    prmr: number;
    hoursWorked: number;
  }>;
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

export const useInsightsData = (dateRange: { start: Date; end: Date }, efpModeEnabled: boolean = false) => {
  return useQuery({
    queryKey: ['insights-data', format(dateRange.start, 'yyyy-MM-dd'), format(dateRange.end, 'yyyy-MM-dd'), efpModeEnabled],
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

      // Helper to determine if an entry is a "knocking day" for pace calculations
      // A knocking day requires: doors_knocked >= 5 AND work_start_time set AND work_end_time set
      const isKnockingDay = (entry: typeof allEntries[0]): boolean => {
        return (entry.doors_knocked || 0) >= 5 && 
               !!entry.work_start_time && 
               !!entry.work_end_time;
      };

      // Filter entries that have actual activity for ratio calculations (any activity)
      const entriesWithActivity = rangeEntries.filter(entry => 
        (entry.doors_knocked || 0) > 0 ||
        (entry.decision_makers || 0) > 0 ||
        (entry.pitches || 0) > 0 ||
        (entry.transitions || 0) > 0 ||
        (entry.presentations || 0) > 0 ||
        (entry.closes || 0) > 0
      );

      // Filter to only "knocking days" for calculating daily averages
      const knockingDays = rangeEntries.filter(isKnockingDay);

      // Calculate totals for the period (use ALL entries including results-only)
      // Total PRMR = prmr (FP sales) + upgrade_prmr (upgrade sales)
      const totals = rangeEntries.reduce((acc, entry) => {
        acc.fpPlus += entry.fp_plus || 0;
        // prmr field IS total PRMR (already includes upgrade_prmr as subset)
        acc.prmr += entry.prmr || 0;
        acc.upgradePrmr += entry.upgrade_prmr || 0;
        acc.doors += entry.doors_knocked || 0;
        acc.decisionMakers += entry.decision_makers || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        // Only count knocking days for "days worked" (not referral-only days)
        if (isKnockingDay(entry)) {
          acc.daysWorked += 1;
        }
        
        // Parse sales_log to get FP count and PRMR breakdown (only funded sales)
        // Fall back to column values for entries without sales_log (pre-feature entries)
        const salesLog = entry.sales_log || [];
        const fundedSales = Array.isArray(salesLog) 
          ? salesLog.filter((sale: any) => sale.install_status !== 'cancelled')
          : [];
        
        if (fundedSales.length > 0) {
          // Use sales_log data
          fundedSales.forEach((sale: any) => {
            if (sale.type === 'fp') {
              acc.fpCount += 1;
              acc.fpPrmrTotal += sale.prmr || 0;
            } else if (sale.type === 'upgrade') {
              acc.upgradeCount += 1;
              acc.upgradePrmrTotal += sale.prmr || 0;
            }
          });
        } else if ((entry.fp_plus || 0) > 0 || (entry.prmr || 0) > 0) {
          // Fallback for pre-sales_log entries: derive from column values
          const upgradeFp = (entry.upgrade_prmr || 0) / 85;
          const newFp = (entry.fp_plus || 0) - upgradeFp;
          const newPrmr = (entry.prmr || 0) - (entry.upgrade_prmr || 0);
          
          // Estimate FP count from newFp (round to nearest whole number)
          if (newFp > 0) {
            acc.fpCount += Math.round(newFp);
            acc.fpPrmrTotal += newPrmr;
          }
          // Estimate upgrade count from upgrade_prmr
          if ((entry.upgrade_prmr || 0) > 0) {
            acc.upgradeCount += Math.round(upgradeFp);
            acc.upgradePrmrTotal += entry.upgrade_prmr || 0;
          }
        }
        
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
          acc.totalMinutes += minutes;
        }
        
        // Aggregate custom counters
        if (entry.custom_counters && typeof entry.custom_counters === 'object') {
          Object.entries(entry.custom_counters).forEach(([counterId, value]) => {
            acc.customCounters[counterId] = (acc.customCounters[counterId] || 0) + (value as number);
          });
        }
        
        return acc;
      }, { 
        fpPlus: 0, 
        prmr: 0, 
        upgradePrmr: 0,
        doors: 0, 
        decisionMakers: 0, 
        pitches: 0, 
        transitions: 0, 
        presentations: 0, 
        closes: 0, 
        daysWorked: 0, 
        totalHours: 0, 
        totalMinutes: 0,
        customCounters: {} as Record<string, number>,
        fpCount: 0,
        fpPrmrTotal: 0,
        upgradeCount: 0,
        upgradePrmrTotal: 0
      });

      // Calculate activity-based totals for ratios (only entries with activity)
      const activityTotals = entriesWithActivity.reduce((acc, entry) => {
        acc.fpPlus += entry.fp_plus || 0;
        acc.doors += entry.doors_knocked || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        
        // Calculate work hours for activity entries
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
      }, { fpPlus: 0, doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, totalHours: 0 });

      // Calculate overall averages (all-time, only entries with activity)
      const allEntriesWithActivity = allEntries.filter(entry => 
        (entry.doors_knocked || 0) > 0 ||
        (entry.decision_makers || 0) > 0 ||
        (entry.pitches || 0) > 0 ||
        (entry.transitions || 0) > 0 ||
        (entry.presentations || 0) > 0 ||
        (entry.closes || 0) > 0
      );
      
      const overallTotals = allEntriesWithActivity.reduce((acc, entry) => {
        acc.fpPlus += entry.fp_plus || 0;
        acc.doors += entry.doors_knocked || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        return acc;
      }, { fpPlus: 0, doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0 });

      // Calculate ratios (using activity-based totals)
      const doorsToFp = activityTotals.fpPlus > 0 ? activityTotals.doors / activityTotals.fpPlus : 0;
      const pitchesToFp = activityTotals.fpPlus > 0 ? activityTotals.pitches / activityTotals.fpPlus : 0;
      const transitionsToFp = activityTotals.fpPlus > 0 ? activityTotals.transitions / activityTotals.fpPlus : 0;
      const presentationsToClose = activityTotals.closes > 0 ? activityTotals.presentations / activityTotals.closes : 0;

      const overallDoorsToFp = overallTotals.fpPlus > 0 ? overallTotals.doors / overallTotals.fpPlus : 0;
      const overallPitchesToFp = overallTotals.fpPlus > 0 ? overallTotals.pitches / overallTotals.fpPlus : 0;
      const overallTransitionsToFp = overallTotals.fpPlus > 0 ? overallTotals.transitions / overallTotals.fpPlus : 0;
      const overallPresentationsToClose = overallTotals.closes > 0 ? overallTotals.presentations / overallTotals.closes : 0;

      // Time-based productivity (using activity entries with time data)
      const doorsPerHour = activityTotals.totalHours > 0 ? activityTotals.doors / activityTotals.totalHours : 0;
      const pitchesPerHour = activityTotals.totalHours > 0 ? activityTotals.pitches / activityTotals.totalHours : 0;
      const transitionsPerHour = activityTotals.totalHours > 0 ? activityTotals.transitions / activityTotals.totalHours : 0;
      const presentationsPerHour = activityTotals.totalHours > 0 ? activityTotals.presentations / activityTotals.totalHours : 0;
      const hoursToFp = activityTotals.fpPlus > 0 ? activityTotals.totalHours / activityTotals.fpPlus : 0;
      
      // EFP calculations: EFP = prmr / 85 (prmr IS total PRMR)
      const totalEfp = totals.prmr / 85;
      const activityEfp = rangeEntries
        .filter(entry => 
          (entry.doors_knocked || 0) > 0 ||
          (entry.decision_makers || 0) > 0 ||
          (entry.pitches || 0) > 0 ||
          (entry.transitions || 0) > 0 ||
          (entry.presentations || 0) > 0 ||
          (entry.closes || 0) > 0
        )
        .reduce((sum, entry) => sum + (entry.prmr || 0), 0) / 85;
      
      const overallEfp = allEntriesWithActivity.reduce((sum, entry) => sum + (entry.prmr || 0), 0) / 85;
      
      const doorsToEfp = activityEfp > 0 ? activityTotals.doors / activityEfp : 0;
      const pitchesToEfp = activityEfp > 0 ? activityTotals.pitches / activityEfp : 0;
      const transitionsToEfp = activityEfp > 0 ? activityTotals.transitions / activityEfp : 0;
      const hoursToEfp = activityEfp > 0 ? activityTotals.totalHours / activityEfp : 0;
      
      const overallDoorsToEfp = overallEfp > 0 ? overallTotals.doors / overallEfp : 0;
      const overallPitchesToEfp = overallEfp > 0 ? overallTotals.pitches / overallEfp : 0;
      const overallTransitionsToEfp = overallEfp > 0 ? overallTotals.transitions / overallEfp : 0;

      // Upgrade calculations
      const totalUpgradePrmr = totals.upgradePrmr;
      const totalUpgradeFp = totalUpgradePrmr / 85;
      const totalNewFp = totals.fpPlus - totalUpgradeFp;
      const totalNewPrmr = totals.prmr - totalUpgradePrmr;
      const upgradeRate = totals.fpPlus > 0 ? (totalUpgradeFp / totals.fpPlus) * 100 : 0;
      const doorsToNewFp = totalNewFp > 0 ? activityTotals.doors / totalNewFp : 0;

      // Best day - sort by EFP (prmr/85) if efpModeEnabled, otherwise FP+
      const bestDay = rangeEntries.length > 0
        ? rangeEntries.reduce((best, entry) => {
            if (efpModeEnabled) {
              const entryEfp = (entry.prmr || 0) / 85;
              const bestEfp = (best.prmr || 0) / 85;
              return entryEfp > bestEfp ? entry : best;
            }
            return (entry.fp_plus || 0) > (best.fp_plus || 0) ? entry : best;
          })
        : null;

      const bestDayData = bestDay
        ? {
            date: format(parseISO(bestDay.entry_date), 'MMM d, yyyy'),
            fpPlus: bestDay.fp_plus || 0,
            efp: (bestDay.prmr || 0) / 85,
            stats: `${bestDay.doors_knocked} doors · ${bestDay.closes} closes`,
          }
        : null;

      // Best transitions day (highest transitions count)
      const bestTransitionsDay = rangeEntries.length > 0
        ? rangeEntries
            .filter(entry => (entry.transitions || 0) > 0)
            .reduce<any>((best, entry) => {
              const transitions = entry.transitions || 0;
              if (!best || transitions > best.transitions) {
                return { entry, transitions };
              }
              return best;
            }, null)
        : null;

      const bestTransitionsDayData = bestTransitionsDay
        ? {
            date: format(parseISO(bestTransitionsDay.entry.entry_date), 'MMM d, yyyy'),
            transitions: bestTransitionsDay.transitions,
            fpPlus: bestTransitionsDay.entry.fp_plus || 0,
            efp: (bestTransitionsDay.entry.prmr || 0) / 85,
          }
        : null;

      // Average start/end times (timezone-relative) - use user's timezone from their rep profile
      const { data: repData } = await supabase
        .from('reps')
        .select('timezone')
        .eq('user_id', user.id)
        .maybeSingle();
      
      // Use the rep's timezone, fall back to entry timezone, then default
      const userTimezone = repData?.timezone || 'America/Los_Angeles';
      
      const timesData = rangeEntries
        .filter(entry => entry.work_start_time && entry.work_end_time)
        .map(entry => {
          // Use entry's timezone if available, otherwise user's timezone
          const entryTimezone = entry.timezone || userTimezone;
          const startLocal = calculateLocalTime(entry.work_start_time!, entryTimezone);
          const endLocal = calculateLocalTime(entry.work_end_time!, entryTimezone);
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

      // Most productive hour (hour with most pitches) - use each entry's timezone
      const hourlyPitches: Record<number, number> = {};
      rangeEntries.forEach(entry => {
        if (entry.counter_timestamps && typeof entry.counter_timestamps === 'object') {
          const timestamps = entry.counter_timestamps as Record<string, string[]>;
          const pitchTimestamps = timestamps.pitches || [];
          const entryTimezone = entry.timezone || userTimezone;
          pitchTimestamps.forEach((timestamp: string) => {
            const local = calculateLocalTime(timestamp, entryTimezone);
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
      const weeklyData: Record<string, { entries: any[], fpPlus: number, prmr: number, doors: number, closes: number }> = {};
      rangeEntries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date);
        const dayOfWeek = entryDate.getDay();
        
        // Skip Sundays (0)
        if (dayOfWeek === 0) return;
        
        // Get Monday of this week
        const monday = startOfWeek(entryDate, { weekStartsOn: 1 });
        const weekKey = format(monday, 'yyyy-MM-dd');
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { entries: [], fpPlus: 0, prmr: 0, doors: 0, closes: 0 };
        }
        
        weeklyData[weekKey].entries.push(entry);
        weeklyData[weekKey].fpPlus += entry.fp_plus || 0;
        weeklyData[weekKey].prmr += entry.prmr || 0;
        weeklyData[weekKey].doors += entry.doors_knocked || 0;
        weeklyData[weekKey].closes += entry.closes || 0;
      });

      // Sort by EFP (prmr/85) if efpModeEnabled, otherwise FP+
      const bestWeekEntry = Object.entries(weeklyData).reduce<any>((best, [weekStart, data]) => {
        if (efpModeEnabled) {
          const dataEfp = data.prmr / 85;
          const bestEfp = best ? best.prmr / 85 : 0;
          if (!best || dataEfp > bestEfp) {
            return { weekStart, ...data };
          }
        } else {
          if (!best || data.fpPlus > best.fpPlus) {
            return { weekStart, ...data };
          }
        }
        return best;
      }, null);

      const bestWeekData = bestWeekEntry
        ? {
            weekStart: format(parseISO(bestWeekEntry.weekStart), 'MMM d'),
            weekEnd: format(endOfWeek(parseISO(bestWeekEntry.weekStart), { weekStartsOn: 1 }), 'MMM d'),
            fpPlus: bestWeekEntry.fpPlus,
            efp: bestWeekEntry.prmr / 85,
            stats: `${bestWeekEntry.doors} doors · ${bestWeekEntry.closes} closes`,
          }
        : null;

      // Best month
      const monthlyData: Record<string, { fpPlus: number, prmr: number, doors: number, closes: number }> = {};
      rangeEntries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date);
        const monthKey = format(entryDate, 'yyyy-MM');
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { fpPlus: 0, prmr: 0, doors: 0, closes: 0 };
        }
        
        monthlyData[monthKey].fpPlus += entry.fp_plus || 0;
        monthlyData[monthKey].prmr += entry.prmr || 0;
        monthlyData[monthKey].doors += entry.doors_knocked || 0;
        monthlyData[monthKey].closes += entry.closes || 0;
      });

      // Sort by EFP (prmr/85) if efpModeEnabled, otherwise FP+
      const bestMonthEntry = Object.entries(monthlyData).reduce<any>((best, [month, data]) => {
        if (efpModeEnabled) {
          const dataEfp = data.prmr / 85;
          const bestEfp = best ? best.prmr / 85 : 0;
          if (!best || dataEfp > bestEfp) {
            return { month, ...data };
          }
        } else {
          if (!best || data.fpPlus > best.fpPlus) {
            return { month, ...data };
          }
        }
        return best;
      }, null);

      const bestMonthData = bestMonthEntry && Object.keys(monthlyData).length > 1
        ? {
            month: format(parseISO(bestMonthEntry.month + '-01'), 'MMMM yyyy'),
            fpPlus: bestMonthEntry.fpPlus,
            efp: bestMonthEntry.prmr / 85,
            stats: `${bestMonthEntry.doors} doors · ${bestMonthEntry.closes} closes`,
          }
        : null;

      // Day of Week Analysis
      const dayOfWeekMap: Record<number, string> = {
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
      };

      const dayOfWeekTotals: Record<string, any> = {};
      rangeEntries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date);
        const dayOfWeek = entryDate.getDay();
        
        // Skip Sundays (0)
        if (dayOfWeek === 0) return;
        
        const dayName = dayOfWeekMap[dayOfWeek];
        if (!dayOfWeekTotals[dayName]) {
          dayOfWeekTotals[dayName] = {
            fpPlus: 0,
            prmr: 0,
            doors: 0,
            pitches: 0,
            transitions: 0,
            presentations: 0,
            closes: 0,
            totalHours: 0,
            daysWorked: 0,
          };
        }
        
        dayOfWeekTotals[dayName].fpPlus += entry.fp_plus || 0;
        dayOfWeekTotals[dayName].prmr += entry.prmr || 0;
        dayOfWeekTotals[dayName].doors += entry.doors_knocked || 0;
        dayOfWeekTotals[dayName].pitches += entry.pitches || 0;
        dayOfWeekTotals[dayName].transitions += entry.transitions || 0;
        dayOfWeekTotals[dayName].presentations += entry.presentations || 0;
        dayOfWeekTotals[dayName].closes += entry.closes || 0;
        dayOfWeekTotals[dayName].daysWorked += 1;
        
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          let minutes = differenceInMinutes(end, start);
          
          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((breakPeriod: any) => {
              const breakStart = new Date(breakPeriod.start);
              const breakEnd = new Date(breakPeriod.end);
              minutes -= differenceInMinutes(breakEnd, breakStart);
            });
          }
          
          dayOfWeekTotals[dayName].totalHours += minutes / 60;
        }
      });

      const dayOfWeekData: any = {};
      let bestDayOfWeek: any = null;

      Object.entries(dayOfWeekTotals).forEach(([day, totals]: [string, any]) => {
        const avgFp = totals.daysWorked > 0 ? totals.fpPlus / totals.daysWorked : 0;
        const avgEfp = totals.daysWorked > 0 ? (totals.prmr / 85) / totals.daysWorked : 0;
        
        dayOfWeekData[day.toLowerCase()] = {
          avgFp,
          avgEfp,
          avgDoors: totals.daysWorked > 0 ? totals.doors / totals.daysWorked : 0,
          avgPitches: totals.daysWorked > 0 ? totals.pitches / totals.daysWorked : 0,
          avgTransitions: totals.daysWorked > 0 ? totals.transitions / totals.daysWorked : 0,
          avgPresentations: totals.daysWorked > 0 ? totals.presentations / totals.daysWorked : 0,
          avgCloses: totals.daysWorked > 0 ? totals.closes / totals.daysWorked : 0,
          avgHours: totals.daysWorked > 0 ? totals.totalHours / totals.daysWorked : 0,
          daysWorked: totals.daysWorked,
        };
        
        // Sort by avgEfp if efpModeEnabled, otherwise avgFp
        const compareValue = efpModeEnabled ? avgEfp : avgFp;
        const bestCompareValue = efpModeEnabled ? (bestDayOfWeek?.avgEfp || 0) : (bestDayOfWeek?.avgFp || 0);
        if (!bestDayOfWeek || compareValue > bestCompareValue) {
          bestDayOfWeek = { day, avgFp, avgEfp, daysWorked: totals.daysWorked };
        }
      });

      // Funnel Data (conversion stages)
      const funnelData = {
        doors: {
          total: activityTotals.doors,
          conversionToNext: activityTotals.doors > 0 ? (totals.decisionMakers / activityTotals.doors) * 100 : 0,
        },
        decisionMakers: {
          total: totals.decisionMakers,
          conversionToNext: totals.decisionMakers > 0 ? (activityTotals.pitches / totals.decisionMakers) * 100 : 0,
        },
        pitches: {
          total: activityTotals.pitches,
          conversionToNext: activityTotals.pitches > 0 ? (activityTotals.transitions / activityTotals.pitches) * 100 : 0,
        },
        transitions: {
          total: activityTotals.transitions,
          conversionToNext: activityTotals.transitions > 0 ? (activityTotals.presentations / activityTotals.transitions) * 100 : 0,
        },
        presentations: {
          total: activityTotals.presentations,
          conversionToNext: activityTotals.presentations > 0 ? (activityTotals.closes / activityTotals.presentations) * 100 : 0,
        },
        closes: {
          total: activityTotals.closes,
        },
      };

      // Hourly Activity (from counter_timestamps)
      const hourlyActivity: any = {
        doors: {},
        pitches: {},
        transitions: {},
        presentations: {},
        closes: {},
      };

      let minHour = 21; // Default to 9 PM if no data
      let maxHour = 21; // Default to 9 PM if no data
      let hasTimestampData = false;

      rangeEntries.forEach(entry => {
        if (entry.counter_timestamps && typeof entry.counter_timestamps === 'object') {
          const timestamps = entry.counter_timestamps as Record<string, string[]>;
          
          ['doors_knocked', 'pitches', 'transitions', 'presentations', 'closes'].forEach(field => {
            const fieldTimestamps = timestamps[field] || [];
            const activityKey = field === 'doors_knocked' ? 'doors' : field as 'pitches' | 'transitions' | 'presentations' | 'closes';
            
            fieldTimestamps.forEach((timestamp: string) => {
              const local = calculateLocalTime(timestamp, userTimezone);
              hourlyActivity[activityKey][local.hour] = (hourlyActivity[activityKey][local.hour] || 0) + 1;
              
              // Track min/max hours from actual data
              if (!hasTimestampData) {
                minHour = local.hour;
                maxHour = local.hour;
                hasTimestampData = true;
              } else {
                minHour = Math.min(minHour, local.hour);
                maxHour = Math.max(maxHour, local.hour);
              }
            });
          });
        }
      });

      // Cap maxHour at 21 (9 PM)
      maxHour = Math.min(maxHour, 21);

      const peakHours = {
        doors: Object.keys(hourlyActivity.doors).length > 0
          ? parseInt(Object.entries(hourlyActivity.doors).reduce((best, [hour, count]) => count > best[1] ? [hour, count] : best, ['0', 0])[0])
          : null,
        pitches: Object.keys(hourlyActivity.pitches).length > 0
          ? parseInt(Object.entries(hourlyActivity.pitches).reduce((best, [hour, count]) => count > best[1] ? [hour, count] : best, ['0', 0])[0])
          : null,
        transitions: Object.keys(hourlyActivity.transitions).length > 0
          ? parseInt(Object.entries(hourlyActivity.transitions).reduce((best, [hour, count]) => count > best[1] ? [hour, count] : best, ['0', 0])[0])
          : null,
        presentations: Object.keys(hourlyActivity.presentations).length > 0
          ? parseInt(Object.entries(hourlyActivity.presentations).reduce((best, [hour, count]) => count > best[1] ? [hour, count] : best, ['0', 0])[0])
          : null,
        closes: Object.keys(hourlyActivity.closes).length > 0
          ? parseInt(Object.entries(hourlyActivity.closes).reduce((best, [hour, count]) => count > best[1] ? [hour, count] : best, ['0', 0])[0])
          : null,
      };

      // Daily Trend Data (for line charts)
      // prmr field IS total PRMR, EFP = prmr / 85
      const dailyTrend = rangeEntries.map(entry => {
        const totalPrmr = entry.prmr || 0;
        
        // Calculate hours worked for this entry
        let hoursWorked = 0;
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          let minutes = differenceInMinutes(end, start);
          
          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((breakPeriod: any) => {
              const breakStart = new Date(breakPeriod.start);
              const breakEnd = new Date(breakPeriod.end);
              minutes -= differenceInMinutes(breakEnd, breakStart);
            });
          }
          
          hoursWorked = minutes / 60;
        }
        
        return {
          date: entry.entry_date,
          doors: entry.doors_knocked || 0,
          pitches: entry.pitches || 0,
          transitions: entry.transitions || 0,
          presentations: entry.presentations || 0,
          fp: entry.fp_plus || 0,
          efp: totalPrmr / 85,
          prmr: totalPrmr,
          hoursWorked,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

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
        totalEfp,
        doorsToEfp,
        pitchesToEfp,
        transitionsToEfp,
        hoursToEfp,
        overallDoorsToEfp,
        overallPitchesToEfp,
        overallTransitionsToEfp,
        totalUpgradePrmr,
        totalUpgradeFp,
        totalNewFp,
        totalNewPrmr,
        upgradeRate,
        doorsToNewFp,
        fpCount: totals.fpCount,
        fpPrmrTotal: totals.fpPrmrTotal,
        upgradeCount: totals.upgradeCount,
        upgradePrmrTotal: totals.upgradePrmrTotal,
        avgPrmrPerFp: totals.fpCount > 0 ? totals.fpPrmrTotal / totals.fpCount : 0,
        avgPrmrPerUpgrade: totals.upgradeCount > 0 ? totals.upgradePrmrTotal / totals.upgradeCount : 0,
        bestDay: bestDayData,
        bestWeek: bestWeekData,
        bestMonth: bestMonthData,
        bestTransitionsDay: bestTransitionsDayData,
        bestDayOfWeek,
        avgStartTime,
        avgEndTime,
        avgHoursWorked,
        mostProductiveHour,
        totalFp: totals.fpPlus,
        totalPrmr: totals.prmr,
        totalDoors: totals.doors,
        totalDecisionMakers: totals.decisionMakers,
        totalPitches: totals.pitches,
        totalTransitions: totals.transitions,
        totalPresentations: totals.presentations,
        totalCloses: totals.closes,
        daysWorked: totals.daysWorked,
        totalWorkMinutes: totals.totalMinutes,
        customCounterTotals: totals.customCounters,
        dayOfWeekData,
        funnelData,
        hourlyActivity,
        peakHours,
        hourRange: {
          minHour,
          maxHour,
        },
        dailyTrend,
      };
    },
  });
};
