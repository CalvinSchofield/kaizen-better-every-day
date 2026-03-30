import { TrendingUp, TrendingDown, Target, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";

interface PostBlitzGoalProgressProps {
  recruitName: string;
  currentEFP: number;
  preseasonGoal: number | null;
  personalSummerStart: string | null;
  onSetGoal?: () => void;
}

export const PostBlitzGoalProgress = ({
  recruitName,
  currentEFP,
  preseasonGoal,
  personalSummerStart,
  onSetGoal
}: PostBlitzGoalProgressProps) => {
  const firstName = recruitName.split(' ')[0];
  
  // If no goal set, show CTA to set one
  if (!preseasonGoal || preseasonGoal <= 0) {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">No Preseason Goal Set</p>
              <p className="text-xs text-muted-foreground">
                Help {firstName} set a goal
              </p>
            </div>
          </div>
          {onSetGoal && (
            <Button size="sm" variant="outline" onClick={onSetGoal}>
              Set Goal
            </Button>
          )}
        </div>
      </div>
    );
  }
  
  // Calculate progress
  const progressPercent = Math.min((currentEFP / preseasonGoal) * 100, 100);
  const isGoalMet = currentEFP >= preseasonGoal;
  
  // Calculate pace (simple calculation based on days into preseason)
  const preseasonStart = parseISO('2025-09-28'); // Fixed preseason start
  const preseasonEnd = parseISO('2026-04-12'); // Fixed preseason end
  const today = new Date();
  
  const totalPreseasonDays = differenceInDays(preseasonEnd, preseasonStart);
  const daysElapsed = Math.max(0, differenceInDays(today, preseasonStart));
  const daysRemaining = Math.max(0, differenceInDays(preseasonEnd, today));
  
  // Expected progress based on linear pace
  const expectedProgress = totalPreseasonDays > 0 
    ? (daysElapsed / totalPreseasonDays) * preseasonGoal 
    : 0;
  
  const isAhead = currentEFP >= expectedProgress;
  const paceVariance = currentEFP - expectedProgress;
  
  // Calculate needed daily average to hit goal
  const remainingNeeded = Math.max(0, preseasonGoal - currentEFP);
  const neededDailyAvg = daysRemaining > 0 ? remainingNeeded / daysRemaining : 0;
  
  // Project final based on current pace
  const currentDailyAvg = daysElapsed > 0 ? currentEFP / daysElapsed : 0;
  const projectedFinal = currentDailyAvg * totalPreseasonDays;
  
  return (
    <div className={cn(
      "rounded-xl border p-4 space-y-3",
      isGoalMet 
        ? "bg-emerald-500/10 border-emerald-500/30" 
        : isAhead 
          ? "bg-primary/5 border-primary/20" 
          : "bg-amber-500/10 border-amber-500/30"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className={cn(
            "h-4 w-4",
            isGoalMet ? "text-emerald-600" : isAhead ? "text-primary" : "text-amber-600"
          )} />
          <span className="font-medium text-sm">Preseason Goal Progress</span>
        </div>
        {isGoalMet ? (
          <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-400">
            Goal Met! 🎉
          </Badge>
        ) : isAhead ? (
          <Badge variant="secondary" className="bg-primary/20 text-primary">
            On Pace
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
            Behind Pace
          </Badge>
        )}
      </div>
      
      {/* Progress Display */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold">{currentEFP.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">
            / {preseasonGoal} EFP
          </span>
        </div>
        <Progress 
          value={progressPercent} 
          className={cn(
            "h-2",
            isGoalMet && "[&>div]:bg-emerald-500"
          )}
        />
        <p className="text-xs text-muted-foreground">
          {progressPercent.toFixed(0)}% complete
        </p>
      </div>
      
      {/* Pace Info */}
      {!isGoalMet && daysRemaining > 0 && (
        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs">
            {isAhead ? (
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
            )}
            <span className="text-muted-foreground">
              {isAhead ? '+' : ''}{paceVariance.toFixed(1)} vs expected
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {daysRemaining} days left
          </div>
        </div>
      )}
      
      {/* Projection */}
      {!isGoalMet && daysElapsed > 5 && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          <span>
            On pace for {projectedFinal.toFixed(1)} EFP
            {neededDailyAvg > 0 && ` · Need ${neededDailyAvg.toFixed(2)}/day`}
          </span>
        </div>
      )}
    </div>
  );
};
