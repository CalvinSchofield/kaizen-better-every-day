import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { SeasonHeatmap, DailyEntry } from '@/components/goals/SeasonHeatmap';

interface ExtendedDailyEntry extends DailyEntry {
  doors_knocked?: number | null;
  sales_log?: any;
}
import type { PlannedDay } from '@/hooks/usePlannedDays';
import { Skeleton } from '@/components/ui/skeleton';
import { GoalTier } from '@/config/goalTiers';
import { cn } from '@/lib/utils';
import { format, parseISO, isAfter } from 'date-fns';

const SEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';

interface ProfileSeasonHeatmapProps {
  userId: string;
  isOwnProfile: boolean;
}

export const ProfileSeasonHeatmap = ({ userId, isOwnProfile }: ProfileSeasonHeatmapProps) => {
  // Fetch season entries
  const { data: entries, isLoading: entriesLoading } = useQuery({
    queryKey: ['profile-heatmap-entries', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, prmr, is_finalized, doors_knocked, sales_log')
        .eq('user_id', userId)
        .gte('entry_date', SEASON_START);
      return (data || []) as ExtendedDailyEntry[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch planned days — own profile direct, others via edge function
  const { data: plannedDays, isLoading: plannedLoading } = useQuery({
    queryKey: ['profile-heatmap-planned', userId, isOwnProfile],
    queryFn: async (): Promise<PlannedDay[]> => {
      if (isOwnProfile) {
        const { data } = await supabase
          .from('planned_work_days')
          .select('id, user_id, planned_date, created_at')
          .eq('user_id', userId);
        return (data || []) as PlannedDay[];
      }
      // For other users, use edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data } = await supabase.functions.invoke('fetch-downline-planned-days', {
        body: { userIds: [userId] },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!data) return [];
      const result: PlannedDay[] = [];
      if (data.plannedDays && Array.isArray(data.plannedDays)) {
        for (const item of data.plannedDays) {
          if (item.user_id === userId && item.planned_date) {
            result.push({ id: item.id || '', user_id: item.user_id, planned_date: item.planned_date, created_at: item.created_at || '' });
          }
        }
      }
      if (result.length === 0 && Array.isArray(data[userId])) {
        return (data[userId] as string[]).map((d: string) => ({ id: '', user_id: userId, planned_date: d, created_at: '' }));
      }
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch goals
  const { data: goals } = useQuery({
    queryKey: ['profile-heatmap-goals', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('rep_goals')
        .select('preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier, setup_complete')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch season config
  const { data: seasonConfig } = useQuery({
    queryKey: ['profile-heatmap-season', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end, excluded_summer_days')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Compute pace stats
  const paceStats = useMemo(() => {
    if (!goals?.setup_complete || !entries) return null;

    const today = new Date();
    const personalSummerStart = seasonConfig?.personal_summer_start || '2026-04-12';
    const isPreseason = !isAfter(today, parseISO(PRESEASON_END)) && !isAfter(parseISO(personalSummerStart), today) === false;
    const isUserPreseason = !isAfter(today, parseISO(personalSummerStart));

    const focusTierRaw = goals.focus_tier || 'willDo';
    const focusTier: GoalTier = 
      focusTierRaw === 'mustDo' || focusTierRaw === 'must_do' ? 'mustDo' :
      focusTierRaw === 'couldDo' || focusTierRaw === 'could_do' ? 'couldDo' : 'willDo';

    // Calculate YTD FP+
    let ytdFP = 0;
    let knockingDays = 0;
    for (const entry of entries) {
      if (!entry.is_finalized) continue;
      const fp = entry.fp_plus || 0;
      ytdFP += fp;
      if ((entry.doors_knocked || 0) >= 4) knockingDays++;
    }

    // Current goal
    const activeGoal = isUserPreseason
      ? (goals.preseason_fp_goal || 0)
      : focusTier === 'mustDo' ? (goals.must_do_fp_goal || 0)
      : focusTier === 'couldDo' ? (goals.could_do_fp_goal || 0)
      : (goals.will_do_fp_goal || 0);

    // Remaining FP
    const remaining = Math.max(0, activeGoal - ytdFP);

    // Future planned days
    const todayStr = format(today, 'yyyy-MM-dd');
    const futurePlanned = (plannedDays || []).filter(d => d.planned_date > todayStr).length;

    // Daily needed
    const dailyNeeded = futurePlanned > 0 ? remaining / futurePlanned : 0;

    // User daily average
    const userDailyAvg = knockingDays > 0 ? ytdFP / knockingDays : 0;

    // Preseason and summer daily pace (for heatmap coloring)
    const preseasonGoal = goals.preseason_fp_goal || 0;
    const summerGoal = focusTier === 'mustDo' ? (goals.must_do_fp_goal || 0)
      : focusTier === 'couldDo' ? (goals.could_do_fp_goal || 0)
      : (goals.will_do_fp_goal || 0);

    // Simple pace: total goal / total planned days in that period
    const allPlannedDates = (plannedDays || []).map(d => d.planned_date);
    const preseasonPlanned = allPlannedDates.filter(d => d <= (personalSummerStart || PRESEASON_END)).length;
    const summerPlanned = allPlannedDates.filter(d => d > (personalSummerStart || PRESEASON_END)).length;
    
    const preseasonDailyPace = preseasonPlanned > 0 ? preseasonGoal / preseasonPlanned : 0;
    const summerDailyPace = summerPlanned > 0 ? (summerGoal - preseasonGoal) / summerPlanned : 0;

    return {
      ytdFP,
      remaining,
      dailyNeeded: Math.round(dailyNeeded * 100) / 100,
      userDailyAvg: Math.round(userDailyAvg * 100) / 100,
      futurePlanned,
      activeGoal,
      focusTier,
      isUserPreseason,
      preseasonDailyPace,
      summerDailyPace,
      knockingDays,
    };
  }, [goals, entries, plannedDays, seasonConfig]);

  const isLoading = entriesLoading || plannedLoading;

  if (isLoading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-5 mb-5"
      >
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-[100px] w-full" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
      </motion.div>
    );
  }

  if (!entries || entries.length === 0) return null;

  const activeTier: GoalTier = paceStats?.focusTier || 'preseason';
  const dailyNeeded = paceStats?.dailyNeeded || 0;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3 h-full flex flex-col">
        {/* Heatmap */}
        <SeasonHeatmap
          dailyEntries={entries}
          plannedDays={plannedDays || []}
          excludedSummerDays={(seasonConfig?.excluded_summer_days as string[]) || []}
          personalSummerStart={seasonConfig?.personal_summer_start}
          personalSummerEnd={seasonConfig?.personal_summer_end}
          preseasonDailyPace={paceStats?.preseasonDailyPace || 0}
          summerDailyPace={paceStats?.summerDailyPace || 0}
          efpModeEnabled={false}
          isLoading={false}
          activeTier={activeTier}
          dailyNeeded={dailyNeeded}
          remainingFp={paceStats?.remaining || 0}
          preseasonGoalHit={paceStats ? paceStats.remaining <= 0 : false}
        />

        {/* Pace comparison bar */}
        {paceStats && paceStats.activeGoal > 0 && (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Avg/day</div>
                <div className="text-sm font-bold text-foreground">{paceStats.userDailyAvg.toFixed(2)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground">Need/day</div>
                <div className={cn(
                  "text-sm font-bold",
                  paceStats.userDailyAvg >= paceStats.dailyNeeded ? "text-emerald-500" : "text-amber-500"
                )}>
                  {paceStats.dailyNeeded.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {paceStats.userDailyAvg >= paceStats.dailyNeeded ? (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-500">On Pace</span>
                </>
              ) : paceStats.userDailyAvg >= paceStats.dailyNeeded * 0.8 ? (
                <>
                  <Minus className="h-3.5 w-3.5 text-amber-500" />
                  <span className="text-xs font-semibold text-amber-500">Close</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                  <span className="text-xs font-semibold text-red-500">Behind</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Planned days count */}
        {paceStats && paceStats.futurePlanned > 0 && (
          <div className="text-[10px] text-muted-foreground text-center">
            {paceStats.futurePlanned} planned days remaining · {paceStats.remaining.toFixed(1)} FP+ to go
          </div>
        )}
      </div>
    </motion.div>
  );
};
