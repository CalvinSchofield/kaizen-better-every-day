import { Target, TrendingUp, TrendingDown, CheckCircle2, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { DownlineGoalPace, PaceStatus } from "@/hooks/useDownlineGoalPace";
import { GOAL_TIER_CONFIG } from "@/config/goalTiers";

const PACE_CONFIG: Record<PaceStatus, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  'ahead': { label: 'Ahead', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15', icon: TrendingUp },
  'on-track': { label: 'On Track', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/15', icon: Target },
  'behind': { label: 'Behind', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15', icon: TrendingDown },
  'at-risk': { label: 'At Risk', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/15', icon: AlertCircle },
  'goal-met': { label: 'Goal Met!', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15', icon: CheckCircle2 },
  'no-goals': { label: 'No Goals', color: 'text-muted-foreground', bg: 'bg-muted/50', icon: Target },
};

interface GoalPaceCardProps {
  pace: DownlineGoalPace;
  repName: string;
}

export const GoalPaceCard = ({ pace, repName }: GoalPaceCardProps) => {
  const paceConfig = PACE_CONFIG[pace.paceStatus];
  const PaceIcon = paceConfig.icon;

  // Map goalLabel to tier config
  const tierKey = pace.isPreseason ? 'preseason' :
    pace.goalLabel === 'Must Do' ? 'mustDo' :
    pace.goalLabel === 'Could Do' ? 'couldDo' : 'willDo';
  const tierConfig = GOAL_TIER_CONFIG[tierKey];
  const TierIcon = tierConfig.icon;

  if (pace.paceStatus === 'no-goals') {
    return (
      <div className="min-w-full snap-center px-4">
        <div className="rounded-2xl bg-card border border-border p-4 flex flex-col items-center text-center gap-2">
          <Target className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No goals set yet</p>
        </div>
      </div>
    );
  }

  const firstName = repName.split(' ')[0];

  return (
    <div className="min-w-full snap-center px-4">
      <div className="rounded-2xl bg-card border border-border p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TierIcon className={cn("h-4 w-4", tierConfig.color)} />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {pace.goalLabel} Goal
            </span>
          </div>
          <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1", paceConfig.bg, paceConfig.color)}>
            <PaceIcon className="h-3 w-3" />
            {paceConfig.label}
          </span>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-lg font-bold text-foreground">
              {pace.ytdFP.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              / {pace.goal} FP+
            </span>
          </div>
          <Progress value={pace.progressPercent} className="h-2" />
          <span className="text-[10px] text-muted-foreground">
            {pace.progressPercent.toFixed(0)}% complete
          </span>
        </div>

        {/* Pace comparison */}
        {pace.daysWorked > 0 && (
          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border">
            <span className="text-muted-foreground">
              Avg <span className="font-semibold text-foreground">{pace.currentAvgDaily.toFixed(2)}</span>/day
            </span>
            <span className="text-muted-foreground">
              Need <span className="font-semibold text-foreground">{pace.neededDaily.toFixed(2)}</span>/day
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
