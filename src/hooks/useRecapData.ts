import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, parseISO } from 'date-fns';

interface DealBreakdown {
  totalDeals: number;
  fpDeals: number;
  upgradeDeals: number;
  avgTimeToSell: number | null;
  avgTimeByType: { fp: number | null; upgrade: number | null };
  totalMoneySpent: number;
  avgSpentPerDeal: number;
  hasCrmData: boolean;
}

interface InputComparison {
  doors: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
}

interface TimeComparison {
  hoursWorked: number;
  avgStartTime: { earlier: boolean; diff: number } | null;
  avgEndTime: { later: boolean; diff: number } | null;
}

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
    doors: number;
    fpPlus: number;
    hoursWorked: number;
    daysWorked: number;
  };
  
  // Input comparisons
  inputComparison: InputComparison;
  
  // Time comparisons
  timeComparison: TimeComparison;
  
  // Personal records (if any were set this period)
  records: {
    mostDoorsInDay: { isRecord: boolean; value: number; previousBest: number };
    mostPitchesInDay: { isRecord: boolean; value: number; previousBest: number };
    mostTransitionsInDay: { isRecord: boolean; value: number; previousBest: number };
    mostPresentationsInDay: { isRecord: boolean; value: number; previousBest: number };
    mostClosesInDay: { isRecord: boolean; value: number; previousBest: number };
    mostFpInDay: { isRecord: boolean; value: number; previousBest: number };
    mostPrmrInDay: { isRecord: boolean; value: number; previousBest: number };
    mostHoursInDay: { isRecord: boolean; value: number; previousBest: number };
    earliestStart: { isRecord: boolean; value: string | null; previousBest: string | null };
    latestEnd: { isRecord: boolean; value: string | null; previousBest: string | null };
  };
  
  // CRM/Deal data (only if user has CRM enabled)
  dealBreakdown?: DealBreakdown;
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

function parseSalesLog(salesLog: any): { type: string; money_spent: number; time_to_sell_minutes: number }[] {
  if (!salesLog || !Array.isArray(salesLog)) return [];
  return salesLog.map((item: any) => ({
    type: item.type || 'FP',
    money_spent: parseFloat(item.money_spent) || 0,
    time_to_sell_minutes: parseFloat(item.time_to_sell_minutes) || 0,
  }));
}

function calculateDealBreakdown(entries: any[]): DealBreakdown | undefined {
  const allDeals: { type: string; money_spent: number; time_to_sell_minutes: number }[] = [];
  
  for (const entry of entries) {
    const deals = parseSalesLog(entry.sales_log);
    allDeals.push(...deals);
  }
  
  if (allDeals.length === 0) {
    return undefined;
  }
  
  const fpDeals = allDeals.filter(d => d.type === 'FP' || d.type === 'Fresh' || d.type === 'Takeover');
  const upgradeDeals = allDeals.filter(d => d.type === 'Upgrade' || d.type === 'UPG');
  
  const totalMoneySpent = allDeals.reduce((sum, d) => sum + d.money_spent, 0);
  
  const dealsWithTime = allDeals.filter(d => d.time_to_sell_minutes > 0);
  const avgTimeToSell = dealsWithTime.length > 0 
    ? dealsWithTime.reduce((sum, d) => sum + d.time_to_sell_minutes, 0) / dealsWithTime.length 
    : null;
  
  const fpDealsWithTime = fpDeals.filter(d => d.time_to_sell_minutes > 0);
  const upgradeDealsWithTime = upgradeDeals.filter(d => d.time_to_sell_minutes > 0);
  
  return {
    totalDeals: allDeals.length,
    fpDeals: fpDeals.length,
    upgradeDeals: upgradeDeals.length,
    avgTimeToSell,
    avgTimeByType: {
      fp: fpDealsWithTime.length > 0 
        ? fpDealsWithTime.reduce((sum, d) => sum + d.time_to_sell_minutes, 0) / fpDealsWithTime.length 
        : null,
      upgrade: upgradeDealsWithTime.length > 0 
        ? upgradeDealsWithTime.reduce((sum, d) => sum + d.time_to_sell_minutes, 0) / upgradeDealsWithTime.length 
        : null,
    },
    totalMoneySpent,
    avgSpentPerDeal: allDeals.length > 0 ? totalMoneySpent / allDeals.length : 0,
    hasCrmData: true,
  };
}

export function useRecapData(period: 'week' | 'month') {
  return useQuery({
    queryKey: ['recap-data', period],
    queryFn: async (): Promise<RecapStats | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get user timezone and CRM settings
      const { data: repData } = await supabase
        .from('reps')
        .select('timezone, crm_enabled')
        .eq('user_id', user.id)
        .single();
      
      const timezone = repData?.timezone || 'America/Los_Angeles';
      const crmEnabled = repData?.crm_enabled || false;

      // Calculate date ranges
      const now = new Date();
      let currentStart: Date, currentEnd: Date, prevStart: Date, prevEnd: Date;
      let periodLabel: string;

      if (period === 'week') {
        const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
        currentStart = lastWeekStart;
        currentEnd = endOfWeek(lastWeekStart, { weekStartsOn: 0 });
        prevStart = startOfWeek(subWeeks(now, 2), { weekStartsOn: 0 });
        prevEnd = endOfWeek(prevStart, { weekStartsOn: 0 });
        periodLabel = `Week of ${format(currentStart, 'MMM d')}`;
      } else {
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
        .select('doors_knocked, pitches, transitions, presentations, closes, fp_plus, prmr, work_start_time, work_end_time, break_periods')
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
          startTimes.push(getLocalDecimalTime(entry.work_start_time, timezone));
        }
        if (entry.work_end_time) {
          endTimes.push(getLocalDecimalTime(entry.work_end_time, timezone));
        }
        if (entry.counter_timestamps && typeof entry.counter_timestamps === 'object') {
          const timestamps = entry.counter_timestamps as Record<string, string[]>;
          const doorTimestamps = timestamps.doors_knocked || [];
          doorTimestamps.forEach((ts: string) => {
            const hour = getLocalHour(ts, timezone);
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
          });
        }
      });

      const avgStartDecimal = startTimes.length > 0 
        ? startTimes.reduce((a, b) => a + b, 0) / startTimes.length
        : null;
      const avgEndDecimal = endTimes.length > 0
        ? endTimes.reduce((a, b) => a + b, 0) / endTimes.length
        : null;

      const avgStartTime = avgStartDecimal !== null ? formatTimeFromDecimal(avgStartDecimal) : null;
      const avgEndTime = avgEndDecimal !== null ? formatTimeFromDecimal(avgEndDecimal) : null;

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
      const prevPitches = prevEntries?.reduce((sum, e) => sum + (e.pitches || 0), 0) || 0;
      const prevTransitions = prevEntries?.reduce((sum, e) => sum + (e.transitions || 0), 0) || 0;
      const prevPresentations = prevEntries?.reduce((sum, e) => sum + (e.presentations || 0), 0) || 0;
      const prevCloses = prevEntries?.reduce((sum, e) => sum + (e.closes || 0), 0) || 0;
      const prevFpPlus = prevEntries?.reduce((sum, e) => sum + (e.fp_plus || 0), 0) || 0;
      const prevHours = prevEntries?.reduce((sum, e) => sum + calculateHoursWorked(e), 0) || 0;
      const prevDaysWorked = prevEntries?.filter(e => 
        (e.doors_knocked || 0) >= 4 && e.work_start_time && e.work_end_time
      ).length || 0;

      // Calculate previous period avg times
      const prevStartTimes: number[] = [];
      const prevEndTimes: number[] = [];
      prevEntries?.forEach(entry => {
        if (entry.work_start_time) {
          prevStartTimes.push(getLocalDecimalTime(entry.work_start_time, timezone));
        }
        if (entry.work_end_time) {
          prevEndTimes.push(getLocalDecimalTime(entry.work_end_time, timezone));
        }
      });
      const prevAvgStartDecimal = prevStartTimes.length > 0 
        ? prevStartTimes.reduce((a, b) => a + b, 0) / prevStartTimes.length
        : null;
      const prevAvgEndDecimal = prevEndTimes.length > 0
        ? prevEndTimes.reduce((a, b) => a + b, 0) / prevEndTimes.length
        : null;

      const comparison = {
        doors: prevDoors > 0 ? ((totalDoors - prevDoors) / prevDoors) * 100 : 0,
        fpPlus: prevFpPlus > 0 ? ((totalFpPlus - prevFpPlus) / prevFpPlus) * 100 : 0,
        hoursWorked: prevHours > 0 ? ((totalHoursWorked - prevHours) / prevHours) * 100 : 0,
        daysWorked: prevDaysWorked > 0 ? ((daysWorked - prevDaysWorked) / prevDaysWorked) * 100 : 0
      };

      const inputComparison: InputComparison = {
        doors: prevDoors > 0 ? ((totalDoors - prevDoors) / prevDoors) * 100 : 0,
        pitches: prevPitches > 0 ? ((totalPitches - prevPitches) / prevPitches) * 100 : 0,
        transitions: prevTransitions > 0 ? ((totalTransitions - prevTransitions) / prevTransitions) * 100 : 0,
        presentations: prevPresentations > 0 ? ((totalPresentations - prevPresentations) / prevPresentations) * 100 : 0,
        closes: prevCloses > 0 ? ((totalCloses - prevCloses) / prevCloses) * 100 : 0,
      };

      const timeComparison: TimeComparison = {
        hoursWorked: prevHours > 0 ? ((totalHoursWorked - prevHours) / prevHours) * 100 : 0,
        avgStartTime: avgStartDecimal !== null && prevAvgStartDecimal !== null
          ? { earlier: avgStartDecimal < prevAvgStartDecimal, diff: Math.abs(avgStartDecimal - prevAvgStartDecimal) * 60 }
          : null,
        avgEndTime: avgEndDecimal !== null && prevAvgEndDecimal !== null
          ? { later: avgEndDecimal > prevAvgEndDecimal, diff: Math.abs(avgEndDecimal - prevAvgEndDecimal) * 60 }
          : null,
      };

      // Check for personal records - all-time
      const allTimeBestDoors = allEntries?.reduce((max, e) => Math.max(max, e.doors_knocked || 0), 0) || 0;
      const allTimeBestPitches = allEntries?.reduce((max, e) => Math.max(max, e.pitches || 0), 0) || 0;
      const allTimeBestTransitions = allEntries?.reduce((max, e) => Math.max(max, e.transitions || 0), 0) || 0;
      const allTimeBestPresentations = allEntries?.reduce((max, e) => Math.max(max, e.presentations || 0), 0) || 0;
      const allTimeBestCloses = allEntries?.reduce((max, e) => Math.max(max, e.closes || 0), 0) || 0;
      const allTimeBestFp = allEntries?.reduce((max, e) => Math.max(max, e.fp_plus || 0), 0) || 0;
      const allTimeBestPrmr = allEntries?.reduce((max, e) => Math.max(max, e.prmr || 0), 0) || 0;
      const allTimeBestHours = allEntries?.reduce((max, e) => Math.max(max, calculateHoursWorked(e)), 0) || 0;
      
      let allTimeEarliestStart: number | null = null;
      let allTimeLatestEnd: number | null = null;
      allEntries?.forEach(e => {
        if (e.work_start_time) {
          const decimal = getLocalDecimalTime(e.work_start_time, timezone);
          if (allTimeEarliestStart === null || decimal < allTimeEarliestStart) {
            allTimeEarliestStart = decimal;
          }
        }
        if (e.work_end_time) {
          const decimal = getLocalDecimalTime(e.work_end_time, timezone);
          if (allTimeLatestEnd === null || decimal > allTimeLatestEnd) {
            allTimeLatestEnd = decimal;
          }
        }
      });
      
      const currentBestDoors = Math.max(...currentEntries.map(e => e.doors_knocked || 0));
      const currentBestPitches = Math.max(...currentEntries.map(e => e.pitches || 0));
      const currentBestTransitions = Math.max(...currentEntries.map(e => e.transitions || 0));
      const currentBestPresentations = Math.max(...currentEntries.map(e => e.presentations || 0));
      const currentBestCloses = Math.max(...currentEntries.map(e => e.closes || 0));
      const currentBestFp = Math.max(...currentEntries.map(e => e.fp_plus || 0));
      const currentBestPrmr = Math.max(...currentEntries.map(e => e.prmr || 0));
      const currentBestHours = Math.max(...currentEntries.map(e => calculateHoursWorked(e)));
      
      let currentEarliestStart: number | null = null;
      let currentLatestEnd: number | null = null;
      currentEntries.forEach(e => {
        if (e.work_start_time) {
          const decimal = getLocalDecimalTime(e.work_start_time, timezone);
          if (currentEarliestStart === null || decimal < currentEarliestStart) {
            currentEarliestStart = decimal;
          }
        }
        if (e.work_end_time) {
          const decimal = getLocalDecimalTime(e.work_end_time, timezone);
          if (currentLatestEnd === null || decimal > currentLatestEnd) {
            currentLatestEnd = decimal;
          }
        }
      });

      const records = {
        mostDoorsInDay: {
          isRecord: currentBestDoors > allTimeBestDoors,
          value: currentBestDoors,
          previousBest: allTimeBestDoors
        },
        mostPitchesInDay: {
          isRecord: currentBestPitches > allTimeBestPitches,
          value: currentBestPitches,
          previousBest: allTimeBestPitches
        },
        mostTransitionsInDay: {
          isRecord: currentBestTransitions > allTimeBestTransitions,
          value: currentBestTransitions,
          previousBest: allTimeBestTransitions
        },
        mostPresentationsInDay: {
          isRecord: currentBestPresentations > allTimeBestPresentations,
          value: currentBestPresentations,
          previousBest: allTimeBestPresentations
        },
        mostClosesInDay: {
          isRecord: currentBestCloses > allTimeBestCloses,
          value: currentBestCloses,
          previousBest: allTimeBestCloses
        },
        mostFpInDay: {
          isRecord: currentBestFp > allTimeBestFp,
          value: currentBestFp,
          previousBest: allTimeBestFp
        },
        mostPrmrInDay: {
          isRecord: currentBestPrmr > allTimeBestPrmr,
          value: currentBestPrmr,
          previousBest: allTimeBestPrmr
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
        },
        latestEnd: {
          isRecord: currentLatestEnd !== null && (allTimeLatestEnd === null || currentLatestEnd > allTimeLatestEnd),
          value: currentLatestEnd !== null ? formatTimeFromDecimal(currentLatestEnd) : null,
          previousBest: allTimeLatestEnd !== null ? formatTimeFromDecimal(allTimeLatestEnd) : null
        },
      };

      // Calculate deal breakdown if CRM is enabled
      const dealBreakdown = crmEnabled ? calculateDealBreakdown(currentEntries) : undefined;

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
        inputComparison,
        timeComparison,
        records,
        dealBreakdown,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
