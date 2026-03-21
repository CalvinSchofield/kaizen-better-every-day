/**
 * Unified Goal Pace Calculator
 * 
 * Single source of truth for all goal progress calculations across the app.
 * Supports Day/Week/Month/Season timeframes with consistent catch-up pace math.
 * 
 * Catch-up pace formula:
 *   dailyNeeded = (goal - currentProgress) / remainingPlannedDays
 *   weeklyNeeded = dailyNeeded × 6
 *   expected = dailyNeeded × elapsedPlannedDays (within timeframe)
 * 
 * Personalized severity (matches What-If drawer):
 *   green: dailyNeeded ≤ userDailyAvg
 *   amber: dailyNeeded ≤ userDailyAvg × 1.5
 *   red: dailyNeeded > userDailyAvg × 1.5
 */

import { useMemo } from 'react';
import { useRepGoals } from './useRepGoals';
import { usePreseasonFP } from './usePreseasonFP';
import { useEfpMode } from './useEfpMode';
import { usePlannedDays } from './usePlannedDays';
import { useFocusTier, FocusTier } from './useFocusTier';
import { useCurrentUserId } from './useCurrentUserId';
import { useRepData } from './useRepData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from 'date-fns';

// Season boundaries
const PRESEASON_END = '2026-04-11';
const SUMMER_END = '2026-09-27';

export type PaceSeverity = 'green' | 'amber' | 'red';

export interface TimeframeData {
  actual: number;
  funded: number;
  live: number;
  pending: number;
  expected: number;
  goal: number;
  remaining: number;
  plannedDaysElapsed: number;
  plannedDaysTotal: number;
  paceDiff: number;
  isAhead: boolean;
  label: string;
}

export interface GoalPaceData {
  // Active goal info
  activeGoal: number;
  /** Raw goal without cancel-rate buffer — used as the display denominator */
  unbufferedGoal: number;
  tierLabel: string;
  focusTier: FocusTier | 'preseason';
  isPreseason: boolean;
  metricLabel: string;

  // Catch-up pace
  dailyNeeded: number;
  weeklyNeeded: number;

  // Per-season daily paces (for calendar display across season boundaries)
  preseasonDailyPace: number;
  summerDailyPace: number;

  // Severity
  severity: PaceSeverity;
  userDailyAvg: number;

  // Overall progress
  currentProgress: number;
  overallProgressPercent: number;

  // Timeframe data
  day: TimeframeData;
  week: TimeframeData;
  month: TimeframeData;
  season: TimeframeData;

  // Tier options (for summer mode)
  allTiers: { key: string; label: string; goal: number; funded: number; complete: boolean }[];
  onTierChange?: (tier: FocusTier) => Promise<void>;

  // Loading state
  isLoading: boolean;
  hasGoals: boolean;

  // Tracking depth — used for guardrails on expected markers
  knockingDaysCompleted: number;
}

// =====================================================
// PURE CALCULATION FUNCTION (no hooks, testable)
// =====================================================

export interface GoalPaceInput {
  // Goals
  preseasonGoal: number;
  mustDoGoal: number;
  willDoGoal: number;
  couldDoGoal: number;
  cancelRate: number;
  focusTier: FocusTier;
  isPreseason: boolean;
  setupComplete: boolean;

  // Progress
  currentProgress: number; // YTD/season total (FP+ or EFP)
  todayFP: number; // Today's finalized FP
  todayLiveFP: number; // Today's unfinalized FP

  // Planned days arrays (date strings 'yyyy-MM-dd')
  allPlannedDays: string[];
  
  // Entries for period calculations
  entries: Array<{
    entry_date: string;
    fp_plus: number;
    prmr: number;
    is_finalized: boolean;
    doors_knocked: number;
    work_start_time: string | null;
    work_end_time: string | null;
    sales_log?: any[];
  }>;

  // Season config
  personalSummerStart: string | null;
  personalSummerEnd: string | null;

  // Display mode
  efpModeEnabled: boolean;
  conversionFactor: number; // For EFP conversion
  metricLabel: string;

  // For severity calculation
  knockingDaysCompleted: number;

  // Historical summer daily average for preseason severity calibration
  historicalSummerAvg?: number;

  // Reference date (defaults to today)
  referenceDate?: Date;
}

const getLocalToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export function calculateGoalPace(input: GoalPaceInput): Omit<GoalPaceData, 'onTierChange' | 'isLoading' | 'allTiers'> {
  const today = input.referenceDate || getLocalToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Determine active goal with cancel rate buffer
  const applyBuffer = (goal: number) => {
    const cr = input.cancelRate;
    return cr > 0 && cr < 1 ? goal / (1 - cr) : goal;
  };

  let rawGoal: number;
  let tierLabel: string;
  
  if (input.isPreseason) {
    rawGoal = input.preseasonGoal;
    tierLabel = 'Preseason';
  } else {
    switch (input.focusTier) {
      case 'mustDo': rawGoal = input.mustDoGoal; tierLabel = 'Must Do'; break;
      case 'couldDo': rawGoal = input.couldDoGoal; tierLabel = 'Could Do'; break;
      default: rawGoal = input.willDoGoal; tierLabel = 'Will Do'; break;
    }
  }

  const activeGoal = applyBuffer(rawGoal * input.conversionFactor);
  const hasGoals = input.setupComplete && activeGoal > 0;

  // Season boundaries
  const seasonEndStr = input.isPreseason ? PRESEASON_END : (input.personalSummerEnd || SUMMER_END);
  const seasonStartStr = input.isPreseason ? '2025-09-28' : (input.personalSummerStart || '2026-04-12');

  // Knocking day check
  const isKnockingDay = (e: GoalPaceInput['entries'][0]) =>
    (e.doors_knocked || 0) >= 4 && !!e.work_start_time && !!e.work_end_time;

  // Season knocking days completed (finalized entries within season)
  const seasonKnockingDaysComplete = input.entries.filter(e =>
    e.is_finalized && e.entry_date >= seasonStartStr && e.entry_date <= seasonEndStr && isKnockingDay(e)
  ).length;

  // Future planned days within season
  const futurePlannedDays = input.allPlannedDays.filter(d =>
    d > todayStr && d <= seasonEndStr && d >= seasonStartStr
  ).length;

  // Include today if planned and not yet finalized
  const todayPlanned = input.allPlannedDays.includes(todayStr) && todayStr >= seasonStartStr && todayStr <= seasonEndStr;
  const todayFinalized = input.entries.some(e => e.entry_date === todayStr && e.is_finalized);
  const includeTodayInRemaining = todayPlanned && !todayFinalized;

  const totalSeasonDays = seasonKnockingDaysComplete + futurePlannedDays + (includeTodayInRemaining ? 1 : 0);
  const remainingDays = Math.max(0, totalSeasonDays - seasonKnockingDaysComplete);

  // Catch-up daily pace
  // IMPORTANT: Exclude today's live (unfinalized) production so the daily target
  // stays FIXED throughout the day. This prevents the goal from shrinking as the
  // rep logs more sales — the target is locked based on start-of-day progress.
  const progressExcludingToday = Math.max(0, input.currentProgress - input.todayFP - input.todayLiveFP);
  const remaining = Math.max(0, activeGoal - progressExcludingToday);
  const dailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;
  const weeklyNeeded = dailyNeeded * 6;

  // User daily average — raw is actual current-season avg (for display)
  const historicalAvg = input.historicalSummerAvg || 0;
  const rawAvg = input.knockingDaysCompleted > 0
    ? input.currentProgress / input.knockingDaysCompleted
    : 0;
  // For severity thresholds, use historical avg during preseason if available
  const severityAvg = (input.isPreseason && historicalAvg > 0) ? historicalAvg : rawAvg;
  // For display, always use the actual current-season average
  const userDailyAvg = rawAvg;

  // Severity: personalized thresholds
  let severity: PaceSeverity;
  if (!hasGoals || dailyNeeded <= 0) {
    severity = 'green';
  } else if (severityAvg <= 0) {
    // No data - use conservative fallback
    severity = dailyNeeded <= 2 ? 'green' : dailyNeeded <= 4 ? 'amber' : 'red';
  } else if (dailyNeeded <= severityAvg) {
    severity = 'green';
  } else if (dailyNeeded <= severityAvg * 1.5) {
    severity = 'amber';
  } else {
    severity = 'red';
  }

  // Overall progress percent
  const overallProgressPercent = activeGoal > 0 ? Math.min(100, (input.currentProgress / activeGoal) * 100) : 0;

  // ========================================
  // Timeframe calculations
  // ========================================

  const getSaleValue = (sale: any): number => {
    const salePrmr = Number(sale?.prmr) || 0;
    if (input.efpModeEnabled) return salePrmr / 85;
    if (sale?.type === 'fp') return 1;
    if (sale?.type === 'upgrade') return salePrmr / 85;
    return 0;
  };

  const getSaleBucket = (sale: any): 'ignore' | 'pending' | 'unfunded' | 'funded' => {
    const status = (typeof sale?.install_status === 'string' ? sale.install_status.toLowerCase().trim() : '');
    if (status === 'never_installed') return 'ignore';
    if (status === 'pending') return 'pending';
    if (status === 'cancelled' || status === 'canceled') return 'unfunded';
    return 'funded';
  };

  const calcTimeframe = (
    periodStart: string,
    periodEnd: string,
    label: string,
  ): TimeframeData => {
    // Planned days in this period
    const periodPlannedDays = input.allPlannedDays.filter(d =>
      d >= periodStart && d <= periodEnd && d >= seasonStartStr && d <= seasonEndStr
    );
    const plannedDaysTotal = periodPlannedDays.length;

    // Elapsed planned days: past planned days + today if the user has started working
    // (i.e. has a meaningful entry for today - not just an empty auto-created one).
    // This ensures "X of Y work days" reflects reality without waiting for finalization.
    const todayHasActivity = input.entries.some(e => 
      e.entry_date === todayStr && (
        (e.doors_knocked || 0) > 0 || 
        (e.fp_plus || 0) > 0 || 
        !!e.work_start_time
      )
    );
    const plannedDaysElapsed = periodPlannedDays.filter(d =>
      d < todayStr || (d === todayStr && (todayFinalized || todayHasActivity))
    ).length;

    // Bucketed production in this period (sales_log is source of truth)
    let actual = 0;
    let funded = 0;
    let live = 0;
    let pending = 0;

    for (const entry of input.entries) {
      if (entry.entry_date < periodStart || entry.entry_date > periodEnd) continue;

      const salesLog = entry.sales_log;
      if (Array.isArray(salesLog) && salesLog.length > 0) {
        for (const sale of salesLog) {
          const saleValue = getSaleValue(sale);
          if (saleValue <= 0) continue;

          const bucket = getSaleBucket(sale);
          if (bucket === 'ignore') continue;
          if (bucket === 'pending') {
            pending += saleValue;
            continue;
          }

          // funded + unfunded both count toward non-pending progress
          if (entry.is_finalized || bucket === 'unfunded') {
            actual += saleValue;
          } else {
            // unfinalized + funded stays as live
            live += saleValue;
          }

          if (bucket === 'funded' && entry.is_finalized) {
            funded += saleValue;
          }
        }
      } else if (entry.is_finalized) {
        // Fallback for legacy finalized entries without sales_log
        const fallbackValue = input.efpModeEnabled ? (entry.prmr || 0) / 85 : (entry.fp_plus || 0);
        actual += fallbackValue;
        funded += fallbackValue;
      }
    }

    // Goal for this period = dailyNeeded × planned days in period
    const goal = dailyNeeded * plannedDaysTotal;

    // Expected at this point = linear distribution × elapsed planned days
    // Uses linear rate (goal/totalDays) instead of catch-up rate to avoid circular math
    const linearRate = totalSeasonDays > 0 ? activeGoal / totalSeasonDays : 0;
    const expected = linearRate * plannedDaysElapsed;

    const totalProgress = actual + live;
    const paceDiff = totalProgress - expected;

    return {
      actual,
      funded,
      live,
      pending,
      expected,
      goal,
      remaining: Math.max(0, goal - totalProgress),
      plannedDaysElapsed,
      plannedDaysTotal,
      paceDiff,
      isAhead: paceDiff >= 0,
      label,
    };
  };

  // Day - derive explicit buckets from sales_log when available
  const todayEntryData = input.entries.find(e => e.entry_date === todayStr);
  let todayActual = input.todayFP;
  let todayFunded = todayEntryData?.is_finalized ? input.todayFP : 0;
  let todayLive = input.todayLiveFP;
  let todayPending = 0;

  if (todayEntryData && Array.isArray(todayEntryData.sales_log) && todayEntryData.sales_log.length > 0) {
    todayActual = 0;
    todayFunded = 0;
    todayLive = 0;
    todayPending = 0;

    for (const sale of todayEntryData.sales_log) {
      const saleValue = getSaleValue(sale);
      if (saleValue <= 0) continue;

      const bucket = getSaleBucket(sale);
      if (bucket === 'ignore') continue;
      if (bucket === 'pending') {
        todayPending += saleValue;
        continue;
      }

      if (todayEntryData.is_finalized || bucket === 'unfunded') {
        todayActual += saleValue;
      } else {
        todayLive += saleValue;
      }

      if (bucket === 'funded' && todayEntryData.is_finalized) {
        todayFunded += saleValue;
      }
    }
  }

  const day: TimeframeData = {
    actual: todayActual,
    funded: todayFunded,
    live: todayLive,
    pending: todayPending,
    expected: dailyNeeded,
    goal: dailyNeeded,
    remaining: Math.max(0, dailyNeeded - todayActual - todayLive),
    plannedDaysElapsed: todayPlanned ? 1 : 0,
    plannedDaysTotal: todayPlanned ? 1 : 0,
    paceDiff: (todayActual + todayLive) - dailyNeeded,
    isAhead: (todayActual + todayLive) >= dailyNeeded,
    label: 'Today',
  };

  // Week
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const week = calcTimeframe(
    format(weekStart, 'yyyy-MM-dd'),
    format(weekEnd, 'yyyy-MM-dd'),
    'This Week'
  );

  // Month
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const month = calcTimeframe(
    format(monthStart, 'yyyy-MM-dd'),
    format(monthEnd, 'yyyy-MM-dd'),
    format(today, 'MMMM')
  );

  // Season
  const season = calcTimeframe(seasonStartStr, seasonEndStr, input.isPreseason ? 'Preseason' : 'Season');
  season.goal = activeGoal;
  const seasonProgress = season.actual + season.live;
  // Use linear distribution for expected: (goal / totalDays) × elapsedDays
  // This avoids the circular math of projecting the catch-up rate backward
  const linearDailyRate = totalSeasonDays > 0 ? activeGoal / totalSeasonDays : 0;
  season.expected = linearDailyRate * seasonKnockingDaysComplete;
  season.paceDiff = seasonProgress - season.expected;
  season.isAhead = season.paceDiff >= 0;
  season.remaining = Math.max(0, activeGoal - seasonProgress);
  season.plannedDaysElapsed = seasonKnockingDaysComplete;
  season.plannedDaysTotal = totalSeasonDays;

  // Compute per-season daily paces for calendar display
  // These are independent of whether user is currently in preseason or summer
  const preseasonGoalBuffered = applyBuffer(input.preseasonGoal * input.conversionFactor);
  const summerFocusGoalRaw = (() => {
    switch (input.focusTier) {
      case 'mustDo': return input.mustDoGoal;
      case 'couldDo': return input.couldDoGoal;
      default: return input.willDoGoal;
    }
  })();
  const summerGoalBuffered = applyBuffer(summerFocusGoalRaw * input.conversionFactor);

  const preseasonStartStr = '2025-09-28';
  const preseasonEndStr = PRESEASON_END;
  const summerStartStr = input.personalSummerStart || '2026-04-12';
  const summerEndStr = input.personalSummerEnd || SUMMER_END;

  // Preseason planned days & knocking days
  const preseasonPlannedTotal = input.allPlannedDays.filter(d => d >= preseasonStartStr && d <= preseasonEndStr).length;
  const preseasonKnockingDone = input.entries.filter(e =>
    e.is_finalized && e.entry_date >= preseasonStartStr && e.entry_date <= preseasonEndStr && isKnockingDay(e)
  ).length;
  const preseasonFuturePlanned = input.allPlannedDays.filter(d => d > todayStr && d >= preseasonStartStr && d <= preseasonEndStr).length;
  const preseasonTodayInRange = todayStr >= preseasonStartStr && todayStr <= preseasonEndStr;
  const preseasonRemainingDays = Math.max(0, preseasonKnockingDone + preseasonFuturePlanned + (preseasonTodayInRange && includeTodayInRemaining ? 1 : 0) - preseasonKnockingDone);
  
  // Preseason progress — use reconciled currentProgress when in preseason for consistency with dailyNeeded
  let preseasonProgress = 0;
  if (input.isPreseason) {
    preseasonProgress = input.currentProgress;
  } else {
    for (const entry of input.entries) {
      if (entry.entry_date < preseasonStartStr || entry.entry_date > preseasonEndStr) continue;
      if (!entry.is_finalized) continue;
      preseasonProgress += input.efpModeEnabled ? (entry.prmr || 0) / 85 : (entry.fp_plus || 0);
    }
  }
  const preseasonDailyPace = preseasonRemainingDays > 0 
    ? Math.max(0, preseasonGoalBuffered - preseasonProgress) / preseasonRemainingDays 
    : 0;

  // Summer planned days & knocking days
  const summerFuturePlanned = input.allPlannedDays.filter(d => d > todayStr && d >= summerStartStr && d <= summerEndStr).length;
  const summerKnockingDone = input.entries.filter(e =>
    e.is_finalized && e.entry_date >= summerStartStr && e.entry_date <= summerEndStr && isKnockingDay(e)
  ).length;
  const summerTodayInRange = todayStr >= summerStartStr && todayStr <= summerEndStr;
  const summerRemainingDays = Math.max(0, summerKnockingDone + summerFuturePlanned + (summerTodayInRange && includeTodayInRemaining ? 1 : 0) - summerKnockingDone);
  
  // Summer progress — use reconciled currentProgress when in summer for consistency with dailyNeeded
  let summerProgress = 0;
  if (!input.isPreseason) {
    summerProgress = input.currentProgress;
  } else {
    for (const entry of input.entries) {
      if (entry.entry_date < summerStartStr || entry.entry_date > summerEndStr) continue;
      if (!entry.is_finalized) continue;
      summerProgress += input.efpModeEnabled ? (entry.prmr || 0) / 85 : (entry.fp_plus || 0);
    }
  }
  // Forecast preseason total and subtract from summer goal (matching What If drawer logic)
  const forecastedPreseason = preseasonProgress + (preseasonDailyPace * preseasonRemainingDays);
  const netPreseason = forecastedPreseason * (1 - input.cancelRate);
  const remainingToFund = Math.max(0, summerGoalBuffered - netPreseason - summerProgress);
  const summerSellNeeded = input.cancelRate < 1 ? remainingToFund / (1 - input.cancelRate) : remainingToFund;
  const summerDailyPace = summerRemainingDays > 0
    ? Math.max(0, summerSellNeeded) / summerRemainingDays
    : 0;

  const unbufferedGoal = rawGoal * input.conversionFactor;

  return {
    activeGoal,
    unbufferedGoal,
    tierLabel,
    focusTier: input.isPreseason ? 'preseason' as any : input.focusTier,
    isPreseason: input.isPreseason,
    metricLabel: input.metricLabel,
    dailyNeeded,
    weeklyNeeded,
    preseasonDailyPace,
    summerDailyPace,
    severity,
    userDailyAvg,
    currentProgress: input.currentProgress,
    overallProgressPercent,
    day,
    week,
    month,
    season,
    hasGoals,
    knockingDaysCompleted: input.knockingDaysCompleted,
  };
}
// =====================================================
// HOOK: For current user's own goal pace
// =====================================================

export function useGoalPaceCalculator(): GoalPaceData {
  const { goals, isLoading: goalsLoading } = useRepGoals();
  const { totalFP, totalEFP, knockingDays, isLoading: fpLoading } = usePreseasonFP();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { plannedDays, isLoading: plannedLoading } = usePlannedDays();
  const { repData } = useRepData();
  const { userId } = useCurrentUserId();

  const rawProgress = efpModeEnabled ? totalEFP : totalFP;
  const { focusTier, setFocusTier, allTiers, isUserSummerStarted, isLoading: tierLoading } = useFocusTier(rawProgress);

  // Season config
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-unified', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });

  // Today's entries (for live FP)
  const today = getLocalToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  const { data: todayEntry } = useQuery({
    queryKey: ['today-entry-unified', userId, todayStr],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('daily_entries')
        .select('fp_plus, prmr, is_finalized, sales_log, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', userId)
        .eq('entry_date', todayStr)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  // All entries for period calculations
  const { data: allEntries } = useQuery({
    queryKey: ['all-entries-unified', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, prmr, is_finalized, doors_knocked, work_start_time, work_end_time, sales_log')
        .eq('user_id', userId)
        .gte('entry_date', '2025-09-28');
      return data || [];
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30s — invalidated on CRM updates via invalidateAllSalesQueries
    gcTime: 5 * 60 * 1000,
  });

  // Historical 2025 summer daily average for preseason severity calibration
  const { data: historicalSummerAvg = 0 } = useQuery({
    queryKey: ['historical-summer-avg-pace', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data } = await supabase
        .from('historical_entries')
        .select('prmr, fp_plus, doors_knocked')
        .eq('user_id', userId)
        .eq('season_type', 'summer')
        .eq('season_year', 2025);
      if (!data || data.length === 0) return 0;
      const knockingEntries = data.filter(e => (e.doors_knocked || 0) >= 4);
      if (knockingEntries.length === 0) return 0;
      const totalMetric = knockingEntries.reduce((sum, e) => {
        return sum + (efpModeEnabled ? (Number(e.prmr) || 0) / 85 : (Number(e.fp_plus) || 0));
      }, 0);
      return totalMetric / knockingEntries.length;
    },
    enabled: !!userId && !isUserSummerStarted,
    staleTime: 30 * 60 * 1000,
  });

  const personalSummerStart = seasonConfig?.personal_summer_start || null;
  const isPreseason = !isUserSummerStarted;
  // Goals are stored in the user's chosen display unit (EFP when efpModeEnabled, FP+ otherwise)
  // so no conversion is needed — conversionFactor is always 1.
  const conversionFactor = 1;

  // Official totals from Vivint sync — reconciles app-tracked data with reality
  const seasonType = isPreseason ? 'preseason' : 'summer';
  const seasonStartStr = isPreseason ? '2025-09-28' : (personalSummerStart || '2026-04-12');
  const { data: officialTotalsData } = useQuery({
    queryKey: ['official-totals-pace', userId, seasonType],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('official_totals')
        .select('fp_plus, prmr, knocking_days, last_verified_at')
        .eq('user_id', userId)
        .eq('season_year', 2025)
        .eq('season_type', seasonType)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Calculate today's FP (finalized vs live)
  const { todayFP, todayLiveFP } = useMemo(() => {
    if (!todayEntry) return { todayFP: 0, todayLiveFP: 0 };
    
    if (todayEntry.is_finalized) {
      const fp = efpModeEnabled ? (todayEntry.prmr || 0) / 85 : (todayEntry.fp_plus || 0);
      return { todayFP: fp, todayLiveFP: 0 };
    }
    
    // Unfinalized - calculate from sales_log
    let liveFP = 0;
    const salesLog = todayEntry.sales_log as any[] | null;
    if (Array.isArray(salesLog)) {
      for (const sale of salesLog) {
    if (sale.install_status === 'never_installed') continue;
        if (sale.install_status === 'pending') continue;
        if (efpModeEnabled) {
          liveFP += (Number(sale.prmr) || 0) / 85;
        } else {
          if (sale.type === 'fp') liveFP += 1;
          else if (sale.type === 'upgrade') liveFP += (Number(sale.prmr) || 0) / 85;
        }
      }
    }
    
    return { todayFP: 0, todayLiveFP: liveFP };
  }, [todayEntry, efpModeEnabled]);

  // Reconcile current progress: if official_totals exist (Vivint sync),
  // use officialFP + tracked since verification. Otherwise use raw tracked total.
  const currentProgress = useMemo(() => {
    if (!officialTotalsData?.last_verified_at) return rawProgress;

    const officialFp = officialTotalsData.fp_plus || 0;
    const lastVerifiedDate = new Date(officialTotalsData.last_verified_at).toISOString().split('T')[0];

    // Sum FP from entries tracked AFTER the verification date
    let trackedSince = 0;
    for (const entry of allEntries || []) {
      if (entry.entry_date <= lastVerifiedDate) continue;
      if (entry.entry_date < seasonStartStr) continue;
      const salesLog = entry.sales_log as any[] | null;
      if (Array.isArray(salesLog) && salesLog.length > 0) {
        for (const sale of salesLog) {
          if (sale.install_status === 'never_installed' || sale.install_status === 'pending') continue;
          if (efpModeEnabled) {
            trackedSince += (Number(sale.prmr) || 0) / 85;
          } else {
            if (sale.type === 'fp') trackedSince += 1;
            else if (sale.type === 'upgrade') trackedSince += (Number(sale.prmr) || 0) / 85;
          }
        }
      } else if (entry.is_finalized) {
        trackedSince += efpModeEnabled ? (Number(entry.prmr) || 0) / 85 : (Number(entry.fp_plus) || 0);
      }
    }

    // Never allow stale official totals to reduce known tracked progress.
    const reconciledProgress = officialFp + trackedSince;
    return Math.max(rawProgress, reconciledProgress);
  }, [officialTotalsData, rawProgress, allEntries, efpModeEnabled, seasonStartStr]);

  const isLoading = goalsLoading || fpLoading || plannedLoading || tierLoading;

  const paceData = useMemo(() => {
    if (!goals?.setup_complete) {
      return null;
    }

    return calculateGoalPace({
      preseasonGoal: goals.preseason_fp_goal || 0,
      mustDoGoal: goals.must_do_fp_goal || 0,
      willDoGoal: goals.will_do_fp_goal || 0,
      couldDoGoal: goals.could_do_fp_goal || 0,
      cancelRate: goals.cancel_rate || 0,
      focusTier,
      isPreseason,
      setupComplete: true,
      currentProgress,
      todayFP,
      todayLiveFP,
      allPlannedDays: (plannedDays || []).map(d => d.planned_date),
      entries: (allEntries || []).map(e => ({
        entry_date: e.entry_date,
        fp_plus: Number(e.fp_plus) || 0,
        prmr: Number(e.prmr) || 0,
        is_finalized: e.is_finalized || false,
        doors_knocked: e.doors_knocked || 0,
        work_start_time: e.work_start_time,
        work_end_time: e.work_end_time,
        sales_log: e.sales_log as any[],
      })),
      personalSummerStart,
      personalSummerEnd: seasonConfig?.personal_summer_end || null,
      efpModeEnabled,
      conversionFactor,
      metricLabel: efpModeEnabled ? 'EFP' : 'FP+',
      knockingDaysCompleted: knockingDays,
      historicalSummerAvg,
    });
  }, [goals, focusTier, isPreseason, currentProgress, todayFP, todayLiveFP, plannedDays, allEntries, personalSummerStart, seasonConfig, efpModeEnabled, conversionFactor, knockingDays, historicalSummerAvg, officialTotalsData]);

  const tierOptions = useMemo(() => [
    { key: 'mustDo', label: 'Must Do', goal: allTiers.mustDo.goal, funded: allTiers.mustDo.funded, complete: allTiers.mustDo.complete },
    { key: 'willDo', label: 'Will Do', goal: allTiers.willDo.goal, funded: allTiers.willDo.funded, complete: allTiers.willDo.complete },
    { key: 'couldDo', label: 'Could Do', goal: allTiers.couldDo.goal, funded: allTiers.couldDo.funded, complete: allTiers.couldDo.complete },
  ], [allTiers]);

  // Default empty data
  const emptyTimeframe: TimeframeData = {
    actual: 0, funded: 0, live: 0, pending: 0, expected: 0, goal: 0, remaining: 0,
    plannedDaysElapsed: 0, plannedDaysTotal: 0, paceDiff: 0, isAhead: true, label: '',
  };

  if (!paceData) {
    return {
      activeGoal: 0,
      unbufferedGoal: 0,
      tierLabel: isPreseason ? 'Preseason' : 'Will Do',
      focusTier: isPreseason ? 'preseason' as any : focusTier,
      isPreseason,
      metricLabel: efpModeEnabled ? 'EFP' : 'FP+',
      dailyNeeded: 0,
      weeklyNeeded: 0,
      preseasonDailyPace: 0,
      summerDailyPace: 0,
      severity: 'green',
      userDailyAvg: 0,
      currentProgress: 0,
      overallProgressPercent: 0,
      day: { ...emptyTimeframe, label: 'Today' },
      week: { ...emptyTimeframe, label: 'This Week' },
      month: { ...emptyTimeframe, label: format(today, 'MMMM') },
      season: { ...emptyTimeframe, label: isPreseason ? 'Preseason' : 'Season' },
      allTiers: tierOptions,
      onTierChange: setFocusTier,
      isLoading,
      hasGoals: false,
      knockingDaysCompleted: knockingDays,
    };
  }

  return {
    ...paceData,
    allTiers: tierOptions,
    onTierChange: setFocusTier,
    isLoading,
  };
}
