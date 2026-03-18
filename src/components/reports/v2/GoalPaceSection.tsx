import { Target, TrendingUp, AlertTriangle, XCircle, HelpCircle, Calendar, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EnhancedGoalPaceResult } from "@/hooks/useReportsV2Data";
import { GOAL_TIER_CONFIG } from "@/config/goalTiers";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";

interface GoalPaceSectionProps {
  enhancedGoalPace: EnhancedGoalPaceResult[];
  onOpenDrawer: () => void;
  isLoading?: boolean;
}

export const GoalPaceSection = ({ enhancedGoalPace, onOpenDrawer, isLoading }: GoalPaceSectionProps) => {
  if (isLoading || enhancedGoalPace.length === 0) return null;

  const onPace = enhancedGoalPace.filter(r => r.status === 'on_pace');
  const atRisk = enhancedGoalPace.filter(r => r.status === 'at_risk');
  const behind = enhancedGoalPace.filter(r => r.status === 'behind');
  const noGoals = enhancedGoalPace.filter(r => r.status === 'no_goals');
  const needsPlanning = enhancedGoalPace.filter(r => r.needsPlanning);

  // Urgent reps: behind + needs planning (deduplicated)
  const urgentIds = new Set([
    ...behind.map(r => r.userId),
    ...needsPlanning.map(r => r.userId),
  ]);
  const urgentReps = enhancedGoalPace.filter(r => urgentIds.has(r.userId));

  const tiles = [
    { key: 'on_pace', count: onPace.length, label: 'On Pace', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', icon: TrendingUp },
    { key: 'at_risk', count: atRisk.length, label: 'At Risk', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', icon: AlertTriangle },
    { key: 'behind', count: behind.length, label: 'Behind', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', icon: XCircle },
    { key: 'no_goals', count: noGoals.length, label: 'No Goals', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: HelpCircle },
    ...(needsPlanning.length > 0
      ? [{ key: 'needs_planning', count: needsPlanning.length, label: 'Plan Days', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', icon: Calendar }]
      : []),
  ].filter(t => t.count > 0);

  return (
    <div className="space-y-3">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between"
        onClick={onOpenDrawer}
      >
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Goal Pace</span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Status Tiles */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <button
              key={tile.key}
              onClick={onOpenDrawer}
              className={cn(
                "flex-shrink-0 rounded-xl p-3 min-w-[80px] text-center transition-all active:scale-95",
                tile.bg
              )}
            >
              <Icon className={cn("w-4 h-4 mx-auto mb-1", tile.color)} />
              <div className={cn("text-xl font-bold", tile.color)}>{tile.count}</div>
              <div className="text-[10px] text-muted-foreground whitespace-nowrap">{tile.label}</div>
            </button>
          );
        })}
      </div>

      {/* Urgent Reps Scroll */}
      {urgentReps.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
          {urgentReps.slice(0, 8).map(rep => {
            const tierConfig = rep.focusTier ? GOAL_TIER_CONFIG[rep.focusTier] : null;
            return (
              <button
                key={rep.userId}
                onClick={onOpenDrawer}
                className={cn(
                  "flex-shrink-0 rounded-xl border p-3 min-w-[140px] text-left transition-all active:scale-95 bg-card",
                  rep.needsPlanning && rep.status !== 'behind' && "border-blue-500/40",
                  rep.status === 'behind' && "border-red-500/30 bg-red-500/5"
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="font-medium text-sm truncate">{getFirstName(rep.name)}</span>
                  {tierConfig && (
                    <Badge variant="outline" className={cn("text-[8px] px-1 py-0", tierConfig.color, tierConfig.borderColor)}>
                      {tierConfig.shortLabel}
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-foreground">{rep.dailyNeeded.toFixed(1)}</span>
                  <span className="text-[10px] text-muted-foreground">need/day</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  avg {rep.userDailyAvg.toFixed(1)}/day
                </div>
                {rep.needsPlanning && (
                  <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                    {rep.futurePlannedDays} days planned
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
