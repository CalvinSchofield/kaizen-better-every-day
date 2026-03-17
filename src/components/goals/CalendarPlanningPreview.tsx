import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, ChevronDown, ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import { WhatIfScenarioDrawer } from './WhatIfScenarioDrawer';
import { SeasonHeatmap, DailyEntry } from './SeasonHeatmap';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { usePlannedDays } from '@/hooks/usePlannedDays';
import { usePreseasonFP } from '@/hooks/usePreseasonFP';
import { useEfpMode } from '@/hooks/useEfpMode';
import { useCurrentUserId } from '@/hooks/useCurrentUserId';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, isBefore, eachDayOfInterval, getDay, isAfter } from 'date-fns';

const PRESEASON_END = '2026-04-11';
const GLOBAL_SUMMER_START = '2026-04-12';
const SEASON_START = '2025-09-28';
const SEASON_END = '2026-09-27';

interface CalendarPlanningPreviewProps {
  goals: any;
  activeTier: 'preseason' | 'mustDo' | 'willDo' | 'couldDo';
  knockingDays: number;
  currentProgress: number;
  summerProgress?: number;
  summerKnockingDays?: number;
}

export const CalendarPlanningPreview = ({
  goals,
  activeTier,
  knockingDays,
  currentProgress,
  summerProgress = 0,
  summerKnockingDays = 0,
}: CalendarPlanningPreviewProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const { plannedDays, isLoading: isLoadingPlanned, isFetching: isFetchingPlanned } = usePlannedDays();
  const navigate = useNavigate();
  const { efpModeEnabled, calculateEfp, isVet } = useEfpMode();
  const { totalFP, totalPRMR } = usePreseasonFP();
  const { userId } = useCurrentUserId();

  // Fetch season config for summer date range and excluded days
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-whatif', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end, excluded_summer_days')
        .eq('user_id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Historical 2025 summer daily average for severity calibration during preseason
  const personalSummerStart = seasonConfig?.personal_summer_start || GLOBAL_SUMMER_START;
  const isSummerStarted = !isBefore(new Date(), parseISO(personalSummerStart));

  const { data: historicalSummerAvg = 0 } = useQuery({
    queryKey: ['historical-summer-avg', userId],
    queryFn: async () => {
      if (!userId) return 0;
      const { data } = await supabase
        .from('historical_entries')
        .select('prmr, fp_plus, doors_knocked')
        .eq('user_id', userId)
        .eq('season_type', 'summer')
        .eq('season_year', 2025);
      if (!data || data.length === 0) return 0;
      // Filter to actual knocking days (≥4 doors)
      const knockingEntries = data.filter(e => (e.doors_knocked || 0) >= 4);
      if (knockingEntries.length === 0) return 0;
      // Calculate daily avg in the same metric (EFP or FP+)
      const totalMetric = knockingEntries.reduce((sum, e) => {
        return sum + (efpModeEnabled ? (Number(e.prmr) || 0) / 85 : (Number(e.fp_plus) || 0));
      }, 0);
      return totalMetric / knockingEntries.length;
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000, // Cache for 30 min — historical data doesn't change
  });

  // Fetch ALL daily entries for the full season (for heatmap)
  const { data: seasonEntries, isLoading: isLoadingEntries } = useQuery({
    queryKey: ['season-heatmap-entries', userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, prmr, is_finalized')
        .eq('user_id', userId)
        .gte('entry_date', SEASON_START)
        .lte('entry_date', SEASON_END);
      if (error) return [];
      return (data || []) as DailyEntry[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
  });

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const handleToggleOpen = useCallback(() => {
    hapticLight();
    setIsOpen(prev => !prev);
  }, []);

  const isCalendarLoading = isLoadingPlanned || isLoadingEntries;

  // Compute stats with preseason vs summer split
  const stats = useMemo(() => {
    const today = new Date();
    const preseasonEnd = parseISO(PRESEASON_END);
    const summerStart = parseISO(GLOBAL_SUMMER_START);

    const isPreseasonTier = activeTier === 'preseason';

    const preseasonPlanned = plannedDays?.filter(d => !isAfter(parseISO(d.planned_date), preseasonEnd)).length || 0;
    const summerPlanned = plannedDays?.filter(d => !isBefore(parseISO(d.planned_date), summerStart)).length || 0;
    const totalPlanned = isPreseasonTier ? preseasonPlanned : summerPlanned;

    const activeGoal = isPreseasonTier
      ? (goals?.preseason_fp_goal || 0)
      : activeTier === 'mustDo'
        ? (goals?.must_do_fp_goal || 0)
        : activeTier === 'willDo'
          ? (goals?.will_do_fp_goal || 0)
          : (goals?.could_do_fp_goal || 0);

    const cancelRate = goals?.cancel_rate || 0;
    const fundedGoalNeeded = cancelRate > 0 && cancelRate < 1
      ? activeGoal / (1 - cancelRate)
      : activeGoal;

    const dailyAvg = knockingDays > 0 ? currentProgress / knockingDays : 0;

    const futurePreseasonPlanned = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isAfter(date, preseasonEnd);
    }).length || 0;

    const remainingPreseasonWorkDays = futurePreseasonPlanned > 0
      ? futurePreseasonPlanned
      : (() => {
          const days = eachDayOfInterval({ start: today, end: preseasonEnd });
          return days.filter(d => d > today && getDay(d) !== 0).length;
        })();

    const forecastedPreseasonTotal = currentProgress + (dailyAvg * remainingPreseasonWorkDays);

    let dailyNeeded: number;
    let remainingFp = 0;
    let preseasonGoalHit = false;

    if (isPreseasonTier) {
      const remaining = Math.max(0, fundedGoalNeeded - currentProgress);
      remainingFp = Math.round(remaining * 10) / 10;
      preseasonGoalHit = remaining <= 0;
      const remainingDays = futurePreseasonPlanned + 1;
      dailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;
    } else {
      const remainingForSummer = Math.max(0, fundedGoalNeeded - forecastedPreseasonTotal);
      const futureSummerPlanned = plannedDays?.filter(d => {
        const date = parseISO(d.planned_date);
        return !isBefore(date, summerStart) && !excluded.includes(d.planned_date);
      }).length || 0;
      dailyNeeded = futureSummerPlanned > 0 ? remainingForSummer / futureSummerPlanned : 0;
    }

    const weeklyNeeded = Math.round(dailyNeeded * 6 * 10) / 10;
    // Pace targets for heatmap — use fixed baseline (total planned days) not shrinking remaining
    const preseasonGoal = goals?.preseason_fp_goal || 0;
    const totalPreseasonPlannedDays = knockingDays + (futurePreseasonPlanned > 0 ? futurePreseasonPlanned : 1);
    const preseasonDailyPace = totalPreseasonPlannedDays > 0 ? preseasonGoal / totalPreseasonPlannedDays : 0;
    
    const summerGoal = activeGoal;
    const futureSummerPlannedAll = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return !isBefore(date, summerStart) && !excluded.includes(d.planned_date);
    }).length || 0;
    const summerDailyPace = futureSummerPlannedAll > 0
      ? Math.max(0, summerGoal - forecastedPreseasonTotal) / futureSummerPlannedAll
      : dailyNeeded;

    // Days left = future planned days (after today)
    const futurePlanned = isPreseasonTier
      ? futurePreseasonPlanned
      : (plannedDays?.filter(d => {
          const date = parseISO(d.planned_date);
          return date > today && !isBefore(date, summerStart);
        }).length || 0);

    return {
      totalPlanned,
      knockingDays,
      daysLeft: futurePlanned,
      dailyNeeded: Math.round(dailyNeeded * 10) / 10,
      weeklyNeeded,
      forecastedPreseasonTotal: Math.round(forecastedPreseasonTotal * 10) / 10,
      preseasonDailyPace: Math.round(preseasonDailyPace * 10) / 10,
      summerDailyPace: Math.round(summerDailyPace * 10) / 10,
      remainingFp,
      preseasonGoalHit,
    };
  }, [plannedDays, goals, activeTier, efpModeEnabled, knockingDays, currentProgress]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <Card className="border-border/50 overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full" onClick={handleToggleOpen}>
            <div className="p-4 pb-3">
              {/* Header row */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <CalendarDays className="w-4 h-4 text-primary" />
                  </div>
                  <span className="font-semibold">Calendar Planning</span>
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform duration-200",
                  isOpen && "rotate-180"
                )} />
              </div>

              {/* Hero stat - weekly target */}
              <div className="text-center space-y-1">
                {isLoadingPlanned ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-3 w-56" />
                    <Skeleton className="h-5 w-36 rounded-full" />
                  </div>
                ) : (
                  <>
                    <motion.div
                      key={activeTier === 'preseason' ? stats.dailyNeeded : stats.weeklyNeeded}
                      initial={{ scale: 0.95, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-amber-500"
                    >
                      {activeTier === 'preseason'
                        ? `${stats.dailyNeeded} / day needed`
                        : `${stats.weeklyNeeded} / week needed`}
                    </motion.div>
                    <div className="text-xs text-muted-foreground leading-snug max-w-[260px] mx-auto">
                      {activeTier === 'preseason'
                        ? `${efpLabel} to hit your preseason goal`
                        : `if you start summer at ~${stats.forecastedPreseasonTotal} ${efpLabel} (current pace)`
                      }
                    </div>
                    <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                      {stats.daysLeft} {activeTier === 'preseason' ? 'preseason' : 'summer'} days left
                    </div>
                  </>
                )}
              </div>
            </div>
          </CollapsibleTrigger>

          <AnimatePresence>
            {isOpen && (
              <CollapsibleContent forceMount>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-4">
                    {/* What-if explore CTA */}
                    <div
                      className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20 cursor-pointer active:scale-[0.97] transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticLight();
                        setWhatIfOpen(true);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <div>
                          <div className="text-sm font-semibold text-foreground">{stats.dailyNeeded} {efpLabel}/day needed</div>
                          <div className="text-[10px] text-muted-foreground">Explore what-if scenarios</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-primary" />
                    </div>

                    {/* Season Heatmap */}
                    <SeasonHeatmap
                      dailyEntries={seasonEntries}
                      plannedDays={plannedDays}
                      excludedSummerDays={(seasonConfig?.excluded_summer_days as string[]) || []}
                      personalSummerStart={seasonConfig?.personal_summer_start}
                      personalSummerEnd={seasonConfig?.personal_summer_end}
                      preseasonDailyPace={stats.preseasonDailyPace}
                      summerDailyPace={stats.summerDailyPace}
                      efpModeEnabled={efpModeEnabled}
                      isLoading={isCalendarLoading}
                      activeTier={activeTier}
                      dailyNeeded={stats.dailyNeeded}
                      remainingFp={stats.remainingFp}
                      preseasonGoalHit={stats.preseasonGoalHit}
                    />

                    {/* Plan Days CTA */}
                    <Button
                      className="w-full active:scale-[0.97] transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticLight();
                        navigate('/calendar');
                      }}
                    >
                      <CalendarDays className="w-4 h-4 mr-2" />
                      Plan Days on Calendar
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              </CollapsibleContent>
            )}
          </AnimatePresence>
        </Collapsible>
      </Card>

      <WhatIfScenarioDrawer
        open={whatIfOpen}
        onOpenChange={setWhatIfOpen}
        goals={goals}
        currentProgress={currentProgress}
        knockingDays={knockingDays}
        plannedDays={plannedDays}
        efpModeEnabled={efpModeEnabled}
        calculateEfp={calculateEfp}
        forecastedPreseasonTotal={stats.forecastedPreseasonTotal}
        isVet={isVet}
        personalSummerStart={seasonConfig?.personal_summer_start}
        personalSummerEnd={seasonConfig?.personal_summer_end}
        excludedSummerDays={(seasonConfig?.excluded_summer_days as string[]) || []}
        summerProgress={summerProgress}
        summerKnockingDays={summerKnockingDays}
        historicalSummerAvg={historicalSummerAvg}
      />
    </motion.div>
  );
};
