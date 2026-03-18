import { Target, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EnhancedGoalPaceResult } from "@/hooks/useReportsV2Data";

interface GoalPaceSectionProps {
  enhancedGoalPace: EnhancedGoalPaceResult[];
  onOpenDrawer: () => void;
  isLoading?: boolean;
}

export const GoalPaceSection = ({ enhancedGoalPace, onOpenDrawer, isLoading }: GoalPaceSectionProps) => {
  if (isLoading || enhancedGoalPace.length === 0) return null;

  const onPace = enhancedGoalPace.filter(r => r.status === 'on_pace').length;
  const atRisk = enhancedGoalPace.filter(r => r.status === 'at_risk').length;
  const behind = enhancedGoalPace.filter(r => r.status === 'behind').length;
  const total = enhancedGoalPace.length;
  const withGoals = total - enhancedGoalPace.filter(r => r.status === 'no_goals').length;

  // Build a concise summary
  const parts: string[] = [];
  if (onPace > 0) parts.push(`${onPace} on pace`);
  if (atRisk > 0) parts.push(`${atRisk} at risk`);
  if (behind > 0) parts.push(`${behind} behind`);

  const hasUrgent = atRisk > 0 || behind > 0;

  return (
    <button
      onClick={onOpenDrawer}
      className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 active:scale-[0.99] transition-all"
    >
      <div className="flex items-center gap-2 text-sm">
        <Target className="w-4 h-4 text-muted-foreground" />
        <span className="font-medium">{withGoals}/{total}</span>
        <span className="text-muted-foreground">goal pace</span>
        {hasUrgent && (
          <div className={cn(
            "w-1.5 h-1.5 rounded-full",
            behind > 0 ? "bg-red-500" : "bg-amber-500"
          )} />
        )}
        {parts.length > 0 && (
          <span className="text-[10px] text-muted-foreground hidden min-[380px]:inline">
            · {parts.join(', ')}
          </span>
        )}
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground" />
    </button>
  );
};
