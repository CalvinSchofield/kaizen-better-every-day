import { useState, useMemo, useCallback, useEffect } from 'react';
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
import { format, isBefore, isAfter } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { useGoalPaceCalculator } from '@/hooks/useGoalPaceCalculator';

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

  // Use the unified pace calculator — single source of truth
  const unifiedPace = useGoalPaceCalculator();

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
  const personalSummerStart = seasonConfig?.personal_summer_start || '2026-04-12';
  const isSummerStarted = !isBefore(new Date(), parseLocalDate(personalSummerStart));

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
      const knockingEntries = data.filter(e => (e.doors_knocked || 0) >= 4);
      if (knockingEntries.length === 0) return 0;
      const totalMetric = knockingEntries.reduce((sum, e) => {
        return sum + (efpModeEnabled ? (Number(e.prmr) || 0) / 85 : (Number(e.fp_plus) || 0));
      }, 0);
      return totalMetric / knockingEntries.length;
    },
    enabled: !!userId,
    staleTime: 30 * 60 * 1000,
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
      if (error) {
        console.warn('Failed to fetch season heatmap entries:', error);
        return [];
      }
      return (data || []) as DailyEntry[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const handleToggleOpen = useCallback(() => {
    hapticLight();
    setIsOpen(prev => !prev);
  }, []);

  // Timeout to prevent infinite loading
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  useEffect(() => {
    if (!isLoadingPlanned && !isLoadingEntries) {
      setLoadingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setLoadingTimedOut(true), 8000);
    return () => clearTimeout(timer);
  }, [isLoadingPlanned, isLoadingEntries]);

  const isCalendarLoading = (isLoadingPlanned || isLoadingEntries) && !loadingTimedOut;

  // Derive display stats from the unified pace calculator
  const stats = useMemo(() => {
    const isPreseasonTier = activeTier === 'preseason';

    // Use unified calculator's dailyNeeded — the single source of truth
    const dailyNeeded = Math.round(unifiedPace.dailyNeeded * 10) / 10;
    const weeklyNeeded = Math.round(unifiedPace.weeklyNeeded * 10) / 10;

    // Remaining goal amount
    const remainingFp = Math.max(0, Math.round((unifiedPace.activeGoal - unifiedPace.currentProgress) * 10) / 10);
    const preseasonGoalHit = remainingFp <= 0;

    // Days left from unified season data
    const daysLeft = unifiedPace.season.plannedDaysTotal - unifiedPace.season.plannedDaysElapsed;

    // Forecasted preseason total for summer display
    const dailyAvg = knockingDays > 0 ? currentProgress / knockingDays : 0;
    const forecastedPreseasonTotal = isPreseasonTier
      ? Math.round((currentProgress + dailyAvg * Math.max(daysLeft, 0)) * 10) / 10
      : Math.round(currentProgress * 10) / 10;

    return {
      daysLeft: Math.max(0, daysLeft),
      dailyNeeded,
      weeklyNeeded,
      forecastedPreseasonTotal,
      preseasonDailyPace: Math.round(unifiedPace.preseasonDailyPace * 10) / 10,
      summerDailyPace: Math.round(unifiedPace.summerDailyPace * 10) / 10,
      remainingFp,
      preseasonGoalHit,
    };
  }, [unifiedPace, activeTier, knockingDays, currentProgress]);

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

              {/* Hero stat - daily target (unified with calendar) */}
              <div className="text-center space-y-1">
                {isLoadingPlanned || unifiedPace.isLoading ? (
                  <div className="space-y-2 flex flex-col items-center">
                    <Skeleton className="h-9 w-48" />
                    <Skeleton className="h-3 w-56" />
                    <Skeleton className="h-5 w-36 rounded-full" />
                  </div>
                ) : (
                  <>
                    <motion.div
                      key={stats.dailyNeeded}
                      initial={{ scale: 0.95, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-amber-500"
                    >
                      {stats.dailyNeeded} / day needed
                    </motion.div>
                    <div className="text-xs text-muted-foreground leading-snug max-w-[260px] mx-auto">
                      {activeTier === 'preseason'
                        ? `${efpLabel} to hit your preseason goal`
                        : `${efpLabel} to hit your ${unifiedPace.tierLabel} goal`
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