/**
 * useGoalPaceCalculatorForUser
 * 
 * Fetches another user's goal data and runs the same calculateGoalPace
 * function used by the current user's hook. This ensures Profile and
 * Reports show identical goal progress for any rep in the downline.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfDay, isAfter } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { calculateGoalPace, GoalPaceData, GoalPaceInput } from './useGoalPaceCalculator';
import type { TimeframeData } from './useGoalPaceCalculator';
import type { FocusTier } from './useFocusTier';

const SEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';

const getLocalToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

export function useGoalPaceCalculatorForUser(userId: string | null | undefined): GoalPaceData {
  // Fetch goals
  const { data: goals, isLoading: goalsLoading } = useQuery({
    queryKey: ['downline-goals-unified', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('rep_goals')
        .select('preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, cancel_rate, setup_complete, focus_tier')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch season config
  const { data: seasonConfig } = useQuery({
    queryKey: ['downline-season-config', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all entries for this user (finalized ones accessible via RLS)
  const { data: allEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ['downline-entries-unified', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, prmr, is_finalized, doors_knocked, work_start_time, work_end_time, sales_log')
        .eq('user_id', userId)
        .gte('entry_date', SEASON_START);
      return data || [];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch planned days via edge function (RLS prevents direct access for other users)
  const { data: plannedDays, isLoading: plannedLoading } = useQuery({
    queryKey: ['downline-planned-days-unified', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      
      const { data } = await supabase.functions.invoke('fetch-downline-planned-days', {
        body: { userIds: [userId] },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      
      if (!data) return [];
      
      // Parse response - handles both { plannedDays: [...] } and { [userId]: [...] } formats
      const result: string[] = [];
      if (data.plannedDays && Array.isArray(data.plannedDays)) {
        for (const item of data.plannedDays) {
          if (item.user_id === userId && item.planned_date) {
            result.push(item.planned_date);
          }
        }
      }
      if (result.length === 0 && Array.isArray(data[userId])) {
        return data[userId] as string[];
      }
      return result;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch official totals (Vivint sync data) for this user
  const { data: officialTotalsData } = useQuery({
    queryKey: ['downline-official-totals-pace', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('official_totals')
        .select('fp_plus, prmr, knocking_days, last_verified_at, season_type')
        .eq('user_id', userId)
        .eq('season_year', 2025);
      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  const today = getLocalToday();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Determine preseason vs summer
  const personalSummerStart = seasonConfig?.personal_summer_start || null;
  const isGlobalPreseason = !isAfter(today, parseLocalDate(PRESEASON_END));
  const hasPersonalSummerStarted = personalSummerStart
    ? !isAfter(parseLocalDate(personalSummerStart), today)
    : false;
  const isPreseason = isGlobalPreseason && !hasPersonalSummerStarted;

  // Focus tier from goals
  const focusTierRaw = goals?.focus_tier || 'willDo';
  const focusTier: FocusTier = 
    focusTierRaw === 'mustDo' || focusTierRaw === 'must_do' ? 'mustDo' :
    focusTierRaw === 'couldDo' || focusTierRaw === 'could_do' ? 'couldDo' : 'willDo';

  // Season start for reconciliation
  const seasonType = isPreseason ? 'preseason' : 'summer';
  const seasonStartStr = isPreseason ? SEASON_START : (personalSummerStart || '2026-04-12');

  // Get official totals for the current season type
  const officialForSeason = officialTotalsData?.find(t => t.season_type === seasonType) || null;

  // Calculate current progress and knocking days from entries
  const { currentProgress, knockingDays, todayFP, todayLiveFP } = useMemo(() => {
    if (!allEntries || allEntries.length === 0) return { currentProgress: 0, knockingDays: 0, todayFP: 0, todayLiveFP: 0 };

    let ytdFP = 0;
    let kd = 0;
    let dayFP = 0;
    let dayLiveFP = 0;

    for (const entry of allEntries) {
      const salesLog = entry.sales_log as any[] | null;
      let entryFP = 0;

      if (Array.isArray(salesLog) && salesLog.length > 0) {
        for (const sale of salesLog) {
          if (sale.install_status === 'never_installed') continue;
          if (sale.install_status === 'pending') continue;
          if (sale.type === 'fp') entryFP += 1;
          else if (sale.type === 'upgrade') entryFP += (Number(sale.prmr) || 0) / 85;
        }
      } else {
        entryFP = Number(entry.fp_plus) || 0;
      }

      // Count finalized entries for YTD progress
      if (entry.is_finalized) {
        ytdFP += entryFP;
      }

      // Knocking days
      if (entry.is_finalized && (entry.doors_knocked || 0) >= 4 && entry.work_start_time && entry.work_end_time) {
        kd++;
      }

      // Today's values
      if (entry.entry_date === todayStr) {
        if (entry.is_finalized) {
          dayFP = entryFP;
        } else {
          dayLiveFP = entryFP;
        }
      }
    }

    // Reconcile with official totals (Vivint sync) if available
    let effectiveProgress = ytdFP;
    if (officialForSeason?.last_verified_at) {
      const officialFp = officialForSeason.fp_plus || 0;
      const lastVerifiedDate = new Date(officialForSeason.last_verified_at).toISOString().split('T')[0];
      
      let trackedSince = 0;
      for (const entry of allEntries) {
        if (entry.entry_date <= lastVerifiedDate) continue;
        if (entry.entry_date < seasonStartStr) continue;
        const sl = entry.sales_log as any[] | null;
        if (Array.isArray(sl) && sl.length > 0) {
          for (const sale of sl) {
            if (sale.install_status === 'never_installed' || sale.install_status === 'pending') continue;
            if (sale.type === 'fp') trackedSince += 1;
            else if (sale.type === 'upgrade') trackedSince += (Number(sale.prmr) || 0) / 85;
          }
        } else if (entry.is_finalized) {
          trackedSince += Number(entry.fp_plus) || 0;
        }
      }
      effectiveProgress = officialFp + trackedSince;
    }

    return { currentProgress: effectiveProgress, knockingDays: kd, todayFP: dayFP, todayLiveFP: dayLiveFP };
  }, [allEntries, todayStr, officialForSeason, seasonStartStr]);

  const isLoading = goalsLoading || entriesLoading || plannedLoading;

  // Build tier options
  const mustDoGoal = goals?.must_do_fp_goal || 0;
  const willDoGoal = goals?.will_do_fp_goal || 0;
  const couldDoGoal = goals?.could_do_fp_goal || 0;

  const tierOptions = useMemo(() => [
    { key: 'mustDo', label: 'Must Do', goal: mustDoGoal, funded: currentProgress, complete: currentProgress >= mustDoGoal },
    { key: 'willDo', label: 'Will Do', goal: willDoGoal, funded: currentProgress, complete: currentProgress >= willDoGoal },
    { key: 'couldDo', label: 'Could Do', goal: couldDoGoal, funded: currentProgress, complete: currentProgress >= couldDoGoal },
  ], [mustDoGoal, willDoGoal, couldDoGoal, currentProgress]);

  const paceData = useMemo(() => {
    if (!goals?.setup_complete) return null;

    return calculateGoalPace({
      preseasonGoal: goals.preseason_fp_goal || 0,
      mustDoGoal,
      willDoGoal,
      couldDoGoal,
      cancelRate: goals.cancel_rate || 0,
      focusTier,
      isPreseason,
      setupComplete: true,
      currentProgress,
      todayFP,
      todayLiveFP,
      allPlannedDays: plannedDays || [],
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
      efpModeEnabled: false, // Downline always shows FP+ (not EFP)
      conversionFactor: 1,
      metricLabel: 'FP+',
      knockingDaysCompleted: knockingDays,
    });
  }, [goals, focusTier, isPreseason, currentProgress, todayFP, todayLiveFP, plannedDays, allEntries, personalSummerStart, seasonConfig, knockingDays, mustDoGoal, willDoGoal, couldDoGoal]);

  // Default empty timeframe
  const emptyTimeframe: TimeframeData = {
    actual: 0, funded: 0, live: 0, pending: 0, expected: 0, goal: 0, remaining: 0,
    plannedDaysElapsed: 0, plannedDaysTotal: 0, paceDiff: 0, isAhead: true, label: '',
  };

  if (!paceData) {
    return {
      activeGoal: 0,
      tierLabel: isPreseason ? 'Preseason' : 'Will Do',
      focusTier: isPreseason ? 'preseason' as any : focusTier,
      isPreseason,
      metricLabel: 'FP+',
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
      isLoading,
      hasGoals: false,
      knockingDaysCompleted: knockingDays,
    };
  }

  return {
    ...paceData,
    allTiers: tierOptions,
    isLoading,
  };
}
