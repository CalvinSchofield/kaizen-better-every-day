import { motion } from "framer-motion";
import { Target, TrendingUp, TrendingDown, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatFP } from "@/lib/formatters";

interface RingGoalProgressProps {
  todayFP?: number;
  dailyNeed?: number;
  weeklyFP?: number;
  weeklyGoal?: number;
  seasonFP?: number;
  seasonGoal?: number;
  focusTier?: 'mustDo' | 'willDo' | 'couldDo' | null;
  dayOfSeason?: number;
  totalSeasonDays?: number;
  className?: string;
}

export const RingGoalProgress = ({
  todayFP = 0,
  dailyNeed = 0,
  weeklyFP = 0,
  weeklyGoal = 0,
  seasonFP = 0,
  seasonGoal = 0,
  focusTier = 'mustDo',
  dayOfSeason = 1,
  totalSeasonDays = 53,
  className,
}: RingGoalProgressProps) => {
  // Calculate progress percentages
  const dailyProgress = dailyNeed > 0 ? Math.min(100, (todayFP / dailyNeed) * 100) : 0;
  const weeklyProgress = weeklyGoal > 0 ? Math.min(100, (weeklyFP / weeklyGoal) * 100) : 0;
  const seasonProgress = seasonGoal > 0 ? Math.min(100, (seasonFP / seasonGoal) * 100) : 0;
  
  // Expected pace for season
  const expectedSeasonFP = seasonGoal > 0 && totalSeasonDays > 0
    ? (seasonGoal / totalSeasonDays) * dayOfSeason
    : 0;
  const paceDiff = seasonFP - expectedSeasonFP;
  const isAhead = paceDiff >= 0;
  
  // Tier display
  const tierLabels: Record<string, string> = {
    mustDo: 'Must Do',
    willDo: 'Will Do',
    couldDo: 'Could Do',
  };
  
  const tierLabel = focusTier ? tierLabels[focusTier] || 'Goal' : 'Goal';

  // Daily status
  const dailyHit = dailyNeed > 0 && todayFP >= dailyNeed;
  
  return (
    <motion.div
      className={cn(
        "mx-4 p-4 rounded-xl bg-muted/30 border border-border/30 space-y-4",
        className
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">Goal Progress</h4>
        </div>
        {focusTier && (
          <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {tierLabel}
          </span>
        )}
      </div>

      {/* Today's Progress */}
      {dailyNeed > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Today</span>
            <div className="flex items-center gap-2">
              <span className={cn(
                "font-medium tabular-nums",
                dailyHit ? "text-primary" : "text-foreground"
              )}>
                {formatFP(todayFP)} / {formatFP(dailyNeed)}
              </span>
              {dailyHit && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <Check className="w-4 h-4 text-primary" />
                </motion.div>
              )}
            </div>
          </div>
          <Progress value={dailyProgress} className="h-2" />
        </div>
      )}

      {/* Weekly Progress */}
      {weeklyGoal > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">This Week</span>
            <span className={cn(
              "font-medium tabular-nums",
              weeklyFP >= weeklyGoal ? "text-primary" : "text-foreground"
            )}>
              {formatFP(weeklyFP)} / {formatFP(weeklyGoal)}
            </span>
          </div>
          <Progress value={weeklyProgress} className="h-2" />
        </div>
      )}

      {/* Season Progress */}
      {seasonGoal > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Season</span>
            <span className="font-medium tabular-nums">
              {formatFP(seasonFP)} / {formatFP(seasonGoal)}
            </span>
          </div>
          
          {/* Season progress bar with expected marker */}
          <div className="relative">
            <Progress value={seasonProgress} className="h-3" />
            
            {/* Expected pace marker */}
            {expectedSeasonFP > 0 && (
              <div 
                className="absolute top-0 h-3 w-0.5 bg-muted-foreground/50"
                style={{ left: `${Math.min(100, (expectedSeasonFP / seasonGoal) * 100)}%` }}
              />
            )}
          </div>
          
          {/* Pace indicator */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Day {dayOfSeason} of {totalSeasonDays}
            </span>
          <div className={cn(
              "flex items-center gap-1",
              isAhead ? "text-primary" : "text-destructive"
            )}>
              {isAhead ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span className="font-medium tabular-nums">
                {isAhead ? '+' : ''}{formatFP(paceDiff)} vs pace
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No goals configured state */}
      {!dailyNeed && !weeklyGoal && !seasonGoal && (
        <div className="text-center text-sm text-muted-foreground py-2">
          No goals configured
        </div>
      )}
    </motion.div>
  );
};
