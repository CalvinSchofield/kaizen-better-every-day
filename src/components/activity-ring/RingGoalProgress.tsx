import { motion } from "framer-motion";
import { Target, TrendingUp, TrendingDown, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatFP } from "@/lib/formatters";

interface RingGoalProgressProps {
  // Preseason mode (show preseason goal only)
  preseasonMode?: boolean;
  preseasonFP?: number;
  preseasonGoal?: number;
  
  // Summer mode (show focus tier goal)
  summerMode?: boolean;
  seasonFP?: number;
  focusTierGoal?: number;
  focusTier?: 'mustDo' | 'willDo' | 'couldDo' | null;
  
  // Today's progress (optional)
  todayFP?: number;
  dailyNeed?: number;
  
  // Week progress (optional)
  weeklyFP?: number;
  weeklyGoal?: number;
  
  // Pace info
  dayOfSeason?: number;
  totalSeasonDays?: number;
  
  // Legacy props for backwards compatibility
  seasonGoal?: number;
  
  className?: string;
}

export const RingGoalProgress = ({
  preseasonMode = false,
  preseasonFP = 0,
  preseasonGoal = 0,
  summerMode = false,
  seasonFP = 0,
  focusTierGoal = 0,
  focusTier = null,
  todayFP = 0,
  dailyNeed = 0,
  weeklyFP = 0,
  weeklyGoal = 0,
  dayOfSeason = 1,
  totalSeasonDays = 53,
  seasonGoal = 0, // Legacy fallback
  className,
}: RingGoalProgressProps) => {
  // Determine which mode we're in and what to display
  const isPreseason = preseasonMode || (!summerMode && preseasonGoal > 0);
  
  // Get the goal values to display
  const displayGoal = isPreseason ? preseasonGoal : (focusTierGoal || seasonGoal);
  const displayProgress = isPreseason ? preseasonFP : seasonFP;
  
  // Calculate progress percentages
  const dailyProgress = dailyNeed > 0 ? Math.min(100, (todayFP / dailyNeed) * 100) : 0;
  const weeklyProgress = weeklyGoal > 0 ? Math.min(100, (weeklyFP / weeklyGoal) * 100) : 0;
  const seasonProgress = displayGoal > 0 ? Math.min(100, (displayProgress / displayGoal) * 100) : 0;
  
  // Expected pace for season
  const expectedFP = displayGoal > 0 && totalSeasonDays > 0
    ? (displayGoal / totalSeasonDays) * dayOfSeason
    : 0;
  const paceDiff = displayProgress - expectedFP;
  const isAhead = paceDiff >= 0;
  
  // Tier display labels
  const tierLabels: Record<string, string> = {
    mustDo: 'Must Do',
    willDo: 'Will Do',
    couldDo: 'Could Do',
  };
  
  const tierLabel = isPreseason 
    ? 'Preseason'
    : (focusTier ? tierLabels[focusTier] || 'Goal' : 'Goal');

  // Daily status
  const dailyHit = dailyNeed > 0 && todayFP >= dailyNeed;
  
  // No goals configured
  const hasNoGoals = !dailyNeed && !weeklyGoal && !displayGoal;
  
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
        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {tierLabel}
        </span>
      </div>

      {/* Today's Progress (optional) */}
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

      {/* Weekly Progress (optional) */}
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

      {/* Season/Preseason Progress */}
      {displayGoal > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {isPreseason ? 'Preseason' : 'Season'}
            </span>
            <span className="font-medium tabular-nums">
              {formatFP(displayProgress)} / {formatFP(displayGoal)}
            </span>
          </div>
          
          {/* Season progress bar with expected marker */}
          <div className="relative">
            <Progress value={seasonProgress} className="h-3" />
            
            {/* Expected pace marker */}
            {expectedFP > 0 && displayGoal > 0 && (
              <div 
                className="absolute top-0 h-3 w-0.5 bg-muted-foreground/50"
                style={{ left: `${Math.min(100, (expectedFP / displayGoal) * 100)}%` }}
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
      {hasNoGoals && (
        <div className="text-center text-sm text-muted-foreground py-2">
          No goals configured
        </div>
      )}
    </motion.div>
  );
};
