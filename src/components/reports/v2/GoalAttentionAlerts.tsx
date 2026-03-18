import { Flame, ChevronRight } from "lucide-react";
import { EnhancedGoalPaceResult } from "@/hooks/useReportsV2Data";
import { getFirstName } from "@/components/mygroup/recruit-detail/utils";
import { cn } from "@/lib/utils";

interface GoalAttentionAlertsProps {
  enhancedGoalPace: EnhancedGoalPaceResult[];
  onRepClick?: (userId: string) => void;
}

/**
 * Surfaces reps whose required daily pace is >1.5x their historical average.
 * Leader-facing only — shown in the Reports V2 Goal Pace section.
 */
export const GoalAttentionAlerts = ({ enhancedGoalPace, onRepClick }: GoalAttentionAlertsProps) => {
  // Filter to reps with unrealistic pace: needed > 1.5x their avg AND they have some data
  const unrealisticReps = enhancedGoalPace.filter(rep => {
    if (rep.status === 'no_goals' || rep.dailyNeeded <= 0) return false;
    if (rep.userDailyAvg <= 0) return rep.dailyNeeded > 3; // No avg yet but high target
    return rep.dailyNeeded / rep.userDailyAvg > 1.5;
  });

  if (unrealisticReps.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
        <Flame className="w-3.5 h-3.5" />
        <span>{unrealisticReps.length} rep{unrealisticReps.length !== 1 ? 's' : ''} with ambitious pace</span>
      </div>
      <div className="space-y-1.5">
        {unrealisticReps.slice(0, 5).map(rep => {
          const ratio = rep.userDailyAvg > 0 
            ? (rep.dailyNeeded / rep.userDailyAvg).toFixed(1) 
            : '∞';
          return (
            <button
              key={rep.userId}
              className={cn(
                "w-full flex items-center justify-between p-2.5 rounded-lg",
                "bg-amber-500/5 border border-amber-500/20",
                "active:scale-[0.98] transition-all text-left"
              )}
              onClick={() => onRepClick?.(rep.userId)}
            >
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium">{getFirstName(rep.name)}</span>
                  <div className="text-[10px] text-muted-foreground">
                    Needs {rep.dailyNeeded.toFixed(1)}/day · Avg {rep.userDailyAvg.toFixed(1)}/day · {ratio}x stretch
                  </div>
                </div>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
            </button>
          );
        })}
        {unrealisticReps.length > 5 && (
          <p className="text-[10px] text-muted-foreground text-center">
            +{unrealisticReps.length - 5} more
          </p>
        )}
      </div>
    </div>
  );
};
