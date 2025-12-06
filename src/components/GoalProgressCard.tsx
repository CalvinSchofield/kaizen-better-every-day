import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { Target, TrendingUp, CheckCircle2 } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from "date-fns";

interface GoalProgressCardProps {
  entries: any[];
  currentDate: Date;
  viewMode: "week" | "month";
}

export const GoalProgressCard = ({ entries, currentDate, viewMode }: GoalProgressCardProps) => {
  const { goals } = useRepGoals();
  const { totalFP: preseasonFP, totalEFP: preseasonEFP, fundedFP, fundedEFP } = usePreseasonFP();
  const { efpModeEnabled, calculateEfp } = useEfpMode();

  // Calculate period totals
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

  // Get current cumulative totals (all finalized entries)
  const cumulativeTotals = useMemo(() => {
    return entries.reduce((totals, entry) => {
      if (entry.is_finalized) {
        totals.fpPlus += entry.fp_plus || 0;
        totals.prmr += entry.prmr || 0;
      }
      return totals;
    }, { fpPlus: preseasonFP || 0, prmr: 0 });
  }, [entries, preseasonFP]);

  // Add preseason EFP for EFP mode
  const cumulativeEFP = calculateEfp(cumulativeTotals.prmr) + (preseasonEFP || 0);
  const cumulativeFPPlus = cumulativeTotals.fpPlus;

  if (!goals || !goals.setup_complete) {
    return null;
  }

  // Determine which goals to show based on progress
  const mustDoGoal = goals.must_do_fp_goal || 0;
  const willDoGoal = goals.will_do_fp_goal || 0;
  const couldDoGoal = goals.could_do_fp_goal || 0;

  // Convert goals to EFP if needed
  const conversionFactor = (goals.avg_prmr_per_fp || 85) / 85;
  const displayMustDo = efpModeEnabled ? mustDoGoal * conversionFactor : mustDoGoal;
  const displayWillDo = efpModeEnabled ? willDoGoal * conversionFactor : willDoGoal;
  const displayCouldDo = efpModeEnabled ? couldDoGoal * conversionFactor : couldDoGoal;

  const currentProgress = efpModeEnabled ? cumulativeEFP : cumulativeFPPlus;
  const periodProgress = efpModeEnabled ? calculateEfp(periodTotals.prmr) : periodTotals.fpPlus;
  const metricLabel = efpModeEnabled ? "EFP" : "FP+";

  // Determine current target (first incomplete goal)
  const mustDoComplete = currentProgress >= displayMustDo;
  const willDoComplete = currentProgress >= displayWillDo;
  const couldDoComplete = currentProgress >= displayCouldDo;

  let currentTarget = displayMustDo;
  let currentTargetLabel = "Must Do";
  if (mustDoComplete && !willDoComplete) {
    currentTarget = displayWillDo;
    currentTargetLabel = "Will Do";
  } else if (willDoComplete && !couldDoComplete) {
    currentTarget = displayCouldDo;
    currentTargetLabel = "Could Do";
  } else if (couldDoComplete) {
    currentTarget = displayCouldDo;
    currentTargetLabel = "Could Do";
  }

  const progressPercent = currentTarget > 0 ? Math.min((currentProgress / currentTarget) * 100, 100) : 0;
  const remaining = Math.max(0, currentTarget - currentProgress);

  return (
    <div className="rounded-lg bg-card border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Goal Progress</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {viewMode === "month" ? format(currentDate, 'MMMM') : "This Week"}: +{periodProgress.toFixed(1)} {metricLabel}
        </span>
      </div>

      {/* Current Target Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {couldDoComplete ? (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                All goals achieved!
              </span>
            ) : (
              <>Chasing <span className="font-semibold text-foreground">{currentTargetLabel}</span></>
            )}
          </span>
          <span className="font-semibold text-foreground">
            {currentProgress.toFixed(1)} / {currentTarget.toFixed(1)} {metricLabel}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {!couldDoComplete && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>{remaining.toFixed(1)} {metricLabel} to go</span>
          </div>
        )}
      </div>

      {/* Goal Tiers Mini Display */}
      <div className="flex gap-3 pt-2 border-t border-border">
        <div className={`flex-1 text-center p-2 rounded-md ${mustDoComplete ? 'bg-green-500/10' : 'bg-muted/30'}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Must Do</div>
          <div className={`text-sm font-bold ${mustDoComplete ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
            {mustDoComplete && <CheckCircle2 className="h-3 w-3 inline mr-0.5" />}
            {displayMustDo.toFixed(1)}
          </div>
        </div>
        <div className={`flex-1 text-center p-2 rounded-md ${willDoComplete ? 'bg-green-500/10' : 'bg-muted/30'}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Will Do</div>
          <div className={`text-sm font-bold ${willDoComplete ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
            {willDoComplete && <CheckCircle2 className="h-3 w-3 inline mr-0.5" />}
            {displayWillDo.toFixed(1)}
          </div>
        </div>
        <div className={`flex-1 text-center p-2 rounded-md ${couldDoComplete ? 'bg-green-500/10' : 'bg-muted/30'}`}>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Could Do</div>
          <div className={`text-sm font-bold ${couldDoComplete ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
            {couldDoComplete && <CheckCircle2 className="h-3 w-3 inline mr-0.5" />}
            {displayCouldDo.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};
