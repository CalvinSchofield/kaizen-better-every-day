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
import { useGoalPaceCalculatorForUser } from '@/hooks/useGoalPaceCalculatorForUser';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';

const SEASON_START = '2025-09-28';

interface ProfileSeasonHeatmapProps {
  userId: string;
  isOwnProfile: boolean;
}

export const ProfileSeasonHeatmap = ({ userId, isOwnProfile }: ProfileSeasonHeatmapProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTierOverride, setSelectedTierOverride] = useState<GoalTier | null>(null);

  // Use the SAME unified calculator as the Goal Progress card
  const paceData = useGoalPaceCalculatorForUser(userId);

  // Fetch season entries (still needed for the heatmap visual)
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

  // Fetch planned days (still needed for the heatmap visual)
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

  // Fetch season config (for heatmap visual)
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

  // Derive tier info from the unified paceData
  const isUserPreseason = paceData.isPreseason;
  const activeTier: GoalTier = useMemo(() => {
    if (isUserPreseason) return 'preseason';
    return selectedTierOverride || (paceData.focusTier as SummerTier) || 'willDo';
  }, [isUserPreseason, selectedTierOverride, paceData.focusTier]);

  // Tier goals from the unified allTiers
  const tierGoals = useMemo(() => {
    const mustDo = paceData.allTiers?.find(t => t.key === 'mustDo')?.goal || 0;
    const willDo = paceData.allTiers?.find(t => t.key === 'willDo')?.goal || 0;
    const couldDo = paceData.allTiers?.find(t => t.key === 'couldDo')?.goal || 0;
    return {
      preseason: paceData.isPreseason ? paceData.activeGoal : 0,
      mustDo,
      willDo,
      couldDo,
    };
  }, [paceData.allTiers, paceData.isPreseason, paceData.activeGoal]);

  const activeGoalTotal = tierGoals[activeTier];

  // Pull pace stats directly from the unified calculator
  const dailyNeeded = paceData.dailyNeeded;
  const userDailyAvg = paceData.userDailyAvg;
  const remaining = paceData.season.remaining;
  const futurePlanned = Math.max(0, paceData.season.plannedDaysTotal - paceData.season.plannedDaysElapsed);

  const isLoading = entriesLoading || plannedLoading || paceData.isLoading;

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
        preseasonDailyPace={paceData.preseasonDailyPace}
        summerDailyPace={paceData.summerDailyPace}
        efpModeEnabled={false}
        isLoading={false}
        activeTier={activeTier}
        dailyNeeded={dailyNeeded}
        remainingFp={remaining}
        preseasonGoalHit={remaining <= 0}
        activeGoalTotal={activeGoalTotal}
        onTierBadgeClick={!isUserPreseason && availableTiers.length > 1 ? () => setDrawerOpen(true) : undefined}
      />

      {/* Pace comparison bar — same numbers as Goal Progress card */}
      {paceData.hasGoals && paceData.activeGoal > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <div className="flex items-center gap-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Avg/day</div>
              <div className="text-sm font-bold text-foreground">{userDailyAvg.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Need/day</div>
              <div className={cn(
                "text-sm font-bold",
                userDailyAvg >= dailyNeeded ? "text-emerald-500" : "text-amber-500"
              )}>
                {dailyNeeded.toFixed(2)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {paceData.severity === 'green' ? (
              <>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-500">On Pace</span>
              </>
            ) : paceData.severity === 'amber' ? (
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
      {paceData.hasGoals && futurePlanned > 0 && (
        <div className="text-[10px] text-muted-foreground text-center">
          {futurePlanned} planned days remaining · {remaining.toFixed(1)} {paceData.metricLabel} to go
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
