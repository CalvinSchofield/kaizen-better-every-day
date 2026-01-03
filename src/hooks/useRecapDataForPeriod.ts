import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, subWeeks, subMonths, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { RecapStats } from './useRecapData';

interface DealHighlight {
  date: string;
  type: string;
  prmr: number;
  moneySpent: number;
  timeToSell: number;
  difficulty?: string;
}

interface DealBreakdown {
  totalDeals: number;
  fpDeals: number;
  upgradeDeals: number;
  avgTimeToSell: number | null;
  avgTimeByType: { fp: number | null; upgrade: number | null };
  totalMoneySpent: number;
  avgSpentPerDeal: number;
  hasCrmData: boolean;
  hasDetailedData?: boolean;
  
  // Extended analytics
  totalPrmr: number;
  avgPrmrPerDeal: number;
  avgRoiPerDeal: number;
  
  dealTypeBreakdown: {
    fresh: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
    takeover: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
    diy: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
    upgrade: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
  };
  
  difficultyDistribution: { easy: number; medium: number; hard: number };
  avgDifficultyByType: { fp: number | null; upgrade: number | null };
  
  fastestDeal: DealHighlight | null;
  slowestDeal: DealHighlight | null;
  highestPrmrDeal: DealHighlight | null;
  mostExpensiveDeal: DealHighlight | null;
  earliestFpDeal: DealHighlight | null;
  latestFpDeal: DealHighlight | null;
  earliestUpgradeDeal: DealHighlight | null;
  latestUpgradeDeal: DealHighlight | null;
}

function calculateHoursWorked(entry: any): number {
  if (!entry.work_start_time || !entry.work_end_time) return 0;
  
  const start = new Date(entry.work_start_time);
  const end = new Date(entry.work_end_time);
  let totalMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
  
  if (entry.break_periods && Array.isArray(entry.break_periods)) {
    entry.break_periods.forEach((bp: any) => {
      if (bp.start && bp.end) {
        const breakStart = new Date(bp.start);
        const breakEnd = new Date(bp.end);
        totalMinutes -= (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
      }
    });
  }
  
  return Math.max(0, totalMinutes / 60);
}

function getLocalDecimalTime(isoString: string, timezone: string): number {
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = formatter.format(date).split(':');
    return parseInt(parts[0], 10) + parseInt(parts[1], 10) / 60;
  } catch {
    const date = new Date(isoString);
    return date.getHours() + date.getMinutes() / 60;
  }
}

function formatTimeFromDecimal(decimal: number): string {
  const hours = Math.floor(decimal);
  const minutes = Math.round((decimal - hours) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function getLocalHour(isoString: string, timezone: string): number {
  try {
    const date = new Date(isoString);
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(date), 10);
  } catch {
    return new Date(isoString).getHours();
  }
}

interface ParsedDeal {
  type: string;
  money_spent: number;
  time_to_sell_minutes: number;
  prmr: number;
  difficulty: string;
  date: string;
  timestamp: string;
}

function difficultyToNumber(difficulty: string): number {
  switch (difficulty?.toLowerCase()) {
    case 'easy': return 1;
    case 'medium': return 2;
    case 'hard': return 3;
    default: return 2;
  }
}

function calculateDealBreakdown(entries: any[]): DealBreakdown | undefined {
  const allDeals: ParsedDeal[] = [];
  let totalFpFromEntries = 0;
  let totalUpgradePrmr = 0;
  let totalPrmrFromEntries = 0;
  
  entries.forEach(entry => {
    totalFpFromEntries += entry.fp_plus || 0;
    totalUpgradePrmr += entry.upgrade_prmr || 0;
    totalPrmrFromEntries += (entry.prmr || 0) + (entry.upgrade_prmr || 0);
    
    if (entry.sales_log && Array.isArray(entry.sales_log)) {
      entry.sales_log.forEach((sale: any) => {
        allDeals.push({
          type: sale.type || 'FP',
          prmr: parseFloat(sale.prmr) || 0,
          money_spent: parseFloat(sale.money_spent) || 0,
          time_to_sell_minutes: parseFloat(sale.time_to_sell_minutes) || 0,
          difficulty: sale.difficulty || 'medium',
          date: entry.entry_date,
          timestamp: sale.timestamp || entry.entry_date,
        });
      });
    }
  });
  
  const hasDetailedData = allDeals.length > 0;
  
  if (!hasDetailedData && totalFpFromEntries === 0) {
    return undefined;
  }
  
  const freshDeals = allDeals.filter(d => d.type === 'Fresh' || d.type === 'FP');
  const takeoverDeals = allDeals.filter(d => d.type === 'Takeover' || d.type === 'TO');
  const diyDeals = allDeals.filter(d => d.type === 'DIY');
  const upgradeDeals = allDeals.filter(d => d.type === 'Upgrade' || d.type === 'UPG');
  const fpDeals = [...freshDeals, ...takeoverDeals, ...diyDeals];
  
  const inferredFpDeals = hasDetailedData ? fpDeals.length : totalFpFromEntries;
  const inferredUpgradeDeals = hasDetailedData ? upgradeDeals.length : (totalUpgradePrmr > 0 ? Math.ceil(totalUpgradePrmr / 50) : 0);
  const inferredTotalDeals = hasDetailedData ? allDeals.length : (inferredFpDeals + inferredUpgradeDeals);
  
  const totalMoneySpent = allDeals.reduce((sum, d) => sum + d.money_spent, 0);
  const totalPrmr = hasDetailedData ? allDeals.reduce((sum, d) => sum + d.prmr, 0) : totalPrmrFromEntries;
  
  const dealsWithTime = allDeals.filter(d => d.time_to_sell_minutes > 0);
  const avgTimeToSell = dealsWithTime.length > 0 
    ? dealsWithTime.reduce((sum, d) => sum + d.time_to_sell_minutes, 0) / dealsWithTime.length 
    : null;
  
  const fpDealsWithTime = fpDeals.filter(d => d.time_to_sell_minutes > 0);
  const upgradeDealsWithTime = upgradeDeals.filter(d => d.time_to_sell_minutes > 0);
  
  const calcTypeStats = (deals: ParsedDeal[]) => {
    const withTime = deals.filter(d => d.time_to_sell_minutes > 0);
    const withDifficulty = deals.filter(d => d.difficulty);
    return {
      count: deals.length,
      totalPrmr: deals.reduce((sum, d) => sum + d.prmr, 0),
      totalCost: deals.reduce((sum, d) => sum + d.money_spent, 0),
      avgTime: withTime.length > 0 ? withTime.reduce((sum, d) => sum + d.time_to_sell_minutes, 0) / withTime.length : null,
      avgDifficulty: withDifficulty.length > 0 ? withDifficulty.reduce((sum, d) => sum + difficultyToNumber(d.difficulty), 0) / withDifficulty.length : null,
    };
  };
  
  const dealTypeBreakdown = {
    fresh: calcTypeStats(freshDeals),
    takeover: calcTypeStats(takeoverDeals),
    diy: calcTypeStats(diyDeals),
    upgrade: calcTypeStats(upgradeDeals),
  };
  
  const difficultyDistribution = {
    easy: allDeals.filter(d => d.difficulty?.toLowerCase() === 'easy').length,
    medium: allDeals.filter(d => d.difficulty?.toLowerCase() === 'medium' || !d.difficulty).length,
    hard: allDeals.filter(d => d.difficulty?.toLowerCase() === 'hard').length,
  };
  
  const fpWithDifficulty = fpDeals.filter(d => d.difficulty);
  const upgradeWithDifficulty = upgradeDeals.filter(d => d.difficulty);
  const avgDifficultyByType = {
    fp: fpWithDifficulty.length > 0 ? fpWithDifficulty.reduce((sum, d) => sum + difficultyToNumber(d.difficulty), 0) / fpWithDifficulty.length : null,
    upgrade: upgradeWithDifficulty.length > 0 ? upgradeWithDifficulty.reduce((sum, d) => sum + difficultyToNumber(d.difficulty), 0) / upgradeWithDifficulty.length : null,
  };
  
  const toHighlight = (d: ParsedDeal): DealHighlight => ({
    date: d.date,
    type: d.type,
    prmr: d.prmr,
    moneySpent: d.money_spent,
    timeToSell: d.time_to_sell_minutes,
    difficulty: d.difficulty,
  });
  
  const sortedByTime = [...dealsWithTime].sort((a, b) => a.time_to_sell_minutes - b.time_to_sell_minutes);
  const sortedByPrmr = [...allDeals].filter(d => d.prmr > 0).sort((a, b) => b.prmr - a.prmr);
  const sortedByCost = [...allDeals].filter(d => d.money_spent > 0).sort((a, b) => b.money_spent - a.money_spent);
  const sortedFpByDate = [...fpDeals].sort((a, b) => new Date(a.timestamp || a.date).getTime() - new Date(b.timestamp || b.date).getTime());
  const sortedUpgradeByDate = [...upgradeDeals].sort((a, b) => new Date(a.timestamp || a.date).getTime() - new Date(b.timestamp || b.date).getTime());
  
  return {
    totalDeals: inferredTotalDeals,
    fpDeals: inferredFpDeals,
    upgradeDeals: inferredUpgradeDeals,
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
    avgSpentPerDeal: inferredTotalDeals > 0 ? totalMoneySpent / inferredTotalDeals : 0,
    hasCrmData: true,
    hasDetailedData,
    
    totalPrmr,
    avgPrmrPerDeal: inferredTotalDeals > 0 ? totalPrmr / inferredTotalDeals : 0,
    avgRoiPerDeal: totalMoneySpent > 0 ? totalPrmr / totalMoneySpent : 0,
    
    dealTypeBreakdown,
    difficultyDistribution,
    avgDifficultyByType,
    
    fastestDeal: sortedByTime[0] ? toHighlight(sortedByTime[0]) : null,
    slowestDeal: sortedByTime.length > 0 ? toHighlight(sortedByTime[sortedByTime.length - 1]) : null,
    highestPrmrDeal: sortedByPrmr[0] ? toHighlight(sortedByPrmr[0]) : null,
    mostExpensiveDeal: sortedByCost[0] ? toHighlight(sortedByCost[0]) : null,
    earliestFpDeal: sortedFpByDate[0] ? toHighlight(sortedFpByDate[0]) : null,
    latestFpDeal: sortedFpByDate.length > 0 ? toHighlight(sortedFpByDate[sortedFpByDate.length - 1]) : null,
    earliestUpgradeDeal: sortedUpgradeByDate[0] ? toHighlight(sortedUpgradeByDate[0]) : null,
    latestUpgradeDeal: sortedUpgradeByDate.length > 0 ? toHighlight(sortedUpgradeByDate[sortedUpgradeByDate.length - 1]) : null,
  };
}

interface UseRecapDataForPeriodParams {
  periodType: 'week' | 'month';
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
  enabled?: boolean;
}

export function useRecapDataForPeriod({ 
  periodType, 
  periodStart, 
  periodEnd, 
  periodLabel,
  enabled = true 
}: UseRecapDataForPeriodParams) {
  return useQuery({
    queryKey: ['recap-data-period', periodType, periodStart.toISOString(), periodEnd.toISOString()],
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

      // Calculate previous period date range
      let prevStart: Date, prevEnd: Date;
      if (periodType === 'week') {
        prevStart = startOfWeek(subWeeks(periodStart, 1), { weekStartsOn: 0 });
        prevEnd = endOfWeek(prevStart, { weekStartsOn: 0 });
      } else {
        prevStart = startOfMonth(subMonths(periodStart, 1));
        prevEnd = endOfMonth(prevStart);
      }

      const currentStartStr = format(periodStart, 'yyyy-MM-dd');
      const currentEndStr = format(periodEnd, 'yyyy-MM-dd');
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

      const inputComparison = {
        doors: prevDoors > 0 ? ((totalDoors - prevDoors) / prevDoors) * 100 : 0,
        pitches: prevPitches > 0 ? ((totalPitches - prevPitches) / prevPitches) * 100 : 0,
        transitions: prevTransitions > 0 ? ((totalTransitions - prevTransitions) / prevTransitions) * 100 : 0,
        presentations: prevPresentations > 0 ? ((totalPresentations - prevPresentations) / prevPresentations) * 100 : 0,
        closes: prevCloses > 0 ? ((totalCloses - prevCloses) / prevCloses) * 100 : 0,
      };

      const timeComparison = {
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
        period: periodType,
        periodLabel,
        dateRange: { start: periodStart, end: periodEnd },
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
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
