import { useMemo } from "react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { Target, Flame, Zap, Trophy, TrendingDown } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "@/hooks/useRepData";

// Season boundaries
const PRESEASON_END = '2026-04-11';
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

  // Count days in period: WORKED (from entries) + REMAINING PLANNED (future)
  const { daysWorkedInPeriod, totalDaysInPeriod } = useMemo(() => {
    const periodStart = viewMode === "month" 
      ? startOfMonth(currentDate) 
      : startOfWeek(currentDate);
    const periodEnd = viewMode === "month" 
      ? endOfMonth(currentDate) 
      : endOfWeek(currentDate);
    
    const periodStartStr = format(periodStart, 'yyyy-MM-dd');
    const periodEndStr = format(periodEnd, 'yyyy-MM-dd');
    const todayStr = format(today, 'yyyy-MM-dd');
    
    // Count days ACTUALLY worked in this period (knocking days from entries)
    // Knocking day = doors >= 5 AND work_start_time AND work_end_time set
    const workedDays = entries.filter(e => {
      if (e.entry_date < periodStartStr || e.entry_date > periodEndStr) return false;
      return (e.doors_knocked || 0) >= 5 && !!e.work_start_time && !!e.work_end_time;
    }).length;
    
    // Count future planned days (from today forward to end of period)
    const futurePlanned = plannedDays?.filter(d => 
      d.planned_date > todayStr && d.planned_date <= periodEndStr
    ).length || 0;
    
    // Total = worked + future planned
    return {
      daysWorkedInPeriod: workedDays,
      totalDaysInPeriod: workedDays + futurePlanned
    };
  }, [entries, plannedDays, currentDate, viewMode, today]);

  // Calculate total planned days for the season (for ORIGINAL daily goal)
  // Helper function for knocking day check - must match criteria used in daysWorkedInPeriod
  const isKnockingDay = (entry: any): boolean => {
    return (entry.doors_knocked || 0) >= 5 && !!entry.work_start_time && !!entry.work_end_time;
  };

  const { totalSeasonPlannedDays, totalSeasonKnockingDays } = useMemo(() => {
    if (!plannedDays) return { totalSeasonPlannedDays: 0, totalSeasonKnockingDays: 0 };
    
    const seasonEndStr = isInPreseason ? PRESEASON_END : personalSummerEnd;
    const seasonStartStr = isInPreseason ? '2025-09-28' : '2026-04-12';
    
    const totalPlanned = plannedDays.filter(d => 
      d.planned_date >= seasonStartStr && d.planned_date <= seasonEndStr
    ).length;
    
    // Days already worked using SAME knocking day criteria as daysWorkedInPeriod
    // Knocking day = doors >= 5 AND work_start_time AND work_end_time set
    const knockingDays = entries.filter(e => {
      if (!e.is_finalized) return false;
      if (e.entry_date < seasonStartStr || e.entry_date > seasonEndStr) return false;
      return isKnockingDay(e);
    }).length;
    
    return { totalSeasonPlannedDays: totalPlanned, totalSeasonKnockingDays: knockingDays };
  }, [plannedDays, entries, isInPreseason, personalSummerEnd]);

  // Calculate remaining planned days for each season (from TODAY forward)
  const { remainingPreseasonDays, remainingSummerDays } = useMemo(() => {
    if (!plannedDays) return { remainingPreseasonDays: 0, remainingSummerDays: 0 };
    
    const todayStr = format(today, 'yyyy-MM-dd');
    const preseasonEndStr = PRESEASON_END;
    const summerEndStr = personalSummerEnd;
    
    const preseasonDays = plannedDays.filter(d => 
      d.planned_date >= todayStr && d.planned_date <= preseasonEndStr
    ).length;
    
    const summerDays = plannedDays.filter(d => 
      d.planned_date >= todayStr && d.planned_date <= summerEndStr
    ).length;
    
    return {
      remainingPreseasonDays: preseasonDays,
      remainingSummerDays: summerDays
    };
  }, [plannedDays, today, personalSummerEnd]);

  // Check if user has no goals set up - show engaging prompt
  if (!goals || !goals.setup_complete) {
    return (
      <div 
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-card to-accent/10 border border-primary/20 p-5 cursor-pointer group transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:scale-[1.01]"
        onClick={() => navigate('/goals')}
      >
        {/* Animated background elements */}
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary/10 rounded-full blur-2xl animate-pulse" />
        <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-accent/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-primary/15 group-hover:bg-primary/20 transition-colors">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-foreground mb-0.5">
              {isInPreseason ? "Set Your Preseason Goals" : "Set Your Summer Goals"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isInPreseason 
                ? "Plan your path to a strong start before summer"
                : "Define your Must Do, Will Do & Could Do targets"
              }
            </p>
          </div>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <Zap className="h-4 w-4 text-primary" />
          </div>
        </div>
        
        <div className="relative mt-4 pt-3 border-t border-primary/10">
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Flame className="h-4 w-4" />
            <span>Tap to get started →</span>
          </div>
        </div>
      </div>
    );
  }

  const conversionFactor = (goals.avg_prmr_per_fp || 85) / 85;
  const metricLabel = efpModeEnabled ? "EFP" : "FP+";

  // Current cumulative progress - use preseason hook values directly
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

  // ORIGINAL daily goal (fixed, what you committed to at start of season)
  const originalDailyGoal = totalSeasonPlannedDays > 0 
    ? displayPreseasonGoal / totalSeasonPlannedDays 
    : 0;

  // REMAINING daily goal (dynamic, adjusts based on progress)
  const remainingPreseasonGoal = Math.max(0, displayPreseasonGoal - currentProgress);
  const remainingDailyGoal = remainingPreseasonDays > 0 
    ? remainingPreseasonGoal / remainingPreseasonDays 
    : 0;

  // PERIOD EXPECTED: What you SHOULD have done by now in this period
  // Based on ORIGINAL daily goal × days worked so far
  const periodExpected = originalDailyGoal * daysWorkedInPeriod;
  
  // PERIOD GOAL: What you need to do this ENTIRE period (based on remaining pace)
  const periodGoalFromRemaining = remainingDailyGoal * totalDaysInPeriod;

  // Pace difference for the period (actual - expected by now)
  const periodPaceDiff = periodProgress - periodExpected;
  const isOnPaceForPeriod = periodPaceDiff >= 0;

  // Summer goals for each tier - based on remaining planned days
  const remainingMustDo = Math.max(0, displayMustDo - currentProgress);
  const remainingWillDo = Math.max(0, displayWillDo - currentProgress);
  const remainingCouldDo = Math.max(0, displayCouldDo - currentProgress);
  
  const dailyMustDo = remainingSummerDays > 0 ? remainingMustDo / remainingSummerDays : 0;
  const dailyWillDo = remainingSummerDays > 0 ? remainingWillDo / remainingSummerDays : 0;
  const dailyCouldDo = remainingSummerDays > 0 ? remainingCouldDo / remainingSummerDays : 0;
  
  const weeklyMustDo = dailyMustDo * totalDaysInPeriod;
  const weeklyWillDo = dailyWillDo * totalDaysInPeriod;
  const weeklyCouldDo = dailyCouldDo * totalDaysInPeriod;

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

  // Period goal - use remaining pace calculation
  const monthlyMustDo = dailyMustDo * totalDaysInPeriod;
  const monthlyWillDo = dailyWillDo * totalDaysInPeriod;
  const monthlyCouldDo = dailyCouldDo * totalDaysInPeriod;
  
  let currentMonthlyTarget = monthlyMustDo;
  if (mustDoComplete && !willDoComplete) {
    currentMonthlyTarget = monthlyWillDo;
  } else if (willDoComplete && !couldDoComplete) {
    currentMonthlyTarget = monthlyCouldDo;
  } else if (couldDoComplete) {
    currentMonthlyTarget = 0;
  }
  
  const periodGoal = isInPreseason
    ? periodGoalFromRemaining
    : viewMode === "month" ? currentMonthlyTarget : currentWeeklyTarget;

  const periodRemaining = Math.max(0, periodGoal - periodProgress);
  const remainingDaysInPeriod = Math.max(0, totalDaysInPeriod - daysWorkedInPeriod);
  const catchUpPerDay = remainingDaysInPeriod > 0 ? periodRemaining / remainingDaysInPeriod : 0;

  // Progress percentage (capped at 100 for display, but can exceed)
  // Use periodExpected to align with pace calculation (not periodGoal which is catch-up target)
  const progressPercent = periodExpected > 0 ? (periodProgress / periodExpected) * 100 : 0;
  const isGoalHit = periodProgress >= periodExpected && periodExpected > 0;

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
              {daysWorkedInPeriod} of {totalDaysInPeriod} days done
            </p>
          </div>
        </div>
        {/* Show "On Pace" or "Behind" badge based on actual vs expected */}
        {daysWorkedInPeriod > 0 && (
          isOnPaceForPeriod ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
              <Trophy className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">On Pace</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingDown className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">Behind</span>
            </div>
          )
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
              / {periodExpected.toFixed(1)}
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

      {/* Mission Statement - Show pace relative to what you SHOULD have done by now */}
      <div className="relative">
        {isOnPaceForPeriod && periodPaceDiff > 0.1 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <Zap className="h-4 w-4 text-green-500 flex-shrink-0" />
            <p className="text-sm text-green-700 dark:text-green-300">
              <span className="font-semibold">+{periodPaceDiff.toFixed(1)} ahead of pace!</span>
              {' '}Keep it up this {viewMode}.
            </p>
          </div>
        ) : !isOnPaceForPeriod && daysWorkedInPeriod > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <TrendingDown className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <span className="font-semibold">{Math.abs(periodPaceDiff).toFixed(1)} behind pace</span>
              {remainingDaysInPeriod > 0 && (
                <span className="text-muted-foreground">
                  {' '}· Need {catchUpPerDay.toFixed(1)}/day to catch up
                  {catchUpPerDay > originalDailyGoal && originalDailyGoal > 0 && (
                    <span className="text-amber-600 dark:text-amber-400"> (was {originalDailyGoal.toFixed(1)})</span>
                  )}
                </span>
              )}
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