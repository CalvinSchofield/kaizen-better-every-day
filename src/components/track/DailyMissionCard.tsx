import { Card } from "@/components/ui/card";
import { Target, TrendingUp } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePlannedDays } from "@/hooks/usePlannedDays";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useFocusTier } from "@/hooks/useFocusTier";
import { calculateSalesPace } from "@/utils/salesPaceCalculator";
import { format, startOfWeek, endOfWeek, parseISO } from "date-fns";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

interface DailyMissionCardProps {
  className?: string;
}

export const DailyMissionCard = ({ className }: DailyMissionCardProps) => {
  const navigate = useNavigate();
  const { goals, isLoading: goalsLoading, hasGoalsAccess } = useRepGoals();
  const { plannedDays } = usePlannedDays();
  const { totalFP, totalPRMR, knockingDays } = usePreseasonFP();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { isUserSummerStarted, focusTier, focusTierGoal } = useFocusTier();

  // Calculate pace data
  const paceData = useMemo(() => {
    if (!goals?.setup_complete) return null;

    // Determine which tier to use based on season
    const activeTier = isUserSummerStarted ? focusTier : 'preseason';

    return calculateSalesPace({
      goals,
      plannedDays: plannedDays || [],
      knockingDays,
      currentFpPlus: totalFP,
      currentPrmr: totalPRMR,
      efpModeEnabled,
      calculateEfp,
      activeTier,
    });
  }, [goals, plannedDays, knockingDays, totalFP, totalPRMR, efpModeEnabled, calculateEfp, isUserSummerStarted, focusTier]);

  // Calculate this week's remaining need
  const weeklyData = useMemo(() => {
    if (!paceData) return null;

    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 }); // Saturday

    // Count remaining planned days this week (including today)
    const todayStr = format(today, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');
    
    const remainingDaysThisWeek = plannedDays?.filter(d => {
      return d.planned_date >= todayStr && d.planned_date <= weekEndStr;
    }).length || 0;

    // Calculate what's needed this week to stay on pace
    const weeklyNeeded = paceData.dailyGoal * remainingDaysThisWeek;

    // Get week's progress so far (days already worked this week)
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const daysWorkedThisWeek = plannedDays?.filter(d => {
      return d.planned_date >= weekStartStr && d.planned_date < todayStr;
    }).length || 0;
    
    // Estimate weekly progress (we'd need daily entries to be precise, using pace estimate)
    const estimatedWeeklyProgress = daysWorkedThisWeek * paceData.dailyGoal;

    return {
      weeklyNeeded: Math.round(weeklyNeeded * 10) / 10,
      remainingDaysThisWeek,
      estimatedWeeklyProgress: Math.round(estimatedWeeklyProgress * 10) / 10,
    };
  }, [paceData, plannedDays]);

  // Handle no goals setup
  if (!goalsLoading && (!goals?.setup_complete || !hasGoalsAccess)) {
    return (
      <Card 
        className={`p-4 border-border/50 bg-card/50 ${className}`}
        onClick={() => navigate('/goals')}
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Set Up Your Goals</p>
            <p className="text-xs text-muted-foreground">Tap here to get started</p>
          </div>
        </div>
      </Card>
    );
  }

  if (goalsLoading || !paceData) {
    return (
      <Card className={`p-4 border-border/50 ${className}`}>
        <Skeleton className="h-20 w-full" />
      </Card>
    );
  }

  const dailyGoal = Math.round(paceData.dailyGoal * 10) / 10;
  const unitLabel = efpModeEnabled ? 'EFP' : 'FP+';
  const seasonLabel = isUserSummerStarted 
    ? focusTier === 'mustDo' ? 'Must Do' : focusTier === 'willDo' ? 'Will Do' : 'Could Do'
    : 'Preseason';

  return (
    <Card className={`p-4 border-border/50 overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Today's Mission</span>
      </div>

      {/* Daily goal - Hero display */}
      <div className="text-center mb-4">
        <div className="text-4xl font-bold text-foreground mb-1">
          {dailyGoal} {unitLabel}
        </div>
        <p className="text-sm text-muted-foreground">
          {seasonLabel} pace
        </p>
      </div>

      {/* Weekly context */}
      {weeklyData && weeklyData.remainingDaysThisWeek > 0 && (
        <div className="border-t border-border/30 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This Week</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold text-foreground">
              {weeklyData.weeklyNeeded} {unitLabel}
            </span>
            <span className="text-sm text-muted-foreground">
              over {weeklyData.remainingDaysThisWeek} day{weeklyData.remainingDaysThisWeek !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
