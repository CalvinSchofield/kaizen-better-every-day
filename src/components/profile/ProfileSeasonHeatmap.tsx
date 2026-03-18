import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react';
import { SeasonHeatmap, DailyEntry } from '@/components/goals/SeasonHeatmap';

interface ExtendedDailyEntry extends DailyEntry {
  doors_knocked?: number | null;
  sales_log?: any;
}
import type { PlannedDay } from '@/hooks/usePlannedDays';
import { Skeleton } from '@/components/ui/skeleton';
import { GoalTier, GOAL_TIER_CONFIG, SummerTier } from '@/config/goalTiers';
import { cn } from '@/lib/utils';
import { format, parseISO, isAfter } from 'date-fns';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

const SEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';

interface ProfileSeasonHeatmapProps {
  userId: string;
  isOwnProfile: boolean;
}

export const ProfileSeasonHeatmap = ({ userId, isOwnProfile }: ProfileSeasonHeatmapProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTierOverride, setSelectedTierOverride] = useState<GoalTier | null>(null);

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
        .select('preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier, setup_complete, cancel_rate')
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

  // Determine if currently preseason
  const personalSummerStart = seasonConfig?.personal_summer_start || '2026-04-12';
  const isUserPreseason = !isAfter(new Date(), parseISO(personalSummerStart));

  // Resolve focus tier
  const defaultFocusTier = useMemo((): SummerTier => {
    const raw = goals?.focus_tier || 'willDo';
    if (raw === 'mustDo' || raw === 'must_do') return 'mustDo';
    if (raw === 'couldDo' || raw === 'could_do') return 'couldDo';
    return 'willDo';
  }, [goals?.focus_tier]);

  // Active tier considers override
  const activeTier: GoalTier = useMemo(() => {
    if (isUserPreseason) return 'preseason';
    return selectedTierOverride || defaultFocusTier;
  }, [isUserPreseason, selectedTierOverride, defaultFocusTier]);

  // Cancel rate buffer
  const cancelRate = goals?.cancel_rate || 0;
  const applyBuffer = (goal: number) =>
    cancelRate > 0 && cancelRate < 1 ? goal / (1 - cancelRate) : goal;

  // Goal values for each tier (funded)
  const tierGoals = useMemo(() => {
    if (!goals) return { preseason: 0, mustDo: 0, willDo: 0, couldDo: 0 };
    return {
      preseason: goals.preseason_fp_goal || 0,
      mustDo: Math.round(applyBuffer(goals.must_do_fp_goal || 0) * 10) / 10,
      willDo: Math.round(applyBuffer(goals.will_do_fp_goal || 0) * 10) / 10,
      couldDo: Math.round(applyBuffer(goals.could_do_fp_goal || 0) * 10) / 10,
    };
  }, [goals, cancelRate]);

  const activeGoalTotal = tierGoals[activeTier];

  // Compute pace stats
  const paceStats = useMemo(() => {
    if (!goals?.setup_complete || !entries) return null;

    const today = new Date();
    const currentTier = isUserPreseason ? 'preseason' : (selectedTierOverride || defaultFocusTier);

    let ytdFP = 0;
    let knockingDays = 0;
    for (const entry of entries) {
      if (!entry.is_finalized) continue;
      ytdFP += entry.fp_plus || 0;
      if ((entry.doors_knocked || 0) >= 4) knockingDays++;
    }

    const activeGoal = currentTier === 'preseason'
      ? (goals.preseason_fp_goal || 0)
      : currentTier === 'mustDo' ? (goals.must_do_fp_goal || 0)
      : currentTier === 'couldDo' ? (goals.could_do_fp_goal || 0)
      : (goals.will_do_fp_goal || 0);

    const remaining = Math.max(0, activeGoal - ytdFP);
    const todayStr = format(today, 'yyyy-MM-dd');
    const futurePlanned = (plannedDays || []).filter(d => d.planned_date > todayStr).length;
    const dailyNeeded = futurePlanned > 0 ? remaining / futurePlanned : 0;
    const userDailyAvg = knockingDays > 0 ? ytdFP / knockingDays : 0;

    const preseasonGoal = goals.preseason_fp_goal || 0;
    const allPlannedDates = (plannedDays || []).map(d => d.planned_date);
    const preseasonPlanned = allPlannedDates.filter(d => d <= personalSummerStart).length;
    const summerPlanned = allPlannedDates.filter(d => d > personalSummerStart).length;
    const preseasonDailyPace = preseasonPlanned > 0 ? preseasonGoal / preseasonPlanned : 0;

    const summerGoalRaw = currentTier === 'mustDo' ? (goals.must_do_fp_goal || 0)
      : currentTier === 'couldDo' ? (goals.could_do_fp_goal || 0)
      : (goals.will_do_fp_goal || 0);
    const summerDailyPace = summerPlanned > 0 ? (summerGoalRaw - preseasonGoal) / summerPlanned : 0;

    return {
      ytdFP,
      remaining,
      dailyNeeded: Math.round(dailyNeeded * 100) / 100,
      userDailyAvg: Math.round(userDailyAvg * 100) / 100,
      futurePlanned,
      activeGoal,
      focusTier: currentTier as GoalTier,
      isUserPreseason,
      preseasonDailyPace,
      summerDailyPace,
      knockingDays,
    };
  }, [goals, entries, plannedDays, seasonConfig, selectedTierOverride, defaultFocusTier, isUserPreseason]);

  const isLoading = entriesLoading || plannedLoading;

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 h-full">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-[100px] w-full" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
    );
  }

  if (!entries || entries.length === 0) return null;

  const dailyNeeded = paceStats?.dailyNeeded || 0;

  const summerTiers: SummerTier[] = ['mustDo', 'willDo', 'couldDo'];
  const availableTiers = summerTiers.filter(t => tierGoals[t] > 0);

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
        activeGoalTotal={activeGoalTotal}
        onTierBadgeClick={!isUserPreseason && availableTiers.length > 1 ? () => setDrawerOpen(true) : undefined}
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

      {/* Tier selection drawer (summer only) */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-center">Select Goal Tier</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {availableTiers.map((tier) => {
              const config = GOAL_TIER_CONFIG[tier];
              const Icon = config.icon;
              const isSelected = activeTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => {
                    setSelectedTierOverride(tier);
                    setDrawerOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    isSelected
                      ? `${config.bgColor} ${config.borderColor} border-2`
                      : "bg-card border-border hover:bg-muted/50"
                  )}
                >
                  <div className={cn("p-2 rounded-lg", config.bgColor)}>
                    <Icon className={cn("w-4 h-4", config.color)} />
                  </div>
                  <div className="flex-1">
                    <div className={cn("text-sm font-semibold", isSelected ? config.color : "text-foreground")}>
                      {config.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {config.description}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-sm font-bold", config.color)}>
                      {tierGoals[tier]} FP+
                    </div>
                    <div className="text-[10px] text-muted-foreground">funded</div>
                  </div>
                  {isSelected && (
                    <ChevronRight className={cn("w-4 h-4 ml-1", config.color)} />
                  )}
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
