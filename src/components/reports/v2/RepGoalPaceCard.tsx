import { cn } from "@/lib/utils";
import { Target, TrendingUp, TrendingDown, Minus, CheckCircle2, Calendar, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GoalPaceInfo {
  daysElapsed: number;
  totalPlannedDays: number;
  expectedAtThisPoint: number;
  pacePercent: number;
  status: 'on_pace' | 'at_risk' | 'behind';
}

interface GoalTier {
  label: string;
  goal: number;
  current: number;
  paceInfo?: GoalPaceInfo;
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
  // Time-aware pace info
  goalPace?: {
    preseason?: GoalPaceInfo;
    mustDo?: GoalPaceInfo;
    willDo?: GoalPaceInfo;
    couldDo?: GoalPaceInfo;
  };
  isPreseason?: boolean;
  // Personal baseline comparison
  personalBaseline?: {
    avgFPPerWorkDay: number;
    workDaysIn14: number;
  };
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
  goalPace,
  isPreseason = false,
  personalBaseline,
}: RepGoalPaceCardProps) => {
  const tiers: GoalTier[] = [];

  // Add preseason goal if exists and we're in preseason
  if (preseasonGoal && preseasonGoal > 0) {
    tiers.push({
      label: 'Preseason',
      goal: preseasonGoal,
      current: preseasonProgress,
      paceInfo: goalPace?.preseason,
    });
  }

  // Add summer goals (show all tiers for visibility)
  if (mustGoal && mustGoal > 0) {
    tiers.push({
      label: 'Must Do',
      goal: mustGoal,
      current: currentFP,
      paceInfo: goalPace?.mustDo,
      isFocused: focusTier === 'mustDo',
    });
  }
  if (willGoal && willGoal > 0) {
    tiers.push({
      label: 'Will Do',
      goal: willGoal,
      current: currentFP,
      paceInfo: goalPace?.willDo,
      isFocused: focusTier === 'willDo',
    });
  }
  if (couldGoal && couldGoal > 0) {
    tiers.push({
      label: 'Could Do',
      goal: couldGoal,
      current: currentFP,
      paceInfo: goalPace?.couldDo,
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
        {isPreseason && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
            Preseason
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {tiers.map((tier) => (
          <GoalTierRow 
            key={tier.label} 
            tier={tier} 
            personalBaseline={personalBaseline}
          />
        ))}
      </div>
    </div>
  );
};

const GoalTierRow = ({ 
  tier, 
  personalBaseline 
}: { 
  tier: GoalTier;
  personalBaseline?: { avgFPPerWorkDay: number; workDaysIn14: number };
}) => {
  const { label, goal, current, paceInfo, isFocused } = tier;
  
  // Use time-aware pace if available, otherwise fall back to simple percentage
  const pacePercent = paceInfo?.pacePercent ?? (goal > 0 ? (current / goal) * 100 : 0);
  const expectedProgress = paceInfo?.expectedAtThisPoint;
  
  // Determine status based on pace info or simple comparison
  const isComplete = current >= goal;
  const isOnPace = paceInfo ? paceInfo.status === 'on_pace' : pacePercent >= 85;
  const isAtRisk = paceInfo ? paceInfo.status === 'at_risk' : (pacePercent < 85 && pacePercent >= 70);
  const isBehind = paceInfo ? paceInfo.status === 'behind' : pacePercent < 70;
  
  // Calculate baseline comparison (how current performance compares to personal average)
  const baselineComparison = personalBaseline && personalBaseline.workDaysIn14 > 0 && paceInfo
    ? {
        // How much they would have at this point based on their personal average
        expectedByBaseline: personalBaseline.avgFPPerWorkDay * paceInfo.daysElapsed,
        percentOfBaseline: personalBaseline.avgFPPerWorkDay > 0 
          ? (current / (personalBaseline.avgFPPerWorkDay * paceInfo.daysElapsed)) * 100
          : 0,
      }
    : null;
  
  // Get status icon and color
  const getStatusIcon = () => {
    if (isComplete) return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (isOnPace) return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
    if (isBehind) return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
    return <Minus className="w-3.5 h-3.5 text-yellow-500" />;
  };

  const getProgressColor = () => {
    if (isComplete) return "bg-green-500";
    if (isOnPace) return "bg-green-500";
    if (isBehind) return "bg-red-500";
    return "bg-yellow-500";
  };

  const getStatusLabel = () => {
    if (isComplete) return 'Complete';
    if (isOnPace) return 'On Pace';
    if (isAtRisk) return 'At Risk';
    return 'Behind';
  };

  // Calculate how far ahead/behind in FP
  const fpDifference = expectedProgress !== undefined 
    ? current - expectedProgress 
    : null;

  // Interpretation: Is goal ambitious relative to their baseline?
  const getInterpretation = () => {
    if (!baselineComparison || !paceInfo) return null;
    
    const behindOnGoal = isBehind || isAtRisk;
    const performingNormally = baselineComparison.percentOfBaseline >= 90;
    
    if (behindOnGoal && performingNormally) {
      return { text: "Goal may be ambitious", color: "text-muted-foreground" };
    }
    if (behindOnGoal && !performingNormally) {
      return { text: "Below your capability", color: "text-red-600" };
    }
    if (!behindOnGoal && !performingNormally) {
      return { text: "Exceeding baseline", color: "text-green-600" };
    }
    return null;
  };

  const interpretation = getInterpretation();

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
            "text-xs font-medium",
            isComplete && "text-green-600",
            isOnPace && !isComplete && "text-green-600",
            isBehind && "text-red-600",
            isAtRisk && "text-yellow-600"
          )}>
            {getStatusLabel()}
          </span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn("h-full transition-all duration-300 rounded-full", getProgressColor())}
          style={{ width: `${Math.min(100, (current / goal) * 100)}%` }}
        />
      </div>
      
      {/* Progress text with time-aware context */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground tabular-nums">
          {current.toFixed(1)} / {goal.toFixed(0)} FP+
        </span>
        {fpDifference !== null && !isComplete && (
          <span className={cn(
            "text-[10px] font-medium tabular-nums",
            fpDifference >= 0 ? "text-green-600" : "text-red-600"
          )}>
            {fpDifference >= 0 ? '+' : ''}{fpDifference.toFixed(1)} vs expected
          </span>
        )}
        {isComplete && (
          <span className="text-[10px] text-green-600 font-medium">
            ✓ Complete
          </span>
        )}
        {fpDifference === null && !isComplete && (
          <span className="text-[10px] text-muted-foreground">
            {(goal - current).toFixed(1)} to go
          </span>
        )}
      </div>

      {/* Days context when pace info is available */}
      {paceInfo && !isComplete && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>
            Day {Math.round(paceInfo.daysElapsed)} of {paceInfo.totalPlannedDays}
            {expectedProgress !== undefined && (
              <> • Expected: {expectedProgress.toFixed(1)} FP+</>
            )}
          </span>
        </div>
      )}

      {/* Personal baseline comparison */}
      {baselineComparison && !isComplete && (
        <div className="mt-1.5 pt-1.5 border-t border-border/50">
          <div className="flex items-center gap-1 text-[10px]">
            <User className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground">vs Baseline:</span>
            <span className={cn(
              "font-medium",
              baselineComparison.percentOfBaseline >= 100 ? "text-green-600" :
              baselineComparison.percentOfBaseline >= 90 ? "text-muted-foreground" :
              "text-yellow-600"
            )}>
              {baselineComparison.percentOfBaseline.toFixed(0)}% of your avg
            </span>
          </div>
          {interpretation && (
            <p className={cn("text-[10px] mt-0.5 italic", interpretation.color)}>
              → {interpretation.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
};