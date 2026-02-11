import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, ChevronDown, ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import { WhatIfScenarioDrawer } from './WhatIfScenarioDrawer';
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
import { format, parseISO, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isToday, isAfter } from 'date-fns';

const PRESEASON_END = '2026-04-11';
const GLOBAL_SUMMER_START = '2026-04-12';

interface CalendarPlanningPreviewProps {
  goals: any;
  activeTier: 'preseason' | 'mustDo' | 'willDo' | 'couldDo';
  knockingDays: number;
  currentProgress: number;
}

export const CalendarPlanningPreview = ({
  goals,
  activeTier,
  knockingDays,
  currentProgress,
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

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const handleToggleOpen = useCallback(() => {
    hapticLight();
    setIsOpen(prev => !prev);
  }, []);

  // Fetch worked dates for the current month to show green dots
  const { data: workedDates, isLoading: isLoadingWorked, isFetching: isFetchingWorked } = useQuery({
    queryKey: ['calendar-preview-worked-dates', userId],
    queryFn: async () => {
      if (!userId) return new Set<string>();
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date')
        .eq('user_id', userId)
        .eq('is_finalized', true)
        .gte('entry_date', monthStart)
        .lte('entry_date', monthEnd);
      if (error) return new Set<string>();
      return new Set((data || []).map(e => e.entry_date));
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  // Show calendar skeleton while either planned days or worked dates are loading/refetching
  const isCalendarLoading = isLoadingPlanned || isLoadingWorked || (isFetchingPlanned && !plannedDays) || (isFetchingWorked && !workedDates);

  // Compute stats with preseason vs summer split
  const stats = useMemo(() => {
    const today = new Date();
    const preseasonEnd = parseISO(PRESEASON_END);
    const summerStart = parseISO(GLOBAL_SUMMER_START);

    const totalPlanned = plannedDays?.length || 0;

    const isPreseasonTier = activeTier === 'preseason';

    // Get active goal
    const activeGoal = isPreseasonTier
      ? (goals?.preseason_fp_goal || 0)
      : activeTier === 'mustDo'
        ? (goals?.must_do_fp_goal || 0)
        : activeTier === 'willDo'
          ? (goals?.will_do_fp_goal || 0)
          : (goals?.could_do_fp_goal || 0);

    // Apply cancel buffer
    const cancelRate = goals?.cancel_rate || 0;
    const fundedGoalNeeded = cancelRate > 0 && cancelRate < 1
      ? activeGoal / (1 - cancelRate)
      : activeGoal;

    // Daily average for forecasting
    const dailyAvg = knockingDays > 0 ? currentProgress / knockingDays : 0;

    // Future preseason planned days
    const futurePreseasonPlanned = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isAfter(date, preseasonEnd);
    }).length || 0;

    // If no preseason days are explicitly planned, estimate remaining work days (Mon-Sat)
    const remainingPreseasonWorkDays = futurePreseasonPlanned > 0
      ? futurePreseasonPlanned
      : (() => {
          const days = eachDayOfInterval({ start: today, end: preseasonEnd });
          // Exclude today (already counted in currentProgress) and Sundays
          return days.filter(d => d > today && getDay(d) !== 0).length;
        })();

    // Forecasted preseason total
    const forecastedPreseasonTotal = currentProgress + (dailyAvg * remainingPreseasonWorkDays);

    let dailyNeeded: number;

    if (isPreseasonTier) {
      const remaining = Math.max(0, fundedGoalNeeded - currentProgress);
      const remainingDays = futurePreseasonPlanned + 1;
      dailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;
    } else {
      const remainingForSummer = Math.max(0, fundedGoalNeeded - forecastedPreseasonTotal);
      const futureSummerPlanned = plannedDays?.filter(d => {
        const date = parseISO(d.planned_date);
        return !isBefore(date, summerStart);
      }).length || 0;
      dailyNeeded = futureSummerPlanned > 0 ? remainingForSummer / futureSummerPlanned : 0;
    }

    const weeklyNeeded = Math.round(dailyNeeded * 6 * 10) / 10; // 6 work days per week

    return {
      totalPlanned,
      knockingDays,
      dailyNeeded: Math.round(dailyNeeded * 10) / 10,
      weeklyNeeded,
      forecastedPreseasonTotal: Math.round(forecastedPreseasonTotal * 10) / 10,
    };
  }, [plannedDays, goals, activeTier, efpModeEnabled, knockingDays, currentProgress]);

  // Mini calendar data for current month
  const miniCalendarData = useMemo(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    return days.map(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const isPlanned = plannedDays?.some(d => d.planned_date === dateStr) || false;
      const workedSet = workedDates instanceof Set ? workedDates : new Set<string>();
      const isWorked = workedSet.has(dateStr);
      const isSunday = getDay(day) === 0;
      return {
        day: day.getDate(),
        isPlanned,
        isWorked,
        isToday: isToday(day),
        isSunday,
        dayOfWeek: getDay(day),
      };
    });
  }, [plannedDays, workedDates]);

  // Offset for first day of month
  const firstDayOffset = useMemo(() => {
    return getDay(startOfMonth(new Date()));
  }, []);

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
                      key={stats.weeklyNeeded}
                      initial={{ scale: 0.95, opacity: 0.5 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 25 }}
                      className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-amber-500"
                    >
                      {stats.weeklyNeeded} / week needed
                    </motion.div>
                    <div className="text-xs text-muted-foreground leading-snug max-w-[260px] mx-auto">
                      {activeTier === 'preseason'
                        ? `${efpLabel} to hit your preseason goal`
                        : `if you start summer at ~${stats.forecastedPreseasonTotal} ${efpLabel} (current pace)`
                      }
                    </div>
                    <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                      {stats.totalPlanned} days planned · {stats.knockingDays} worked
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

                    {/* Mini month calendar strip */}
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="text-xs font-medium text-muted-foreground">
                          {format(new Date(), 'MMMM yyyy')}
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-[8px] text-muted-foreground">Worked</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full bg-primary/30" />
                            <span className="text-[8px] text-muted-foreground">Planned</span>
                          </div>
                        </div>
                      </div>
                      {isCalendarLoading ? (
                        <div className="grid grid-cols-7 gap-1">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i} className="text-center text-[9px] text-muted-foreground/60 font-medium">
                              {d}
                            </div>
                          ))}
                          {Array.from({ length: firstDayOffset }).map((_, i) => (
                            <div key={`empty-${i}`} />
                          ))}
                          {Array.from({ length: miniCalendarData.length || 28 }).map((_, i) => (
                            <div key={`skel-${i}`} className="aspect-square flex items-center justify-center">
                              <Skeleton className="w-6 h-6 rounded-full" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid grid-cols-7 gap-1">
                          {/* Day headers */}
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                            <div key={i} className="text-center text-[9px] text-muted-foreground/60 font-medium">
                              {d}
                            </div>
                          ))}
                          {/* Empty cells for offset */}
                          {Array.from({ length: firstDayOffset }).map((_, i) => (
                            <div key={`empty-${i}`} />
                          ))}
                          {/* Day dots */}
                          {miniCalendarData.map((d, i) => (
                            <div
                              key={i}
                              className={cn(
                                "aspect-square rounded-full flex items-center justify-center text-[8px] font-medium",
                                d.isToday && "ring-1 ring-primary",
                                d.isWorked && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                                d.isPlanned && !d.isWorked && "bg-primary/20 text-primary",
                                d.isSunday && !d.isPlanned && !d.isWorked && "text-muted-foreground/30",
                                !d.isPlanned && !d.isWorked && !d.isSunday && "text-muted-foreground/60"
                              )}
                            >
                              {d.day}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

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
      />
    </motion.div>
  );
};
