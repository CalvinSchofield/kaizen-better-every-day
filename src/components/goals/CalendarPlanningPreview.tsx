import { useState, useMemo, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, ChevronDown, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticLight } from '@/utils/haptics';
import { usePlannedDays } from '@/hooks/usePlannedDays';
import { usePreseasonFP } from '@/hooks/usePreseasonFP';
import { useEfpMode } from '@/hooks/useEfpMode';
import { useNavigate } from 'react-router-dom';
import { format, parseISO, isBefore, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday } from 'date-fns';

const PRESEASON_END = '2026-04-11';

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
  const navigate = useNavigate();
  const { plannedDays } = usePlannedDays();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { totalFP, totalPRMR } = usePreseasonFP();

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const handleToggleOpen = useCallback(() => {
    hapticLight();
    setIsOpen(prev => !prev);
  }, []);

  // Compute stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const preseasonEnd = parseISO(PRESEASON_END);

    const totalPlanned = plannedDays?.length || 0;

    // Future planned days
    const futurePlanned = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return date > today && !isBefore(preseasonEnd, date);
    }).length || 0;

    // Get active goal
    const conversionFactor = efpModeEnabled ? 1 : 1;
    const activeGoal = activeTier === 'preseason'
      ? (goals?.preseason_fp_goal || 0) * conversionFactor
      : activeTier === 'mustDo'
        ? (goals?.must_do_fp_goal || 0) * conversionFactor
        : activeTier === 'willDo'
          ? (goals?.will_do_fp_goal || 0) * conversionFactor
          : (goals?.could_do_fp_goal || 0) * conversionFactor;

    // Apply cancel buffer
    const cancelRate = goals?.cancel_rate || 0;
    const fundedGoalNeeded = cancelRate > 0 && cancelRate < 1
      ? activeGoal / (1 - cancelRate)
      : activeGoal;

    // Remaining needed
    const remaining = Math.max(0, fundedGoalNeeded - currentProgress);
    const remainingDays = futurePlanned + 1; // +1 for today
    const dailyNeeded = remainingDays > 0 ? remaining / remainingDays : 0;

    // Total planned season days
    const totalDays = knockingDays + futurePlanned;
    const dailyGoal = totalDays > 0 ? fundedGoalNeeded / totalDays : 0;

    return {
      totalPlanned,
      futurePlanned,
      knockingDays,
      dailyNeeded: Math.round(dailyNeeded * 10) / 10,
      dailyGoal: Math.round(dailyGoal * 10) / 10,
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
      const isSunday = getDay(day) === 0;
      return {
        day: day.getDate(),
        isPlanned,
        isToday: isToday(day),
        isSunday,
        dayOfWeek: getDay(day),
      };
    });
  }, [plannedDays]);

  // Offset for first day of month
  const firstDayOffset = useMemo(() => {
    const today = new Date();
    return getDay(startOfMonth(today));
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
                  Need {stats.dailyNeeded} {efpLabel}/day to hit your goal
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
                      <div className="text-center p-2 rounded-xl bg-muted/50">
                        <div className="text-lg font-bold text-foreground">{stats.dailyNeeded}</div>
                        <div className="text-[10px] text-muted-foreground">{efpLabel}/day needed</div>
                      </div>
                    </div>

                    {/* Mini month calendar strip */}
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-2">
                        {format(new Date(), 'MMMM yyyy')}
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
                              d.isPlanned && "bg-primary/20 text-primary",
                              d.isSunday && !d.isPlanned && "text-muted-foreground/30",
                              !d.isPlanned && !d.isSunday && "text-muted-foreground/60"
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
    </motion.div>
  );
};
