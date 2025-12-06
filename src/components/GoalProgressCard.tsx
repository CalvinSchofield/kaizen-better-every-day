import { useMemo } from "react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { Target, Flame, Zap, Trophy } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "@/hooks/useRepData";

// Season boundaries
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

  const personalSummerEnd = seasonConfig?.personal_summer_end || SUMMER_END;

  // Determine if we're in preseason or summer
  const isInPreseason = useMemo(() => {
    const preseasonEndDate = parseLocalDate(PRESEASON_END);
    return today <= preseasonEndDate;
  }, [today]);

  // Calculate period totals (week or month) from entries prop
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
    
    const elapsed = allPlannedInPeriod.filter(d => d.planned_date <= todayStr);
    
    return {
      plannedDaysInPeriod: allPlannedInPeriod.length,
      elapsedPlannedDays: elapsed.length
    };
  }, [plannedDays, currentDate, viewMode, today]);

  // Calculate weeks remaining in each season
  const { weeksRemainingPreseason, weeksRemainingSummer } = useMemo(() => {
    const preseasonEnd = parseLocalDate(PRESEASON_END);
    const summerEnd = parseLocalDate(personalSummerEnd);
    const weekStart = startOfWeek(today);
    
    const preseasonWeeks = Math.max(1, Math.ceil(differenceInDays(preseasonEnd, weekStart) / 7));
    const summerWeeks = Math.max(1, Math.ceil(differenceInDays(summerEnd, weekStart) / 7));
    
    return {
      weeksRemainingPreseason: preseasonWeeks,
      weeksRemainingSummer: summerWeeks
    };
  }, [today, personalSummerEnd]);

  if (!goals || !goals.setup_complete) {
    return null;
  }

  const conversionFactor = (goals.avg_prmr_per_fp || 85) / 85;
  const metricLabel = efpModeEnabled ? "EFP" : "FP+";

  // Current cumulative progress - use preseason hook values directly (no double counting!)
  const currentProgress = efpModeEnabled ? (preseasonEFP || 0) : (preseasonFP || 0);
  
  // Period progress from entries
  const periodProgress = efpModeEnabled ? calculateEfp(periodTotals.prmr) : periodTotals.fpPlus;

  // Goal values
  const preseasonGoal = goals.preseason_fp_goal || 0;
  const displayPreseasonGoal = efpModeEnabled ? preseasonGoal * conversionFactor : preseasonGoal;
  
  const mustDoGoal = goals.must_do_fp_goal || 0;
  const willDoGoal = goals.will_do_fp_goal || 0;
  const couldDoGoal = goals.could_do_fp_goal || 0;
  const displayMustDo = efpModeEnabled ? mustDoGoal * conversionFactor : mustDoGoal;
  const displayWillDo = efpModeEnabled ? willDoGoal * conversionFactor : willDoGoal;
  const displayCouldDo = efpModeEnabled ? couldDoGoal * conversionFactor : couldDoGoal;

  // Calculate FIXED weekly goals
  const remainingPreseasonGoal = Math.max(0, displayPreseasonGoal - currentProgress);
  const weeklyPreseasonGoal = weeksRemainingPreseason > 0 
    ? remainingPreseasonGoal / weeksRemainingPreseason 
    : 0;

  // Summer weekly goals for each tier
  const remainingMustDo = Math.max(0, displayMustDo - currentProgress);
  const remainingWillDo = Math.max(0, displayWillDo - currentProgress);
  const remainingCouldDo = Math.max(0, displayCouldDo - currentProgress);
  
  const weeklyMustDo = weeksRemainingSummer > 0 ? remainingMustDo / weeksRemainingSummer : 0;
  const weeklyWillDo = weeksRemainingSummer > 0 ? remainingWillDo / weeksRemainingSummer : 0;
  const weeklyCouldDo = weeksRemainingSummer > 0 ? remainingCouldDo / weeksRemainingSummer : 0;

  // Current target tier for summer
  const mustDoComplete = currentProgress >= displayMustDo;
  const willDoComplete = currentProgress >= displayWillDo;
  const couldDoComplete = currentProgress >= displayCouldDo;

  let currentWeeklyTarget = weeklyMustDo;
  let currentTargetLabel = "Must Do";
  if (mustDoComplete && !willDoComplete) {
    currentWeeklyTarget = weeklyWillDo;
    currentTargetLabel = "Will Do";
  } else if (willDoComplete && !couldDoComplete) {
    currentWeeklyTarget = weeklyCouldDo;
    currentTargetLabel = "Could Do";
  } else if (couldDoComplete) {
    currentWeeklyTarget = 0;
    currentTargetLabel = "Complete";
  }

  // Period goal (fixed for the week/month)
  const periodGoal = isInPreseason
    ? viewMode === "month" ? weeklyPreseasonGoal * 4 : weeklyPreseasonGoal
    : viewMode === "month" ? currentWeeklyTarget * 4 : currentWeeklyTarget;

  const periodRemaining = Math.max(0, periodGoal - periodProgress);
  const remainingDaysInPeriod = Math.max(0, plannedDaysInPeriod - elapsedPlannedDays);
  const catchUpPerDay = remainingDaysInPeriod > 0 ? periodRemaining / remainingDaysInPeriod : 0;
  const dailyTarget = plannedDaysInPeriod > 0 ? periodGoal / plannedDaysInPeriod : 0;

  // Progress percentage (capped at 100 for display, but can exceed)
  const progressPercent = periodGoal > 0 ? (periodProgress / periodGoal) * 100 : 0;
  const isGoalHit = periodProgress >= periodGoal && periodGoal > 0;
  const isAhead = periodProgress > periodGoal;

  // Overall season progress
  const overallTarget = isInPreseason ? displayPreseasonGoal : displayMustDo;
  const overallProgressPercent = overallTarget > 0 
    ? Math.min((currentProgress / overallTarget) * 100, 100) 
    : 0;

  const periodLabel = viewMode === "month" 
    ? format(currentDate, 'MMMM') 
    : `This Week`;

  return (
    <div 
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-accent/5 border border-border/50 p-5 cursor-pointer group transition-all duration-300 hover:shadow-lg hover:border-primary/20"
      onClick={() => navigate('/goals')}
    >
      {/* Subtle background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/5 rounded-full blur-3xl" />
      
      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-primary/10">
            <Target className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{periodLabel} Goal</h3>
            <p className="text-[11px] text-muted-foreground">
              {isInPreseason ? `${weeksRemainingPreseason} weeks left in preseason` : `Chasing ${currentTargetLabel}`}
            </p>
          </div>
        </div>
        {isGoalHit && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            <Trophy className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Hit!</span>
          </div>
        )}
      </div>

      {/* Main Progress Display */}
      <div className="relative mb-4">
        <div className="flex items-end justify-between mb-2">
          <div>
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {periodProgress.toFixed(1)}
            </span>
            <span className="text-lg text-muted-foreground ml-1">
              / {periodGoal.toFixed(1)}
            </span>
          </div>
          <span className="text-sm font-medium text-muted-foreground mb-1">
            {metricLabel}
          </span>
        </div>
        
        {/* Custom Progress Bar */}
        <div className="relative h-3 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
              isGoalHit 
                ? 'bg-gradient-to-r from-green-500 to-emerald-400' 
                : 'bg-gradient-to-r from-primary to-primary/70'
            }`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
          {/* Animated shimmer on progress */}
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Mission Statement */}
      <div className="relative">
        {isAhead ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <Zap className="h-4 w-4 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">
              <span className="font-semibold">+{(periodProgress - periodGoal).toFixed(1)} ahead!</span>
              {' '}You're crushing it this {viewMode}.
            </p>
          </div>
        ) : periodRemaining > 0 && remainingDaysInPeriod > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/30 border border-border/50">
            <Flame className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{periodRemaining.toFixed(1)} {metricLabel} to go</span>
              {remainingDaysInPeriod === 1 ? (
                <span className="text-muted-foreground"> — hit it today!</span>
              ) : (
                <span className="text-muted-foreground">
                  {' '}· {catchUpPerDay.toFixed(1)}/day
                  {catchUpPerDay > dailyTarget && dailyTarget > 0 && (
                    <span className="text-amber-600 dark:text-amber-400"> (was {dailyTarget.toFixed(1)})</span>
                  )}
                </span>
              )}
            </p>
          </div>
        ) : periodGoal === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
            <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Set up planned days to see your weekly goals
            </p>
          </div>
        ) : null}
      </div>

      {/* Season Goal Footer */}
      <div className="relative mt-4 pt-3 border-t border-border/50">
        {isInPreseason ? (
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Preseason Goal</span>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary/60 rounded-full"
                  style={{ width: `${overallProgressPercent}%` }}
                />
              </div>
              <span className="text-xs font-medium text-foreground">
                {currentProgress.toFixed(1)} / {displayPreseasonGoal.toFixed(0)}
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Must', goal: displayMustDo, weekly: weeklyMustDo, done: mustDoComplete },
              { label: 'Will', goal: displayWillDo, weekly: weeklyWillDo, done: willDoComplete },
              { label: 'Could', goal: displayCouldDo, weekly: weeklyCouldDo, done: couldDoComplete },
            ].map(tier => (
              <div 
                key={tier.label}
                className={`text-center py-2 px-1 rounded-lg transition-colors ${
                  tier.done ? 'bg-green-500/10' : 'bg-muted/30'
                }`}
              >
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{tier.label}</div>
                <div className={`text-sm font-bold ${tier.done ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                  {tier.goal.toFixed(0)}
                </div>
                {!tier.done && (
                  <div className="text-[10px] text-muted-foreground">{tier.weekly.toFixed(1)}/wk</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};