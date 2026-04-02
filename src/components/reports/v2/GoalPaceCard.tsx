import { Card } from "@/components/ui/card";
import { Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface GoalPaceRep {
  name: string;
  userId: string;
  status: 'on_pace' | 'at_risk' | 'behind' | 'no_goals';
  gapToGoal?: number;
  percentComplete?: number;
}

interface GoalPaceCardProps {
  reps: GoalPaceRep[];
  onOpenDrawer: () => void;
  isLoading?: boolean;
}

const getFirstName = (name: string) => {
  const stripped = name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
  return stripped.split(' ')[0] || stripped;
};

export const GoalPaceCard = ({ reps, onOpenDrawer, isLoading }: GoalPaceCardProps) => {
  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="h-5 w-32 bg-muted animate-pulse rounded mb-3" />
        <div className="h-4 bg-muted animate-pulse rounded mb-2" />
        <div className="h-16 bg-muted animate-pulse rounded" />
      </Card>
    );
  }

  if (reps.length === 0) return null;

  const onPace = reps.filter(r => r.status === 'on_pace');
  const atRisk = reps.filter(r => r.status === 'at_risk');
  const behind = reps.filter(r => r.status === 'behind');
  const noGoals = reps.filter(r => r.status === 'no_goals');
  const total = reps.length;
  const withGoals = total - noGoals.length;

  if (withGoals === 0) return null;

  // Percentages for stacked bar
  const pctOnPace = (onPace.length / total) * 100;
  const pctAtRisk = (atRisk.length / total) * 100;
  const pctBehind = (behind.length / total) * 100;
  const pctNoGoals = (noGoals.length / total) * 100;

  // Top 3 most urgent reps (behind first, then at risk)
  const urgent = [...behind, ...atRisk].slice(0, 3);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4">
        <button onClick={onOpenDrawer} className="w-full text-left group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Goal Pace</h3>
              <span className="text-xs text-muted-foreground">{withGoals}/{total} with goals</span>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </div>

          {/* Stacked horizontal bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-muted/30 mb-3">
            {pctOnPace > 0 && (
              <div className="bg-green-500 transition-all" style={{ width: `${pctOnPace}%` }} />
            )}
            {pctAtRisk > 0 && (
              <div className="bg-amber-500 transition-all" style={{ width: `${pctAtRisk}%` }} />
            )}
            {pctBehind > 0 && (
              <div className="bg-red-500 transition-all" style={{ width: `${pctBehind}%` }} />
            )}
            {pctNoGoals > 0 && (
              <div className="bg-muted-foreground/15 transition-all" style={{ width: `${pctNoGoals}%` }} />
            )}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 text-[10px] mb-3">
            {onPace.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-muted-foreground">{onPace.length} on pace</span>
              </div>
            )}
            {atRisk.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-muted-foreground">{atRisk.length} at risk</span>
              </div>
            )}
            {behind.length > 0 && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-muted-foreground">{behind.length} behind</span>
              </div>
            )}
          </div>

          {/* Urgent reps */}
          {urgent.length > 0 && (
            <div className="space-y-1.5">
              {urgent.map(rep => (
                <div key={rep.userId} className={cn(
                  "flex items-center justify-between text-xs px-2.5 py-1.5 rounded-lg",
                  rep.status === 'behind' ? "bg-red-500/5 border border-red-500/20" : "bg-amber-500/5 border border-amber-500/20"
                )}>
                  <span className="font-medium">{getFirstName(rep.name)}</span>
                  <span className={cn(
                    "font-semibold",
                    rep.status === 'behind' ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                  )}>
                    {rep.percentComplete !== undefined ? `${rep.percentComplete}%` : rep.status === 'behind' ? 'Behind' : 'At Risk'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </button>
      </Card>
    </motion.div>
  );
};
