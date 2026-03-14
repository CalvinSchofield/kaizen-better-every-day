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
  tierLabel: string;
  focusTier: FocusTier | 'preseason';
  isPreseason: boolean;
  metricLabel: string;

  // Catch-up pace
  dailyNeeded: number;
  weeklyNeeded: number;

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
  const remaining = Math.max(0, activeGoal - input.currentProgress);
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

    // Elapsed planned days (planned days that are on or before today)
    const plannedDaysElapsed = periodPlannedDays.filter(d => d <= todayStr).length;

    // Actual production in this period (from entries)
    let actual = 0;
    let live = 0;
    let pending = 0;
    for (const entry of input.entries) {
      if (entry.entry_date < periodStart || entry.entry_date > periodEnd) continue;
      
      if (entry.is_finalized) {
        // Start with column values
        let entryActual = input.efpModeEnabled ? (entry.prmr || 0) / 85 : (entry.fp_plus || 0);
        
        // Scan finalized entries' sales_log for pending sales — these need to be
        // subtracted from actual (columns include them) and tracked separately
        const salesLog = entry.sales_log;
        if (Array.isArray(salesLog)) {
          for (const sale of salesLog) {
            if (sale.install_status === 'pending') {
              const salePrmr = Number(sale.prmr) || 0;
              if (input.efpModeEnabled) {
                const pendingVal = salePrmr / 85;
                pending += pendingVal;
                entryActual -= pendingVal;
              } else {
                if (sale.type === 'fp') {
                  pending += 1;
                  entryActual -= 1;
                } else if (sale.type === 'upgrade') {
                  const pendingVal = salePrmr / 85;
                  pending += pendingVal;
                  entryActual -= pendingVal;
                }
              }
            }
          }
        }
        actual += Math.max(0, entryActual);
      } else {
        // Unfinalized - calculate from sales_log
        const salesLog = entry.sales_log;
        if (Array.isArray(salesLog)) {
          for (const sale of salesLog) {
            if (sale.install_status === 'never_installed') continue;
            if (sale.install_status === 'pending') {
              // Track pending separately
              const salePrmr = Number(sale.prmr) || 0;
              if (input.efpModeEnabled) {
                pending += salePrmr / 85;
              } else {
                if (sale.type === 'fp') pending += 1;
                else if (sale.type === 'upgrade') pending += salePrmr / 85;
              }
              continue;
            }
            const salePrmr = Number(sale.prmr) || 0;
            if (input.efpModeEnabled) {
              live += salePrmr / 85;
            } else {
              if (sale.type === 'fp') live += 1;
              else if (sale.type === 'upgrade') live += salePrmr / 85;
            }
          }
        }
      }
    }

    // Goal for this period = dailyNeeded × planned days in period
    const goal = dailyNeeded * plannedDaysTotal;

    // Expected at this point = dailyNeeded × elapsed planned days
    const expected = dailyNeeded * plannedDaysElapsed;

    const totalProgress = actual + live;
    const paceDiff = totalProgress - expected;

    return {
      actual,
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

  // Day - calculate today's pending from sales_log (finalized or unfinalized)
  let todayPending = 0;
  const todayEntryData = input.entries.find(e => e.entry_date === todayStr);
  if (todayEntryData && Array.isArray(todayEntryData.sales_log)) {
    for (const sale of todayEntryData.sales_log) {
      if (sale.install_status === 'pending') {
        const salePrmr = Number(sale.prmr) || 0;
        if (input.efpModeEnabled) {
          todayPending += salePrmr / 85;
        } else {
          if (sale.type === 'fp') todayPending += 1;
          else if (sale.type === 'upgrade') todayPending += salePrmr / 85;
        }
      }
    }
  }

  const day: TimeframeData = {
    actual: input.todayFP,
    live: input.todayLiveFP,
    pending: todayPending,
    expected: dailyNeeded,
    goal: dailyNeeded,
    remaining: Math.max(0, dailyNeeded - input.todayFP - input.todayLiveFP),
    plannedDaysElapsed: todayPlanned ? 1 : 0,
    plannedDaysTotal: todayPlanned ? 1 : 0,
    paceDiff: (input.todayFP + input.todayLiveFP) - dailyNeeded,
    isAhead: (input.todayFP + input.todayLiveFP) >= dailyNeeded,
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
  // Override season with authoritative values
  // currentProgress now includes ALL entries (finalized + unfinalized with sales_log)
  // todayLiveFP is already included in currentProgress, so don't add it again
  season.goal = activeGoal;
  season.actual = input.currentProgress;
  season.live = 0; // Already included in currentProgress
  season.expected = dailyNeeded * seasonKnockingDaysComplete;
  season.paceDiff = input.currentProgress - season.expected;
  season.isAhead = season.paceDiff >= 0;
  season.remaining = Math.max(0, activeGoal - input.currentProgress);
  season.plannedDaysElapsed = seasonKnockingDaysComplete;
  season.plannedDaysTotal = totalSeasonDays;

  return {
    activeGoal,
    tierLabel,
    focusTier: input.isPreseason ? 'preseason' as any : input.focusTier,
    isPreseason: input.isPreseason,
    metricLabel: input.metricLabel,
    dailyNeeded,
    weeklyNeeded,
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

  const currentProgress = efpModeEnabled ? totalEFP : totalFP;
  const { focusTier, setFocusTier, allTiers, isUserSummerStarted, isLoading: tierLoading } = useFocusTier(currentProgress);

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
    staleTime: 2 * 60 * 1000,
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
  const conversionFactor = efpModeEnabled ? (goals?.avg_prmr_per_fp || 85) / 85 : 1;

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
  }, [goals, focusTier, isPreseason, currentProgress, todayFP, todayLiveFP, plannedDays, allEntries, personalSummerStart, seasonConfig, efpModeEnabled, conversionFactor, knockingDays, historicalSummerAvg]);

  const tierOptions = useMemo(() => [
    { key: 'mustDo', label: 'Must Do', goal: allTiers.mustDo.goal, funded: allTiers.mustDo.funded, complete: allTiers.mustDo.complete },
    { key: 'willDo', label: 'Will Do', goal: allTiers.willDo.goal, funded: allTiers.willDo.funded, complete: allTiers.willDo.complete },
    { key: 'couldDo', label: 'Could Do', goal: allTiers.couldDo.goal, funded: allTiers.couldDo.funded, complete: allTiers.couldDo.complete },
  ], [allTiers]);

  // Default empty data
  const emptyTimeframe: TimeframeData = {
    actual: 0, live: 0, pending: 0, expected: 0, goal: 0, remaining: 0,
    plannedDaysElapsed: 0, plannedDaysTotal: 0, paceDiff: 0, isAhead: true, label: '',
  };

  if (!paceData) {
    return {
      activeGoal: 0,
      tierLabel: isPreseason ? 'Preseason' : 'Will Do',
      focusTier: isPreseason ? 'preseason' as any : focusTier,
      isPreseason,
      metricLabel: efpModeEnabled ? 'EFP' : 'FP+',
      dailyNeeded: 0,
      weeklyNeeded: 0,
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
