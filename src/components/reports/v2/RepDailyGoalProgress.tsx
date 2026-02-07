import { cn } from "@/lib/utils";
import { Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface GoalPaceInfo {
  daysElapsed: number;
  totalPlannedDays: number;
  expectedAtThisPoint: number;
  pacePercent: number;
  status: 'on_pace' | 'at_risk' | 'behind';
}

interface RepDailyGoalProgressProps {
  // Today's progress
  todayFP: number;
  dailyGoal: number;
  
  // Season/Preseason progress
  seasonFP: number;
  seasonGoal: number;
  seasonLabel: string; // "Preseason" or tier name like "Must Do"
  
  // Pace info
  paceInfo?: GoalPaceInfo;
  isPreseason?: boolean;
  
  // For summer tier selection
  focusTier?: string | null;
  onTierChange?: (tier: string) => void;
  availableTiers?: { label: string; goal: number }[];
  
  className?: string;
}

export const RepDailyGoalProgress = ({
  todayFP,
  dailyGoal,
  seasonFP,
  seasonGoal,
  seasonLabel,
  paceInfo,
  isPreseason = true,
  focusTier,
  onTierChange,
  availableTiers,
  className,
}: RepDailyGoalProgressProps) => {
  // Calculate today's progress
  const todayProgress = dailyGoal > 0 ? Math.min(100, (todayFP / dailyGoal) * 100) : 0;
  
  // Calculate season progress
  const seasonProgress = seasonGoal > 0 ? Math.min(100, (seasonFP / seasonGoal) * 100) : 0;
  
  // Pace calculation
  const fpDifference = paceInfo?.expectedAtThisPoint !== undefined 
    ? seasonFP - paceInfo.expectedAtThisPoint 
    : null;
    
  const getStatusIcon = () => {
    if (!paceInfo) return null;
    if (paceInfo.status === 'on_pace') return <TrendingUp className="w-3.5 h-3.5" />;
    if (paceInfo.status === 'behind') return <TrendingDown className="w-3.5 h-3.5" />;
    return <Minus className="w-3.5 h-3.5" />;
  };
  
  const getStatusColor = () => {
    if (!paceInfo) return "text-muted-foreground";
    if (paceInfo.status === 'on_pace') return "text-green-600";
    if (paceInfo.status === 'behind') return "text-red-600";
    return "text-yellow-600";
  };
  
  const getProgressBarColor = (status?: 'on_pace' | 'at_risk' | 'behind') => {
    if (!status) return "bg-primary";
    if (status === 'on_pace') return "bg-green-500";
    if (status === 'behind') return "bg-red-500";
    return "bg-yellow-500";
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h4 className="text-sm font-semibold">Goal Progress</h4>
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
          {isPreseason ? 'Preseason' : 'Summer'}
        </Badge>
      </div>

      <div className="p-3 rounded-lg bg-muted/50 space-y-3">
        {/* Today's Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Today</span>
            <span className="font-medium tabular-nums">
              {todayFP.toFixed(2)} / {dailyGoal.toFixed(2)}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${todayProgress}%` }}
            />
          </div>
        </div>
        
        {/* Season/Preseason Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{seasonLabel}</span>
            <span className="font-medium tabular-nums">
              {seasonFP.toFixed(2)} / {seasonGoal.toFixed(0)}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                getProgressBarColor(paceInfo?.status)
              )}
              style={{ width: `${seasonProgress}%` }}
            />
          </div>
          
          {/* Pace info row */}
          {paceInfo && (
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                Day {Math.round(paceInfo.daysElapsed)} of {paceInfo.totalPlannedDays}
              </span>
              {fpDifference !== null && (
                <span className={cn("font-medium flex items-center gap-1", getStatusColor())}>
                  {getStatusIcon()}
                  {fpDifference >= 0 ? '+' : ''}{fpDifference.toFixed(2)} vs pace
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Summer Tier Selector (only during summer when multiple tiers available) */}
      {!isPreseason && availableTiers && availableTiers.length > 1 && onTierChange && (
        <div className="flex gap-2 flex-wrap">
          {availableTiers.map((tier) => (
            <button
              key={tier.label}
              onClick={() => onTierChange(tier.label.toLowerCase().replace(' ', 'Do'))}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                focusTier === tier.label.toLowerCase().replace(' ', 'Do')
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              {tier.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
