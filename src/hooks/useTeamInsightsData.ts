import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, startOfDay, endOfDay, differenceInMinutes, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface DailyEntry {
  user_id: string;
  entry_date: string;
  doors_knocked: number;
  decision_makers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp_plus: number;
  prmr: number;
  upgrade_prmr: number;
  work_start_time: string | null;
  work_end_time: string | null;
  break_periods: any;
  counter_timestamps: any;
  timezone: string | null;
}

interface RepInfo {
  user_id: string;
  name: string;
  year: string;
  teamName?: string;
  mgmtGroupName?: string;
}

interface TeamInsightsData {
  // Totals
  totalDoors: number;
  totalDMs: number;
  totalPitches: number;
  totalTransitions: number;
  totalPresentations: number;
  totalCloses: number;
  totalFP: number;
  totalUpgradeFP: number;
  totalPRMR: number;
  totalUpgradePRMR: number;
  totalWorkMinutes: number;
  daysWorked: number;
  
  // Ratios
  doorsToFp: number;
  doorsToPresentation: number;
  pitchesToFp: number;
  transitionsToFp: number;
  presentationsToClose: number;
  
  // Overall comparisons (all-time averages)
  overallDoorsToFp: number;
  overallPitchesToFp: number;
  overallTransitionsToFp: number;
  overallPresentationsToClose: number;
  
  // Productivity
  doorsPerHour: number;
  pitchesPerHour: number;
  transitionsPerHour: number;
  presentationsPerHour: number;
  hoursToFp: number;
  
  // Timing
  avgStartTime: string;
  avgEndTime: string;
  avgHoursWorked: number;
  mostProductiveHour: number | null;
  
  // Best periods
  bestDay: { date: string; fp: number; efp: number; repName: string; stats: string } | null;
  bestWeek: { weekStart: string; weekEnd: string; fp: number; efp: number; stats: string } | null;
  bestMonth: { month: string; fp: number; efp: number; stats: string } | null;
  bestTransitionsDay: { date: string; transitions: number; fp: number; efp: number; repName: string } | null;
  bestDayOfWeek: { day: string; avgFp: number; avgEfp: number; daysWorked: number } | null;
  
  // Visualizations data
  dailyTrend: Array<{
    date: string;
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    fp: number;
    efp: number;
    prmr: number;
  }>;
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
  
  // Individual breakdowns
  repBreakdown: Array<{
    userId: string;
    name: string;
    year: string;
    teamName: string;
    mgmtGroupName: string;
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    upgradeFP: number;
    prmr: number;
    upgradePRMR: number;
    doorsToFpRatio: number;
    hoursWorked: number;
  }>;
}

interface UseTeamInsightsDataParams {
  userIds: string[];
  dateRange: { start: string; end: string };
  excludeUserIds?: string[];
}

const calculateLocalTime = (utcTimestamp: string, timezone: string): { hour: number; minute: number } => {
  const date = new Date(utcTimestamp);
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone || 'America/Denver',
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

export const useTeamInsightsData = ({ userIds, dateRange, excludeUserIds = [] }: UseTeamInsightsDataParams) => {
  return useQuery({
    queryKey: ['team-insights', userIds, dateRange, excludeUserIds],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('fetch-team-insights', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: {
          userIds,
          dateRange,
          excludeUserIds,
        },
      });

      if (error) throw error;

      const entries = data.entries as DailyEntry[];
      const reps = data.reps as RepInfo[];
      
      // Fetch all entries for overall comparison (all-time)
      const allUserIds = reps.map(r => r.user_id);
      const { data: allEntries, error: allError } = await supabase
        .from('daily_entries')
        .select('*')
        .in('user_id', allUserIds)
        .eq('is_finalized', true);

      if (allError) throw allError;

      // Filter entries with activity for ratio calculations
      const entriesWithActivity = entries.filter(entry =>
        (entry.doors_knocked || 0) > 0 ||
        (entry.decision_makers || 0) > 0 ||
        (entry.pitches || 0) > 0 ||
        (entry.transitions || 0) > 0 ||
        (entry.presentations || 0) > 0 ||
        (entry.closes || 0) > 0
      );

      const allEntriesWithActivity = allEntries.filter(entry =>
        (entry.doors_knocked || 0) > 0 ||
        (entry.decision_makers || 0) > 0 ||
        (entry.pitches || 0) > 0 ||
        (entry.transitions || 0) > 0 ||
        (entry.presentations || 0) > 0 ||
        (entry.closes || 0) > 0
      );

      // Calculate totals for the period (use ALL entries)
      const totals = entries.reduce((acc, entry) => {
        acc.doors += entry.doors_knocked || 0;
        acc.dms += entry.decision_makers || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        acc.fp += entry.fp_plus || 0;
        acc.prmr += entry.prmr || 0;
        acc.upgradePRMR += entry.upgrade_prmr || 0;
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
          
          acc.totalMinutes += minutes;
        }
        
        return acc;
      }, { doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0, upgradePRMR: 0, daysWorked: 0, totalMinutes: 0 });

      // Activity-based totals for ratios
      const activityTotals = entriesWithActivity.reduce((acc, entry) => {
        acc.fp += entry.fp_plus || 0;
        acc.doors += entry.doors_knocked || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        
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
          
          acc.totalMinutes += minutes;
        }
        
        return acc;
      }, { fp: 0, doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, totalMinutes: 0 });

      // Overall averages (all-time with activity)
      const overallTotals = allEntriesWithActivity.reduce((acc, entry) => {
        acc.fp += entry.fp_plus || 0;
        acc.doors += entry.doors_knocked || 0;
        acc.pitches += entry.pitches || 0;
        acc.transitions += entry.transitions || 0;
        acc.presentations += entry.presentations || 0;
        acc.closes += entry.closes || 0;
        return acc;
      }, { fp: 0, doors: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0 });

      const totalUpgradeFP = totals.upgradePRMR / 85;
      const totalHours = totals.totalMinutes / 60;
      const activityHours = activityTotals.totalMinutes / 60;

      // Calculate ratios
      const doorsToFp = activityTotals.fp > 0 ? activityTotals.doors / activityTotals.fp : 0;
      const doorsToPresentation = activityTotals.presentations > 0 ? activityTotals.doors / activityTotals.presentations : 0;
      const pitchesToFp = activityTotals.fp > 0 ? activityTotals.pitches / activityTotals.fp : 0;
      const transitionsToFp = activityTotals.fp > 0 ? activityTotals.transitions / activityTotals.fp : 0;
      const presentationsToClose = activityTotals.closes > 0 ? activityTotals.presentations / activityTotals.closes : 0;

      const overallDoorsToFp = overallTotals.fp > 0 ? overallTotals.doors / overallTotals.fp : 0;
      const overallPitchesToFp = overallTotals.fp > 0 ? overallTotals.pitches / overallTotals.fp : 0;
      const overallTransitionsToFp = overallTotals.fp > 0 ? overallTotals.transitions / overallTotals.fp : 0;
      const overallPresentationsToClose = overallTotals.closes > 0 ? overallTotals.presentations / overallTotals.closes : 0;

      // Productivity metrics
      const doorsPerHour = activityHours > 0 ? activityTotals.doors / activityHours : 0;
      const pitchesPerHour = activityHours > 0 ? activityTotals.pitches / activityHours : 0;
      const transitionsPerHour = activityHours > 0 ? activityTotals.transitions / activityHours : 0;
      const presentationsPerHour = activityHours > 0 ? activityTotals.presentations / activityHours : 0;
      const hoursToFp = activityTotals.fp > 0 ? activityHours / activityTotals.fp : 0;

      // Timing metrics
      const userTimezone = 'America/Denver';
      const timesData = entries
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

      const avgHoursWorked = totals.daysWorked > 0 ? totalHours / totals.daysWorked : 0;

      // Hourly activity breakdown
      const hourlyActivity = {
        doors: {} as Record<number, number>,
        pitches: {} as Record<number, number>,
        transitions: {} as Record<number, number>,
        presentations: {} as Record<number, number>,
        closes: {} as Record<number, number>,
      };

      entries.forEach(entry => {
        if (entry.counter_timestamps && typeof entry.counter_timestamps === 'object') {
          const timestamps = entry.counter_timestamps as Record<string, string[]>;
          
          Object.entries(timestamps).forEach(([activity, stamps]) => {
            if (Array.isArray(stamps)) {
              stamps.forEach((timestamp: string) => {
                const local = calculateLocalTime(timestamp, userTimezone);
                if (activity === 'doorsKnocked') {
                  hourlyActivity.doors[local.hour] = (hourlyActivity.doors[local.hour] || 0) + 1;
                } else if (activity === 'pitches') {
                  hourlyActivity.pitches[local.hour] = (hourlyActivity.pitches[local.hour] || 0) + 1;
                } else if (activity === 'transitions') {
                  hourlyActivity.transitions[local.hour] = (hourlyActivity.transitions[local.hour] || 0) + 1;
                } else if (activity === 'presentations') {
                  hourlyActivity.presentations[local.hour] = (hourlyActivity.presentations[local.hour] || 0) + 1;
                } else if (activity === 'closes') {
                  hourlyActivity.closes[local.hour] = (hourlyActivity.closes[local.hour] || 0) + 1;
                }
              });
            }
          });
        }
      });

      // Peak hours
      const getPeakHour = (activity: Record<number, number>) => {
        const entries = Object.entries(activity);
        if (entries.length === 0) return null;
        return parseInt(entries.reduce((best, [hour, count]) => count > best[1] ? [hour, count] : best, ['0', 0])[0]);
      };

      const peakHours = {
        doors: getPeakHour(hourlyActivity.doors),
        pitches: getPeakHour(hourlyActivity.pitches),
        transitions: getPeakHour(hourlyActivity.transitions),
        presentations: getPeakHour(hourlyActivity.presentations),
        closes: getPeakHour(hourlyActivity.closes),
      };

      // Most productive hour (most pitches)
      const mostProductiveHour = peakHours.pitches;

      // Hour range
      const allHours = [
        ...Object.keys(hourlyActivity.doors),
        ...Object.keys(hourlyActivity.pitches),
        ...Object.keys(hourlyActivity.transitions),
        ...Object.keys(hourlyActivity.presentations),
        ...Object.keys(hourlyActivity.closes),
      ].map(Number);

      const hourRange = allHours.length > 0 ? {
        minHour: Math.min(...allHours),
        maxHour: Math.max(...allHours),
      } : { minHour: 9, maxHour: 21 };

      // Funnel data
      const funnelData = {
        doors: { 
          total: totals.doors, 
          conversionToNext: totals.doors > 0 ? (totals.dms / totals.doors) * 100 : 0 
        },
        decisionMakers: { 
          total: totals.dms, 
          conversionToNext: totals.dms > 0 ? (totals.pitches / totals.dms) * 100 : 0 
        },
        pitches: { 
          total: totals.pitches, 
          conversionToNext: totals.pitches > 0 ? (totals.transitions / totals.pitches) * 100 : 0 
        },
        transitions: { 
          total: totals.transitions, 
          conversionToNext: totals.transitions > 0 ? (totals.presentations / totals.transitions) * 100 : 0 
        },
        presentations: { 
          total: totals.presentations, 
          conversionToNext: totals.presentations > 0 ? (totals.closes / totals.presentations) * 100 : 0 
        },
        closes: { total: totals.closes },
      };

      // Daily trend
      const dailyTrend = Array.from(
        entries.reduce((acc, entry) => {
          const date = entry.entry_date;
          if (!acc.has(date)) {
            acc.set(date, {
              date,
              doors: 0,
              pitches: 0,
              transitions: 0,
              presentations: 0,
              fp: 0,
              prmr: 0,
              efp: 0,
            });
          }
          const day = acc.get(date)!;
          day.doors += entry.doors_knocked || 0;
          day.pitches += entry.pitches || 0;
          day.transitions += entry.transitions || 0;
          day.presentations += entry.presentations || 0;
          day.fp += entry.fp_plus || 0;
          day.prmr += entry.prmr || 0;
          day.efp += (entry.prmr || 0) / 85;
          return acc;
        }, new Map())
      ).map(([_, value]) => value).sort((a, b) => a.date.localeCompare(b.date));

      // Day of week data
      const dayOfWeekData: Record<string, any> = {};
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      
      entries.forEach(entry => {
        const date = parseISO(entry.entry_date);
        const dayIndex = date.getDay();
        const dayName = dayNames[dayIndex];
        
        if (!dayOfWeekData[dayName]) {
          dayOfWeekData[dayName] = {
            totalFp: 0,
            totalEfp: 0,
            totalDoors: 0,
            totalPitches: 0,
            totalTransitions: 0,
            totalPresentations: 0,
            totalCloses: 0,
            totalMinutes: 0,
            count: 0,
          };
        }
        
        const day = dayOfWeekData[dayName];
        day.totalFp += entry.fp_plus || 0;
        day.totalEfp += (entry.prmr || 0) / 85;
        day.totalDoors += entry.doors_knocked || 0;
        day.totalPitches += entry.pitches || 0;
        day.totalTransitions += entry.transitions || 0;
        day.totalPresentations += entry.presentations || 0;
        day.totalCloses += entry.closes || 0;
        
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          let minutes = differenceInMinutes(end, start);
          
          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((bp: any) => {
              minutes -= differenceInMinutes(new Date(bp.end), new Date(bp.start));
            });
          }
          
          day.totalMinutes += minutes;
        }
        
        day.count += 1;
      });

      Object.keys(dayOfWeekData).forEach(dayName => {
        const day = dayOfWeekData[dayName];
        dayOfWeekData[dayName] = {
          avgFp: day.totalFp / day.count,
          avgEfp: day.totalEfp / day.count,
          avgDoors: day.totalDoors / day.count,
          avgPitches: day.totalPitches / day.count,
          avgTransitions: day.totalTransitions / day.count,
          avgPresentations: day.totalPresentations / day.count,
          avgCloses: day.totalCloses / day.count,
          avgHours: (day.totalMinutes / 60) / day.count,
          daysWorked: day.count,
        };
      });

      // Best day of week
      const bestDayOfWeek = Object.entries(dayOfWeekData)
        .filter(([_, data]) => data.daysWorked > 0)
        .sort(([, a], [, b]) => b.avgFp - a.avgFp)[0];

      const bestDayOfWeekData = bestDayOfWeek ? {
        day: bestDayOfWeek[0].charAt(0).toUpperCase() + bestDayOfWeek[0].slice(1),
        avgFp: bestDayOfWeek[1].avgFp,
        avgEfp: bestDayOfWeek[1].avgEfp,
        daysWorked: bestDayOfWeek[1].daysWorked,
      } : null;

      // Best day
      const dayTotals = entries.reduce((acc, entry) => {
        const date = entry.entry_date;
        if (!acc[date]) {
          acc[date] = { fp: 0, prmr: 0, doors: 0, closes: 0, userId: entry.user_id };
        }
        acc[date].fp += entry.fp_plus || 0;
        acc[date].prmr += entry.prmr || 0;
        acc[date].doors += entry.doors_knocked || 0;
        acc[date].closes += entry.closes || 0;
        return acc;
      }, {} as Record<string, { fp: number; prmr: number; doors: number; closes: number; userId: string }>);

      const bestDayEntry = Object.entries(dayTotals).sort(([, a], [, b]) => b.fp - a.fp)[0];
      const bestDay = bestDayEntry ? {
        date: format(parseISO(bestDayEntry[0]), 'MMM d, yyyy'),
        fp: bestDayEntry[1].fp,
        efp: bestDayEntry[1].prmr / 85,
        repName: reps.find(r => r.user_id === bestDayEntry[1].userId)?.name || 'Team',
        stats: `${bestDayEntry[1].doors} doors · ${bestDayEntry[1].closes} closes`,
      } : null;

      // Best week (Monday-Saturday)
      const weeklyData: Record<string, { fp: number; prmr: number; doors: number; closes: number }> = {};
      entries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date);
        const dayOfWeek = entryDate.getDay();
        
        if (dayOfWeek === 0) return; // Skip Sundays
        
        const monday = startOfWeek(entryDate, { weekStartsOn: 1 });
        const weekKey = format(monday, 'yyyy-MM-dd');
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { fp: 0, prmr: 0, doors: 0, closes: 0 };
        }
        
        weeklyData[weekKey].fp += entry.fp_plus || 0;
        weeklyData[weekKey].prmr += entry.prmr || 0;
        weeklyData[weekKey].doors += entry.doors_knocked || 0;
        weeklyData[weekKey].closes += entry.closes || 0;
      });

      const bestWeekEntry = Object.entries(weeklyData).sort(([, a], [, b]) => b.fp - a.fp)[0];
      const bestWeek = bestWeekEntry ? {
        weekStart: format(parseISO(bestWeekEntry[0]), 'MMM d'),
        weekEnd: format(endOfWeek(parseISO(bestWeekEntry[0]), { weekStartsOn: 1 }), 'MMM d, yyyy'),
        fp: bestWeekEntry[1].fp,
        efp: bestWeekEntry[1].prmr / 85,
        stats: `${bestWeekEntry[1].doors} doors · ${bestWeekEntry[1].closes} closes`,
      } : null;

      // Best month
      const monthlyData: Record<string, { fp: number; prmr: number; doors: number; closes: number }> = {};
      entries.forEach(entry => {
        const entryDate = parseISO(entry.entry_date);
        const monthKey = format(startOfMonth(entryDate), 'yyyy-MM');
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { fp: 0, prmr: 0, doors: 0, closes: 0 };
        }
        
        monthlyData[monthKey].fp += entry.fp_plus || 0;
        monthlyData[monthKey].prmr += entry.prmr || 0;
        monthlyData[monthKey].doors += entry.doors_knocked || 0;
        monthlyData[monthKey].closes += entry.closes || 0;
      });

      const bestMonthEntry = Object.entries(monthlyData).sort(([, a], [, b]) => b.fp - a.fp)[0];
      const bestMonth = bestMonthEntry ? {
        month: format(parseISO(bestMonthEntry[0] + '-01'), 'MMMM yyyy'),
        fp: bestMonthEntry[1].fp,
        efp: bestMonthEntry[1].prmr / 85,
        stats: `${bestMonthEntry[1].doors} doors · ${bestMonthEntry[1].closes} closes`,
      } : null;

      // Best transitions day
      const bestTransitionsEntry = entries
        .filter(e => (e.transitions || 0) > 0)
        .sort((a, b) => (b.transitions || 0) - (a.transitions || 0))[0];

      const bestTransitionsDay = bestTransitionsEntry ? {
        date: format(parseISO(bestTransitionsEntry.entry_date), 'MMM d, yyyy'),
        transitions: bestTransitionsEntry.transitions || 0,
        fp: bestTransitionsEntry.fp_plus || 0,
        efp: (bestTransitionsEntry.prmr || 0) / 85,
        repName: reps.find(r => r.user_id === bestTransitionsEntry.user_id)?.name || 'Team',
      } : null;

      // Rep breakdown
      const repBreakdown = reps.map(rep => {
        const repEntries = entries.filter(e => e.user_id === rep.user_id);
        const repTotals = repEntries.reduce((acc, e) => ({
          doors: acc.doors + (e.doors_knocked || 0),
          dms: acc.dms + (e.decision_makers || 0),
          pitches: acc.pitches + (e.pitches || 0),
          transitions: acc.transitions + (e.transitions || 0),
          presentations: acc.presentations + (e.presentations || 0),
          closes: acc.closes + (e.closes || 0),
          fp: acc.fp + (e.fp_plus || 0),
          prmr: acc.prmr + (e.prmr || 0),
          upgradePRMR: acc.upgradePRMR + (e.upgrade_prmr || 0),
        }), { doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0, upgradePRMR: 0 });

        const repHours = repEntries.reduce((acc, e) => {
          if (e.work_start_time && e.work_end_time) {
            const start = new Date(e.work_start_time);
            const end = new Date(e.work_end_time);
            let minutes = differenceInMinutes(end, start);
            
            if (e.break_periods && Array.isArray(e.break_periods)) {
              e.break_periods.forEach((bp: any) => {
                minutes -= differenceInMinutes(new Date(bp.end), new Date(bp.start));
              });
            }
            
            return acc + (minutes / 60);
          }
          return acc;
        }, 0);

        const upgradeFP = repTotals.upgradePRMR / 85;

        return {
          userId: rep.user_id,
          name: rep.name,
          year: rep.year,
          teamName: rep.teamName || 'Unknown Team',
          mgmtGroupName: rep.mgmtGroupName || 'Unknown Group',
          doors: repTotals.doors,
          dms: repTotals.dms,
          pitches: repTotals.pitches,
          transitions: repTotals.transitions,
          presentations: repTotals.presentations,
          closes: repTotals.closes,
          fp: repTotals.fp,
          upgradeFP,
          prmr: repTotals.prmr,
          upgradePRMR: repTotals.upgradePRMR,
          doorsToFpRatio: repTotals.doors > 0 ? repTotals.doors / repTotals.fp : 0,
          hoursWorked: repHours,
        };
      });

      return {
        totalDoors: totals.doors,
        totalDMs: totals.dms,
        totalPitches: totals.pitches,
        totalTransitions: totals.transitions,
        totalPresentations: totals.presentations,
        totalCloses: totals.closes,
        totalFP: totals.fp,
        totalUpgradeFP,
        totalPRMR: totals.prmr,
        totalUpgradePRMR: totals.upgradePRMR,
        totalWorkMinutes: totals.totalMinutes,
        daysWorked: totals.daysWorked,
        doorsToFp,
        doorsToPresentation,
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
        avgStartTime,
        avgEndTime,
        avgHoursWorked,
        mostProductiveHour,
        bestDay,
        bestWeek,
        bestMonth,
        bestTransitionsDay,
        bestDayOfWeek: bestDayOfWeekData,
        dailyTrend,
        dayOfWeekData,
        funnelData,
        hourlyActivity,
        peakHours,
        hourRange,
        repBreakdown,
      } as TeamInsightsData;
    },
    enabled: userIds.length > 0,
  });
};
