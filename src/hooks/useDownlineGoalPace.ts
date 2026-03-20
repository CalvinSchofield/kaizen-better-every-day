import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calculateSalesPace } from '@/utils/salesPaceCalculator';
import { isAfter, startOfDay, format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';

const SEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';

export type PaceStatus = 'ahead' | 'on-track' | 'behind' | 'at-risk' | 'goal-met' | 'no-goals';

export interface DownlineGoalPace {
  goal: number;
  goalLabel: string;
  ytdFP: number;
  progressPercent: number;
  paceStatus: PaceStatus;
  neededDaily: number;
  currentAvgDaily: number;
  daysWorked: number;
  daysRemaining: number;
  focusTier: string;
  isPreseason: boolean;
}

export const useDownlineGoalPace = (userId: string | null) => {
  return useQuery({
    queryKey: ['downline-goal-pace', userId],
    queryFn: async (): Promise<DownlineGoalPace | null> => {
      if (!userId) return null;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      // Fetch goals, season config, daily entries, and planned days in parallel
      const [goalsResult, seasonResult, entriesResult, plannedDaysResult] = await Promise.all([
        supabase
          .from('rep_goals')
          .select('preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, cancel_rate, setup_complete, focus_tier')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('season_config')
          .select('personal_summer_start, personal_summer_end')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('daily_entries')
          .select('entry_date, fp_plus, doors_knocked, sales_log')
          .eq('user_id', userId)
          .gte('entry_date', SEASON_START)
          .eq('is_finalized', true),
        supabase.functions.invoke('fetch-downline-planned-days', {
          body: { userIds: [userId] },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      const goals = goalsResult.data;
      if (!goals?.setup_complete) return null;

      const entries = entriesResult.data || [];
      const summerStart = seasonResult.data?.personal_summer_start || null;

      // Calculate YTD FP from entries
      let ytdFP = 0;
      let knockingDays = 0;
      for (const entry of entries) {
        const salesLog = entry.sales_log as any[] | null;
        if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
          // Use sales log for FP calculation
          const { calculateFromSalesLog } = await import('@/utils/salesLogCalculations');
          const calc = calculateFromSalesLog(salesLog);
          ytdFP += calc.fp;
        } else {
          ytdFP += entry.fp_plus || 0;
        }
        if ((entry.doors_knocked || 0) >= 4) {
          knockingDays++;
        }
      }

      // Parse planned days from edge function response
      // The edge function returns { plannedDays: [{ planned_date, user_id }, ...] }
      const plannedDaysData = plannedDaysResult.data;
      const userPlannedDays: Array<{ planned_date: string }> = [];
      if (plannedDaysData && typeof plannedDaysData === 'object') {
        // Handle { plannedDays: [...] } format
        const rawArray = plannedDaysData.plannedDays;
        if (Array.isArray(rawArray)) {
          for (const item of rawArray) {
            if (item.user_id === userId && item.planned_date) {
              userPlannedDays.push({ planned_date: item.planned_date });
            }
          }
        }
        // Fallback: handle { [userId]: string[] } format
        if (userPlannedDays.length === 0) {
          const raw = plannedDaysData[userId] as string[] | undefined;
          if (Array.isArray(raw)) {
            raw.forEach((d: string) => userPlannedDays.push({ planned_date: d }));
          }
        }
      }

      // Determine preseason vs summer
      const today = startOfDay(new Date());
      const preseasonEndDate = parseLocalDate(PRESEASON_END);
      const isGlobalPreseason = !isAfter(today, preseasonEndDate);
      const hasPersonalSummerStarted = summerStart
        ? !isAfter(parseLocalDate(summerStart), today)
        : false;
      const isPreseason = isGlobalPreseason && !hasPersonalSummerStarted;

      // Determine goal and label
      let goal = 0;
      let goalLabel = 'Preseason';
      const focusTier = goals.focus_tier || 'will_do';

      if (isPreseason) {
        goal = goals.preseason_fp_goal || 0;
        goalLabel = 'Preseason';
      } else {
        if (focusTier === 'must_do' || focusTier === 'mustDo') {
          goal = goals.must_do_fp_goal || 0;
          goalLabel = 'Must Do';
        } else if (focusTier === 'could_do' || focusTier === 'couldDo') {
          goal = goals.could_do_fp_goal || 0;
          goalLabel = 'Could Do';
        } else {
          goal = goals.will_do_fp_goal || 0;
          goalLabel = 'Will Do';
        }
      }

      if (!goal || goal <= 0) {
        return {
          goal: 0, goalLabel, ytdFP, progressPercent: 0,
          paceStatus: 'no-goals' as PaceStatus,
          neededDaily: 0, currentAvgDaily: 0, daysWorked: knockingDays,
          daysRemaining: 0, focusTier, isPreseason,
        };
      }

      const progressPercent = Math.min((ytdFP / goal) * 100, 100);
      const currentAvgDaily = knockingDays > 0 ? ytdFP / knockingDays : 0;

      // Calculate pace
      const paceResult = calculateSalesPace({
        goals: {
          preseason_fp_goal: goals.preseason_fp_goal,
          must_do_fp_goal: goals.must_do_fp_goal,
          will_do_fp_goal: goals.will_do_fp_goal,
          could_do_fp_goal: goals.could_do_fp_goal,
          cancel_rate: goals.cancel_rate,
          setup_complete: true,
        },
        plannedDays: userPlannedDays,
        knockingDays,
        currentFpPlus: ytdFP,
        currentPrmr: 0,
        efpModeEnabled: false,
        calculateEfp: (prmr) => prmr / 85,
        activeTier: isPreseason ? 'preseason' : (
          focusTier === 'mustDo' || focusTier === 'must_do' ? 'mustDo' :
          focusTier === 'couldDo' || focusTier === 'could_do' ? 'couldDo' : 'willDo'
        ),
        personalSummerStart: summerStart,
      });

      let paceStatus: PaceStatus = 'on-track';
      let neededDaily = 0;
      let daysRemaining = 0;

      if (ytdFP >= goal) {
        paceStatus = 'goal-met';
      } else if (paceResult) {
        daysRemaining = paceResult.futurePlannedDays;
        neededDaily = paceResult.remainingDailyNeeded;
        const variance = paceResult.paceVariance;
        const expected = paceResult.expectedAtThisPoint;

        if (variance >= 0) {
          paceStatus = variance > 1 ? 'ahead' : 'on-track';
        } else {
          const behindPct = expected > 0 ? (Math.abs(variance) / expected) * 100 : 100;
          paceStatus = behindPct > 35 ? 'at-risk' : 'behind';
        }
      }

      return {
        goal, goalLabel, ytdFP, progressPercent, paceStatus,
        neededDaily, currentAvgDaily, daysWorked: knockingDays,
        daysRemaining, focusTier, isPreseason,
      };
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });
};
