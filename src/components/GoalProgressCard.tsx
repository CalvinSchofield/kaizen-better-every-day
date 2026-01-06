import { useMemo } from "react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { useFocusTier, FocusTier } from "@/hooks/useFocusTier";
import { usePersonalBenchmarks } from "@/hooks/usePersonalBenchmarks";
import { Target, Flame, Zap, Trophy, TrendingDown, Lightbulb, TrendingUp, Heart } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "@/hooks/useRepData";
import { getLearningCurvePrincipleMessage, calculatePaceContext, calculateSuggestedStretchGoal } from "@/utils/learningCurveData";

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
  const todayStr = format(today, 'yyyy-MM-dd');

  // Find the latest finalized entry date - this is the "through date" for pace calculations
  // Finalization signals day complete, not the calendar date
  const latestFinalizedDate = useMemo(() => {
    const finalizedEntries = entries.filter(e => e.is_finalized);
    if (finalizedEntries.length === 0) return null;
    
    const sortedEntries = [...finalizedEntries].sort((a, b) => 
      new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()
    );
    return sortedEntries[0].entry_date as string;
  }, [entries]);

  // The "through date" for calculations - use latest finalized entry or null if none
  const throughDate = latestFinalizedDate ? parseLocalDate(latestFinalizedDate) : null;
  const throughDateStr = latestFinalizedDate || '';

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

  const personalSummerStart = seasonConfig?.personal_summer_start;
  const personalSummerEnd = seasonConfig?.personal_summer_end || SUMMER_END;

  // Determine if TODAY is in preseason (for current status)
  const isTodayInPreseason = useMemo(() => {
    if (personalSummerStart) {
      const summerStart = parseISO(personalSummerStart);
      return today < summerStart;
    }
    const preseasonEndDate = parseLocalDate(PRESEASON_END);
    return today <= preseasonEndDate;
  }, [today, personalSummerStart]);

  // Determine if the VIEWED DATE (currentDate) is in preseason
  // This is used for showing the correct goal type for the viewed period
  const isViewedDateInPreseason = useMemo(() => {
    const viewedDate = viewMode === "month" ? startOfMonth(currentDate) : startOfWeek(currentDate);
    if (personalSummerStart) {
      const summerStart = parseISO(personalSummerStart);
      return viewedDate < summerStart;
    }
    const preseasonEndDate = parseLocalDate(PRESEASON_END);
    return viewedDate <= preseasonEndDate;
  }, [currentDate, viewMode, personalSummerStart]);

  // Use viewed date for display logic, today for actual pace calculations
  const isInPreseason = isViewedDateInPreseason;

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

  // Count days in period: WORKED (finalized entries) + REMAINING PLANNED (after latest finalized, not yet worked)
  // IMPORTANT: Use finalization as the trigger for "day complete", not calendar date
  const { daysWorkedInPeriod, totalDaysInPeriod } = useMemo(() => {
    const periodStart = viewMode === "month" 
      ? startOfMonth(currentDate) 
      : startOfWeek(currentDate);
    const periodEnd = viewMode === "month" 
      ? endOfMonth(currentDate) 
      : endOfWeek(currentDate);
    
    const periodStartStr = format(periodStart, 'yyyy-MM-dd');
    const periodEndStr = format(periodEnd, 'yyyy-MM-dd');
    
    // Count days ACTUALLY worked in this period (finalized knocking days from entries)
    // Knocking day = doors >= 4 AND work_start_time AND work_end_time set AND is_finalized
    const workedDays = entries.filter(e => {
      if (e.entry_date < periodStartStr || e.entry_date > periodEndStr) return false;
      if (!e.is_finalized) return false; // Only count finalized entries as "worked"
      return (e.doors_knocked || 0) >= 4 && !!e.work_start_time && !!e.work_end_time;
    }).length;
    
    // Get dates that have finalized entries (as a set for quick lookup)
    const workedDatesSet = new Set(
      entries.filter(e => e.is_finalized && (e.doors_knocked || 0) >= 4 && !!e.work_start_time && !!e.work_end_time)
        .map(e => e.entry_date)
    );
    
    // Count planned days AFTER latest finalized date that haven't been worked yet
    // The cutoff is the latest finalized date, not today - finalization signals day complete
    const cutoffStr = throughDateStr || todayStr;
    const remainingPlanned = plannedDays?.filter(d => 
      d.planned_date > cutoffStr && 
      d.planned_date <= periodEndStr &&
      !workedDatesSet.has(d.planned_date)
    ).length || 0;
    
    // Also include today if it's in the period, after cutoff, planned, and not yet worked
    const includesToday = todayStr >= periodStartStr && todayStr <= periodEndStr && 
      todayStr > cutoffStr && 
      plannedDays?.some(d => d.planned_date === todayStr) &&
      !workedDatesSet.has(todayStr);
    
    // Total = worked + remaining planned
    return {
      daysWorkedInPeriod: workedDays,
      totalDaysInPeriod: workedDays + remainingPlanned + (includesToday ? 1 : 0)
    };
  }, [entries, plannedDays, currentDate, viewMode, throughDateStr, todayStr]);

  // Helper function for knocking day check - must match criteria used in daysWorkedInPeriod
  const isKnockingDay = (entry: any): boolean => {
    return (entry.doors_knocked || 0) >= 4 && !!entry.work_start_time && !!entry.work_end_time;
  };

  // FIXED PACE CALCULATION
  // Total knocking days for the ENTIRE season: already worked (finalized) + future planned
  // When viewing summer dates (isInPreseason = false), calculate summer knocking days
  // When viewing preseason dates, calculate preseason knocking days
  // IMPORTANT: Use finalization as trigger for "day complete", not calendar date
  const { totalSeasonKnockingDays, futureSeasonPlannedDays, seasonKnockingDaysComplete } = useMemo(() => {
    if (!plannedDays) return { totalSeasonKnockingDays: 0, futureSeasonPlannedDays: 0, seasonKnockingDaysComplete: 0 };
    
    // Determine season boundaries based on viewed date context
    const seasonEndStr = isInPreseason ? PRESEASON_END : personalSummerEnd;
    const seasonStartStr = isInPreseason ? '2025-09-28' : (personalSummerStart || '2026-04-12');
    
    // Use latest finalized date as cutoff, not today
    const cutoffStr = throughDateStr || todayStr;
    
    // For summer view during preseason, we need to count planned summer days (not completed days)
    // because summer hasn't started yet
    const isTodayBeforeSeason = todayStr < seasonStartStr;
    
    if (isTodayBeforeSeason && !isInPreseason) {
      // Viewing summer dates but today is before summer starts
      // Count all planned summer days
      const summerPlannedDays = plannedDays.filter(d => 
        d.planned_date >= seasonStartStr && d.planned_date <= seasonEndStr
      ).length;
      
      return { 
        totalSeasonKnockingDays: summerPlannedDays, 
        futureSeasonPlannedDays: summerPlannedDays,
        seasonKnockingDaysComplete: 0 
      };
    }
    
    // Normal case: within the season being viewed
    // Knocking days already completed in the season (must be finalized)
    const knockingDaysComplete = entries.filter(e => {
      if (!e.is_finalized) return false;
      if (e.entry_date < seasonStartStr || e.entry_date > seasonEndStr) return false;
      return isKnockingDay(e);
    }).length;
    
    // Future planned days (AFTER latest finalized date to season end)
    // If today hasn't been finalized yet, include today and onwards
    const futurePlanned = plannedDays.filter(d => 
      d.planned_date > cutoffStr && d.planned_date <= seasonEndStr
    ).length;
    
    // Also count today if it's after cutoff and planned
    const includesTodayInFuture = todayStr > cutoffStr && 
      todayStr <= seasonEndStr &&
      plannedDays.some(d => d.planned_date === todayStr);
    
    // Total = completed + future planned
    const total = knockingDaysComplete + futurePlanned + (includesTodayInFuture ? 1 : 0);
    
    return { 
      totalSeasonKnockingDays: total, 
      futureSeasonPlannedDays: futurePlanned + (includesTodayInFuture ? 1 : 0),
      seasonKnockingDaysComplete: knockingDaysComplete 
    };
  }, [plannedDays, entries, isInPreseason, personalSummerEnd, personalSummerStart, throughDateStr, todayStr]);

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
  
  // Get focus tier for summer goal selection
  const { focusTier, setFocusTier, fundedFocusTierGoal, allTiers } = useFocusTier(currentProgress);
  
  // Personal benchmarks for pace messaging
  const benchmarksQuery = usePersonalBenchmarks({
    userId: repData?.user_id,
    personalSummerStart: personalSummerStart,
    personalSummerEnd: personalSummerEnd,
    efpModeEnabled,
    calculateEfp,
    currentProgress,
    futurePlannedDays: plannedDays?.length || 0,
    fundedGoal: fundedFocusTierGoal,
  });
  
  const benchmarks = benchmarksQuery.data || {
    bestDay: 0,
    currentAverage: 0,
    knockingDaysCompleted: 0,
    weekInSummer: 0,
    hasEnoughData: false,
    projectedFinal: 0,
    canAddMoreDays: false,
    availableDaysToAdd: 0,
  };
  
  // Tier selector handler - stops propagation to prevent navigating to goals page
  const handleTierChange = async (tier: FocusTier, e: React.MouseEvent) => {
    e.stopPropagation();
    await setFocusTier(tier);
  };
  
  // Tier display labels
  const tierLabels: Record<FocusTier, string> = {
    mustDo: 'Must Do',
    willDo: 'Will Do',
    couldDo: 'Could Do',
  };
  
  const isRookie = repData?.year === "Rookie";
  
  // Period progress from entries
  const periodProgress = efpModeEnabled ? calculateEfp(periodTotals.prmr) : periodTotals.fpPlus;

  // Goal values with cancel rate buffer applied (matches salesPaceCalculator)
  const cancelRate = goals.cancel_rate || 0;
  const preseasonGoal = goals.preseason_fp_goal || 0;
  const fundedPreseasonGoal = cancelRate > 0 && cancelRate < 1 
    ? preseasonGoal / (1 - cancelRate) 
    : preseasonGoal;
  const displayPreseasonGoal = efpModeEnabled ? fundedPreseasonGoal * conversionFactor : fundedPreseasonGoal;
  
  const mustDoGoal = goals.must_do_fp_goal || 0;
  const willDoGoal = goals.will_do_fp_goal || 0;
  const couldDoGoal = goals.could_do_fp_goal || 0;
  const fundedMustDo = cancelRate > 0 && cancelRate < 1 ? mustDoGoal / (1 - cancelRate) : mustDoGoal;
  const fundedWillDo = cancelRate > 0 && cancelRate < 1 ? willDoGoal / (1 - cancelRate) : willDoGoal;
  const fundedCouldDo = cancelRate > 0 && cancelRate < 1 ? couldDoGoal / (1 - cancelRate) : couldDoGoal;
  const displayMustDo = efpModeEnabled ? fundedMustDo * conversionFactor : fundedMustDo;
  const displayWillDo = efpModeEnabled ? fundedWillDo * conversionFactor : fundedWillDo;
  const displayCouldDo = efpModeEnabled ? fundedCouldDo * conversionFactor : fundedCouldDo;

  // ==========================================
  // FIXED DAILY PACE (never changes)
  // PRESEASON: Funded preseason goal / preseason knocking days
  // SUMMER: (Funded tier goal - projected preseason total) / summer knocking days
  // This matches Goals page calculation exactly
  // ==========================================
  const fixedDailyGoal = useMemo(() => {
    if (totalSeasonKnockingDays <= 0) return 0;
    
    if (isInPreseason) {
      // During preseason viewing preseason dates: simple division
      return displayPreseasonGoal / totalSeasonKnockingDays;
    } else {
      // Viewing summer dates: subtract projected preseason progress first
      // Use fundedFocusTierGoal (which is already the summer tier goal with buffer)
      // Subtract what we're projected to hit in preseason based on current pace
      const preseasonGoalForCalc = displayPreseasonGoal;
      const preseasonDaysComplete = entries.filter(e => {
        if (!e.is_finalized) return false;
        if (e.entry_date > PRESEASON_END) return false;
        return (e.doors_knocked || 0) >= 4 && !!e.work_start_time && !!e.work_end_time;
      }).length;
      
      // Project preseason total based on current pace if still in preseason
      const todayStr = format(today, 'yyyy-MM-dd');
      const stillInPreseason = todayStr <= PRESEASON_END;
      
      let projectedPreseasonTotal = currentProgress;
      if (stillInPreseason && preseasonDaysComplete > 0 && displayPreseasonGoal > 0) {
        // Calculate pace and project
        const pacePerDay = currentProgress / preseasonDaysComplete;
        // Get remaining preseason planned days
        const remainingPreseasonPlanned = plannedDays?.filter(d => 
          d.planned_date > todayStr && d.planned_date <= PRESEASON_END
        ).length || 0;
        projectedPreseasonTotal = currentProgress + (pacePerDay * remainingPreseasonPlanned);
      }
      
      // Summer daily = (Summer goal - projected preseason) / summer knocking days
      const remainingForSummer = Math.max(0, fundedFocusTierGoal - projectedPreseasonTotal);
      return remainingForSummer / totalSeasonKnockingDays;
    }
  }, [isInPreseason, displayPreseasonGoal, totalSeasonKnockingDays, fundedFocusTierGoal, currentProgress, entries, today, plannedDays]);

  // ==========================================
  // PERIOD GOAL: What you should hit this entire week/month
  // Formula: Fixed daily goal × total days in this period
  // ==========================================
  const periodGoal = fixedDailyGoal * totalDaysInPeriod;
  
  // EXPECTED BY NOW: Fixed daily goal × days worked so far THIS PERIOD
  const periodExpected = fixedDailyGoal * daysWorkedInPeriod;
  
  // EXPECTED BY NOW for ENTIRE SEASON: Fixed daily goal × total days worked in season
  const seasonExpected = fixedDailyGoal * seasonKnockingDaysComplete;

  // Pace difference (actual - expected by now)
  const periodPaceDiff = periodProgress - periodExpected;
  const isOnPaceForPeriod = periodPaceDiff >= 0;
  
  const seasonPaceDiff = currentProgress - seasonExpected;
  const isOnPaceForSeason = seasonPaceDiff >= 0;

  // ==========================================
  // REMAINING THIS PERIOD: What's left to hit period goal
  // ==========================================
  const remainingForPeriod = Math.max(0, periodGoal - periodProgress);
  const remainingDaysInPeriod = Math.max(0, totalDaysInPeriod - daysWorkedInPeriod);
  
  // Daily rate needed to hit THIS PERIOD's goal (matches calendar daily goal)
  // Use fixed daily goal - this is consistent with what's shown on calendar

  // Summer tier tracking
  const mustDoComplete = currentProgress >= displayMustDo;
  const willDoComplete = currentProgress >= displayWillDo;
  const couldDoComplete = currentProgress >= displayCouldDo;

  // Summer tier daily rates (fixed, based on total season days)
  const dailyMustDo = totalSeasonKnockingDays > 0 ? displayMustDo / totalSeasonKnockingDays : 0;
  const dailyWillDo = totalSeasonKnockingDays > 0 ? displayWillDo / totalSeasonKnockingDays : 0;
  const dailyCouldDo = totalSeasonKnockingDays > 0 ? displayCouldDo / totalSeasonKnockingDays : 0;
  
  const weeklyMustDo = dailyMustDo * totalDaysInPeriod;
  const weeklyWillDo = dailyWillDo * totalDaysInPeriod;
  const weeklyCouldDo = dailyCouldDo * totalDaysInPeriod;

  // Progress percentage - use periodGoal (what you should hit this period total)
  const progressPercent = periodGoal > 0 ? (periodProgress / periodGoal) * 100 : 0;
  const isGoalHit = periodProgress >= periodGoal && periodGoal > 0;

  // Overall season progress - use focus tier goal for summer
  const overallTarget = isInPreseason ? displayPreseasonGoal : fundedFocusTierGoal;
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

      {/* Focus Tier Selector - Only show in summer mode */}
      {!isInPreseason && (
        <div className="relative flex items-center gap-1.5 mb-4 p-1 rounded-xl bg-muted/50">
          {(['mustDo', 'willDo', 'couldDo'] as FocusTier[]).map((tier) => (
            <button
              key={tier}
              onClick={(e) => handleTierChange(tier, e)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                focusTier === tier
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {tierLabels[tier]}
            </button>
          ))}
        </div>
      )}

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
        
        {/* Expected by now indicator */}
        {daysWorkedInPeriod > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            Expected by now: <span className="font-medium text-foreground">{periodExpected.toFixed(1)}</span>
          </div>
        )}
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
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <TrendingDown className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <span className="font-semibold">{Math.abs(periodPaceDiff).toFixed(1)} behind pace</span>
                {remainingDaysInPeriod > 0 && fixedDailyGoal > 0 && (
                  <span className="text-muted-foreground">
                    {' '}· Need {fixedDailyGoal.toFixed(1)}/day to catch up
                  </span>
                )}
              </p>
            </div>
            {/* Purpose reminder when behind */}
            {goals.purpose_statement && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <Heart className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                  Remember: "{goals.purpose_statement.length > 80 
                    ? goals.purpose_statement.substring(0, 80) + '...' 
                    : goals.purpose_statement}"
                </p>
              </div>
            )}
          </div>
        ) : remainingForPeriod > 0 && remainingDaysInPeriod > 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-accent/30 border border-border/50">
            <Flame className="h-4 w-4 text-primary flex-shrink-0" />
            <p className="text-sm text-foreground">
              <span className="font-semibold">{remainingForPeriod.toFixed(1)} {metricLabel} to go this {viewMode}</span>
              {remainingDaysInPeriod === 1 ? (
                <span className="text-muted-foreground"> — hit it today!</span>
              ) : (
                <span className="text-muted-foreground">
                  {' '}· {fixedDailyGoal.toFixed(1)}/day to stay on track
                </span>
              )}
            </p>
          </div>
        ) : totalSeasonKnockingDays === 0 ? (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
            <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Set up planned days to see your weekly goals
            </p>
          </div>
        ) : null}
        
        {/* Learning Curve Principle Message - Show for early season or rookies */}
        {(() => {
          const paceContext = !benchmarks.hasEnoughData ? 'insufficient-data' : 
            calculatePaceContext(benchmarks.knockingDaysCompleted, fixedDailyGoal, benchmarks.currentAverage, benchmarks.weekInSummer, isRookie);
          const learningCurveMessage = getLearningCurvePrincipleMessage(benchmarks.weekInSummer, isRookie, paceContext);
          const suggestedStretch = calculateSuggestedStretchGoal(benchmarks.projectedFinal, fundedFocusTierGoal, benchmarks.hasEnoughData);
          
          return (
            <>
              {learningCurveMessage && (paceContext === 'insufficient-data' || paceContext === 'early-season' || (isRookie && benchmarks.weekInSummer <= 12)) && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {learningCurveMessage}
                  </p>
                </div>
              )}
              
              {/* Stretch Goal Suggestion - Show when ahead of Could Do */}
              {suggestedStretch && paceContext === 'on-track' && !isInPreseason && (
                <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
                  <TrendingUp className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-green-700 dark:text-green-300">
                    <span className="font-semibold">You're crushing it!</span> Consider stretching your Could Do to {suggestedStretch.toFixed(0)} to maximize your summer.
                  </p>
                </div>
              )}
            </>
          );
        })()}
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