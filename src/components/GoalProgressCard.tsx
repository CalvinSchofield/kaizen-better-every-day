import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { Target, TrendingUp, CheckCircle2, Settings2, Flame } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, differenceInWeeks, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "@/hooks/useRepData";

// Season boundaries
const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const SUMMER_START = '2026-04-12';
const SUMMER_END = '2026-09-27';

const parseLocalDate = (dateString: string): Date => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const getLocalToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

interface GoalProgressCardProps {
  entries: any[];
  currentDate: Date;
  viewMode: "week" | "month";
}

export const GoalProgressCard = ({ entries, currentDate, viewMode }: GoalProgressCardProps) => {
  const navigate = useNavigate();
  const { goals } = useRepGoals();
  const { totalFP: preseasonFP, totalEFP: preseasonEFP } = usePreseasonFP();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { plannedDays } = usePlannedDays();
  const { repData } = useRepData();
  const today = getLocalToday();

  // Fetch user's personal summer dates
  const { data: seasonConfig } = useQuery({
    queryKey: ['season-config-for-goal-card', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', repData.user_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!repData?.user_id,
  });

  const personalSummerStart = seasonConfig?.personal_summer_start || SUMMER_START;
  const personalSummerEnd = seasonConfig?.personal_summer_end || SUMMER_END;

  // Determine if we're in preseason or summer
  const isInPreseason = useMemo(() => {
    const preseasonEndDate = parseLocalDate(PRESEASON_END);
    return today <= preseasonEndDate;
  }, [today]);

  // Calculate period totals (week or month)
  const periodTotals = useMemo(() => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);

    return entries.reduce((totals, entry) => {
      const [year, month, day] = entry.entry_date.split('-').map(Number);
      const entryDate = new Date(year, month - 1, day);
      const isInView = viewMode === "month"
        ? entryDate >= monthStart && entryDate <= monthEnd
        : entryDate >= weekStart && entryDate <= weekEnd;

      if (isInView && entry.is_finalized) {
        totals.fpPlus += entry.fp_plus || 0;
        totals.prmr += entry.prmr || 0;
      }
      return totals;
    }, { fpPlus: 0, prmr: 0 });
  }, [entries, currentDate, viewMode]);

  // Count planned days in period (total and elapsed)
  const { plannedDaysInPeriod, elapsedPlannedDays } = useMemo(() => {
    if (!plannedDays) return { plannedDaysInPeriod: 0, elapsedPlannedDays: 0 };
    
    const periodStart = viewMode === "month" 
      ? startOfMonth(currentDate) 
      : startOfWeek(currentDate);
    const periodEnd = viewMode === "month" 
      ? endOfMonth(currentDate) 
      : endOfWeek(currentDate);
    
    const periodStartStr = format(periodStart, 'yyyy-MM-dd');
    const periodEndStr = format(periodEnd, 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');
    
    const allPlannedInPeriod = plannedDays.filter(d => 
      d.planned_date >= periodStartStr && d.planned_date <= periodEndStr
    );
    
    // Elapsed = planned days that have passed (up to and including today)
    const elapsed = allPlannedInPeriod.filter(d => d.planned_date <= todayStr);
    
    return {
      plannedDaysInPeriod: allPlannedInPeriod.length,
      elapsedPlannedDays: elapsed.length
    };
  }, [plannedDays, currentDate, viewMode, today]);

  // Calculate weeks remaining in each season (for fixed weekly goals)
  const { weeksRemainingPreseason, weeksRemainingSummer } = useMemo(() => {
    const preseasonEnd = parseLocalDate(PRESEASON_END);
    const summerEnd = parseLocalDate(personalSummerEnd);
    const weekStart = startOfWeek(today);
    
    // Weeks remaining = full weeks from start of this week to end of season
    const preseasonWeeks = Math.max(1, Math.ceil(differenceInDays(preseasonEnd, weekStart) / 7));
    const summerWeeks = Math.max(1, Math.ceil(differenceInDays(summerEnd, weekStart) / 7));
    
    return {
      weeksRemainingPreseason: preseasonWeeks,
      weeksRemainingSummer: summerWeeks
    };
  }, [today, personalSummerEnd]);

  // Get current cumulative totals
  const cumulativeTotals = useMemo(() => {
    return entries.reduce((totals, entry) => {
      if (entry.is_finalized) {
        totals.fpPlus += entry.fp_plus || 0;
        totals.prmr += entry.prmr || 0;
      }
      return totals;
    }, { fpPlus: preseasonFP || 0, prmr: 0 });
  }, [entries, preseasonFP]);

  const cumulativeEFP = calculateEfp(cumulativeTotals.prmr) + (preseasonEFP || 0);
  const cumulativeFPPlus = cumulativeTotals.fpPlus;

  if (!goals || !goals.setup_complete) {
    return null;
  }

  const conversionFactor = (goals.avg_prmr_per_fp || 85) / 85;
  const metricLabel = efpModeEnabled ? "EFP" : "FP+";

  // Calculate period progress
  const periodProgress = efpModeEnabled ? calculateEfp(periodTotals.prmr) : periodTotals.fpPlus;
  const currentProgress = efpModeEnabled ? cumulativeEFP : cumulativeFPPlus;

  // Goal values based on season
  const preseasonGoal = goals.preseason_fp_goal || 0;
  const displayPreseasonGoal = efpModeEnabled ? preseasonGoal * conversionFactor : preseasonGoal;
  
  const mustDoGoal = goals.must_do_fp_goal || 0;
  const willDoGoal = goals.will_do_fp_goal || 0;
  const couldDoGoal = goals.could_do_fp_goal || 0;
  const displayMustDo = efpModeEnabled ? mustDoGoal * conversionFactor : mustDoGoal;
  const displayWillDo = efpModeEnabled ? willDoGoal * conversionFactor : willDoGoal;
  const displayCouldDo = efpModeEnabled ? couldDoGoal * conversionFactor : couldDoGoal;

  // Calculate FIXED weekly/monthly goals based on remaining season goal ÷ remaining periods
  // This creates a consistent target that doesn't shrink as you work through the week
  const remainingPreseasonGoal = Math.max(0, displayPreseasonGoal - currentProgress);
  const weeklyPreseasonGoal = weeksRemainingPreseason > 0 
    ? remainingPreseasonGoal / weeksRemainingPreseason 
    : 0;

  // For summer, calculate weekly goals for each tier
  const remainingMustDo = Math.max(0, displayMustDo - currentProgress);
  const remainingWillDo = Math.max(0, displayWillDo - currentProgress);
  const remainingCouldDo = Math.max(0, displayCouldDo - currentProgress);
  
  const weeklyMustDo = weeksRemainingSummer > 0 ? remainingMustDo / weeksRemainingSummer : 0;
  const weeklyWillDo = weeksRemainingSummer > 0 ? remainingWillDo / weeksRemainingSummer : 0;
  const weeklyCouldDo = weeksRemainingSummer > 0 ? remainingCouldDo / weeksRemainingSummer : 0;

  // For summer, determine current target tier
  const mustDoComplete = currentProgress >= displayMustDo;
  const willDoComplete = currentProgress >= displayWillDo;
  const couldDoComplete = currentProgress >= displayCouldDo;

  let currentTarget = displayMustDo;
  let currentTargetLabel = "Must Do";
  let currentWeeklyTarget = weeklyMustDo;
  if (mustDoComplete && !willDoComplete) {
    currentTarget = displayWillDo;
    currentTargetLabel = "Will Do";
    currentWeeklyTarget = weeklyWillDo;
  } else if (willDoComplete && !couldDoComplete) {
    currentTarget = displayCouldDo;
    currentTargetLabel = "Could Do";
    currentWeeklyTarget = weeklyCouldDo;
  } else if (couldDoComplete) {
    currentTarget = displayCouldDo;
    currentTargetLabel = "Could Do";
    currentWeeklyTarget = 0;
  }

  // Period goal is FIXED for the week/month - doesn't shrink as you work
  // For month view, multiply weekly goal by ~4
  const periodGoal = isInPreseason
    ? viewMode === "month" ? weeklyPreseasonGoal * 4 : weeklyPreseasonGoal
    : viewMode === "month" ? currentWeeklyTarget * 4 : currentWeeklyTarget;

  const periodProgressPercent = periodGoal > 0 
    ? Math.min((periodProgress / periodGoal) * 100, 100) 
    : 0;
  const periodRemaining = Math.max(0, periodGoal - periodProgress);

  // Days remaining in period for catch-up calculation
  const remainingDaysInPeriod = plannedDaysInPeriod - elapsedPlannedDays;
  const catchUpPerDay = remainingDaysInPeriod > 0 ? periodRemaining / remainingDaysInPeriod : 0;
  const dailyTarget = plannedDaysInPeriod > 0 ? periodGoal / plannedDaysInPeriod : 0;
  
  // Pace: compare actual progress to expected (proportional to elapsed days)
  const expectedProgressSoFar = plannedDaysInPeriod > 0 
    ? (periodGoal * elapsedPlannedDays) / plannedDaysInPeriod 
    : 0;
  const paceVariance = periodProgress - expectedProgressSoFar;
  const isOnPace = paceVariance >= 0;
  const isPeriodComplete = elapsedPlannedDays >= plannedDaysInPeriod && plannedDaysInPeriod > 0;

  // Overall progress (for end goal reminder)
  const overallTarget = isInPreseason ? displayPreseasonGoal : currentTarget;
  const overallRemaining = Math.max(0, overallTarget - currentProgress);
  const overallProgressPercent = overallTarget > 0 
    ? Math.min((currentProgress / overallTarget) * 100, 100) 
    : 0;

  const periodLabel = viewMode === "month" 
    ? format(currentDate, 'MMMM') 
    : `Week of ${format(startOfWeek(currentDate), 'MMM d')}`;

  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Goal Progress</span>
        </div>
        <button
          onClick={() => navigate('/goals')}
          className="text-muted-foreground hover:text-primary transition-colors"
          aria-label="Adjust goals"
        >
          <Settings2 className="h-4 w-4" />
        </button>
      </div>

      {/* Period Goal Progress (Primary Focus) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {periodLabel} Goal
            {plannedDaysInPeriod > 0 && (
              <span className="text-xs ml-1">({plannedDaysInPeriod} days)</span>
            )}
          </span>
          <span className="font-semibold text-foreground">
            {periodProgress.toFixed(1)} / {periodGoal.toFixed(1)} {metricLabel}
          </span>
        </div>
        <Progress value={periodProgressPercent} className="h-2.5" />
        {isPeriodComplete ? (
          // Period is complete - show if goal was hit
          periodProgress >= periodGoal ? (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>{viewMode === "week" ? "Weekly" : "Monthly"} goal hit!</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
              <TrendingUp className="h-3 w-3" />
              <span>Missed by {(periodGoal - periodProgress).toFixed(1)} {metricLabel}</span>
            </div>
          )
        ) : periodGoal > 0 ? (
          // Period in progress - show pace
          <div className="flex items-center gap-1 text-xs">
            {isOnPace ? (
              <span className="text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                On pace! +{paceVariance.toFixed(1)} ahead
              </span>
            ) : (
              <div className="flex flex-col gap-0.5">
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  {Math.abs(paceVariance).toFixed(1)} {metricLabel} behind pace
                </span>
                {remainingDaysInPeriod > 0 && (
                  <span className="text-muted-foreground">
                    {dailyTarget.toFixed(1)}/day → <span className="font-medium text-foreground">{catchUpPerDay.toFixed(1)}</span>/day to catch up
                  </span>
                )}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* End Goal Reminder (Compact) */}
      <div className="pt-2 border-t border-border">
        {isInPreseason ? (
          // Preseason: show preseason goal only
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Preseason Goal
            </span>
            <span className="font-medium text-foreground">
              {currentProgress.toFixed(1)} / {displayPreseasonGoal.toFixed(1)} {metricLabel}
              <span className="text-muted-foreground ml-1">
                ({overallRemaining.toFixed(1)} to go)
              </span>
            </span>
          </div>
        ) : (
          // Summer: show current target tier with mini progress
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {couldDoComplete ? (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 className="h-3 w-3" />
                    All goals achieved!
                  </span>
                ) : (
                  <>Chasing <span className="font-semibold text-foreground">{currentTargetLabel}</span></>
                )}
              </span>
              <span className="font-medium text-foreground">
                {currentProgress.toFixed(1)} / {currentTarget.toFixed(1)} {metricLabel}
              </span>
            </div>
            <Progress value={overallProgressPercent} className="h-1.5" />
            
            {/* Summer Goal Tiers with Weekly Targets */}
            <div className="flex gap-2 pt-1">
              <div className={`flex-1 text-center py-1 px-2 rounded ${mustDoComplete ? 'bg-green-500/10' : 'bg-muted/30'}`}>
                <div className="text-[9px] text-muted-foreground uppercase">Must</div>
                <div className={`text-xs font-bold ${mustDoComplete ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                  {displayMustDo.toFixed(0)}
                </div>
                {!mustDoComplete && (
                  <div className="text-[9px] text-muted-foreground">{weeklyMustDo.toFixed(1)}/wk</div>
                )}
              </div>
              <div className={`flex-1 text-center py-1 px-2 rounded ${willDoComplete ? 'bg-green-500/10' : 'bg-muted/30'}`}>
                <div className="text-[9px] text-muted-foreground uppercase">Will</div>
                <div className={`text-xs font-bold ${willDoComplete ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                  {displayWillDo.toFixed(0)}
                </div>
                {!willDoComplete && (
                  <div className="text-[9px] text-muted-foreground">{weeklyWillDo.toFixed(1)}/wk</div>
                )}
              </div>
              <div className={`flex-1 text-center py-1 px-2 rounded ${couldDoComplete ? 'bg-green-500/10' : 'bg-muted/30'}`}>
                <div className="text-[9px] text-muted-foreground uppercase">Could</div>
                <div className={`text-xs font-bold ${couldDoComplete ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                  {displayCouldDo.toFixed(0)}
                </div>
                {!couldDoComplete && (
                  <div className="text-[9px] text-muted-foreground">{weeklyCouldDo.toFixed(1)}/wk</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};