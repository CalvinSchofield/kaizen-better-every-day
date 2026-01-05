import { cn } from "@/lib/utils";
import { Target, TrendingUp, TrendingDown, Minus, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GoalTier {
  label: string;
  goal: number;
  current: number;
  pacePercent: number;
  isFocused?: boolean;
}

interface RepGoalPaceCardProps {
  preseasonGoal?: number;
  preseasonProgress?: number;
  mustGoal?: number;
  willGoal?: number;
  couldGoal?: number;
  currentFP: number;
  focusTier?: string | null;
  className?: string;
}

export const RepGoalPaceCard = ({
  preseasonGoal,
  preseasonProgress = 0,
  mustGoal,
  willGoal,
  couldGoal,
  currentFP,
  focusTier,
  className,
}: RepGoalPaceCardProps) => {
  // Calculate pace for each tier
  const calculatePace = (goal: number | undefined, current: number): number => {
    if (!goal || goal === 0) return 0;
    return (current / goal) * 100;
  };

  const tiers: GoalTier[] = [];

  // Add preseason goal if exists
  if (preseasonGoal && preseasonGoal > 0) {
    tiers.push({
      label: 'Preseason',
      goal: preseasonGoal,
      current: preseasonProgress,
      pacePercent: calculatePace(preseasonGoal, preseasonProgress),
    });
  }

  // Add summer goals
  if (mustGoal && mustGoal > 0) {
    tiers.push({
      label: 'Must Do',
      goal: mustGoal,
      current: currentFP,
      pacePercent: calculatePace(mustGoal, currentFP),
      isFocused: focusTier === 'mustDo',
    });
  }
  if (willGoal && willGoal > 0) {
    tiers.push({
      label: 'Will Do',
      goal: willGoal,
      current: currentFP,
      pacePercent: calculatePace(willGoal, currentFP),
      isFocused: focusTier === 'willDo',
    });
  }
  if (couldGoal && couldGoal > 0) {
    tiers.push({
      label: 'Could Do',
      goal: couldGoal,
      current: currentFP,
      pacePercent: calculatePace(couldGoal, currentFP),
      isFocused: focusTier === 'couldDo',
    });
  }

  if (tiers.length === 0) {
    return (
      <div className={cn("p-3 rounded-lg bg-muted/50 text-center", className)}>
        <p className="text-xs text-muted-foreground">No goals configured</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-muted-foreground" />
        <h4 className="text-sm font-medium">Goal Progress</h4>
      </div>

      <div className="space-y-2">
        {tiers.map((tier) => (
          <GoalTierRow key={tier.label} tier={tier} />
        ))}
      </div>
    </div>
  );
};

const GoalTierRow = ({ tier }: { tier: GoalTier }) => {
  const { label, goal, current, pacePercent, isFocused } = tier;
  
  // Determine status
  const isComplete = current >= goal;
  const isOnPace = pacePercent >= 85;
  const isAtRisk = pacePercent < 70;
  
  // Get status icon and color
  const getStatusIcon = () => {
    if (isComplete) return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (isOnPace) return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
    if (isAtRisk) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    return <Minus className="w-3.5 h-3.5 text-yellow-500" />;
  };

  const getProgressColor = () => {
    if (isComplete) return "bg-green-500";
    if (isOnPace) return "bg-green-500";
    if (isAtRisk) return "bg-red-500";
    return "bg-yellow-500";
  };

  return (
    <div className={cn(
      "p-2.5 rounded-lg transition-colors",
      isFocused ? "bg-primary/10 border border-primary/20" : "bg-muted/50"
    )}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          {isFocused && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 border-primary/30">
              Focus
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {getStatusIcon()}
          <span className={cn(
            "text-xs font-medium tabular-nums",
            isComplete && "text-green-600",
            isOnPace && !isComplete && "text-green-600",
            isAtRisk && "text-red-600",
            !isOnPace && !isAtRisk && !isComplete && "text-yellow-600"
          )}>
            {pacePercent.toFixed(0)}%
          </span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300 rounded-full", getProgressColor())}
          style={{ width: `${Math.min(100, pacePercent)}%` }}
        />
      </div>
      
      {/* Progress text */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {current.toFixed(1)} / {goal.toFixed(0)} FP+
        </span>
        <span className="text-[10px] text-muted-foreground">
          {isComplete ? '✓ Complete' : `${(goal - current).toFixed(1)} to go`}
        </span>
      </div>
    </div>
  );
};
