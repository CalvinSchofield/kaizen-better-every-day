import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, ChevronDown, ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import { WhatIfScenarioDrawer } from './WhatIfScenarioDrawer';
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
  const { plannedDays } = usePlannedDays();
  const navigate = useNavigate();
  const { efpModeEnabled, calculateEfp, isVet } = useEfpMode();
  const { totalFP, totalPRMR } = usePreseasonFP();
  const { userId } = useCurrentUserId();

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const handleToggleOpen = useCallback(() => {
    hapticLight();
    setIsOpen(prev => !prev);
  }, []);

  // Fetch worked dates for the current month to show green dots
  const { data: workedDates } = useQuery({
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

    // Forecasted preseason total
    const forecastedPreseasonTotal = currentProgress + (dailyAvg * futurePreseasonPlanned);

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

    return {
      totalPlanned,
      knockingDays,
      dailyNeeded: Math.round(dailyNeeded * 10) / 10,
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

              {/* Hero stat */}
              <div className="text-center space-y-1">
                <motion.div
                  key={stats.totalPlanned}
                  initial={{ scale: 0.95, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary to-amber-500"
                >
                  {stats.totalPlanned} days planned
                </motion.div>
                <div className="text-xs text-muted-foreground">
                  Need {stats.dailyNeeded} {efpLabel}/day to hit your {activeTier === 'preseason' ? 'preseason' : 'summer'} goal
                </div>
                {stats.knockingDays > 0 && (
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground">
                    {stats.knockingDays} days done so far
                  </div>
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
                    {/* Summary stats row */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 rounded-xl bg-muted/50">
                        <div className="text-lg font-bold text-foreground">{stats.totalPlanned}</div>
                        <div className="text-[10px] text-muted-foreground">Planned</div>
                      </div>
                      <div className="text-center p-2 rounded-xl bg-muted/50">
                        <div className="text-lg font-bold text-foreground">{stats.knockingDays}</div>
                        <div className="text-[10px] text-muted-foreground">Worked</div>
                      </div>
                      <div
                        className="text-center p-2 rounded-xl bg-primary/10 border border-primary/20 cursor-pointer active:scale-[0.95] transition-all relative group"
                        onClick={(e) => {
                          e.stopPropagation();
                          hapticLight();
                          setWhatIfOpen(true);
                        }}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <Sparkles className="w-3 h-3 text-primary opacity-70" />
                          <span className="text-lg font-bold text-foreground">{stats.dailyNeeded}</span>
                          <ChevronRight className="w-3 h-3 text-primary opacity-50" />
                        </div>
                        <div className="text-[10px] text-primary font-medium">{efpLabel}/day needed</div>
                        <div className="text-[8px] text-muted-foreground mt-0.5">Tap to explore</div>
                      </div>
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
                              // Worked days get green (takes priority over planned amber)
                              d.isWorked && "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                              // Planned but not yet worked = amber/primary
                              d.isPlanned && !d.isWorked && "bg-primary/20 text-primary",
                              // Default states
                              d.isSunday && !d.isPlanned && !d.isWorked && "text-muted-foreground/30",
                              !d.isPlanned && !d.isWorked && !d.isSunday && "text-muted-foreground/60"
                            )}
                          >
                            {d.day}
                          </div>
                        ))}
                      </div>
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
      />
    </motion.div>
  );
};
