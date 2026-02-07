import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";
import { useRepGoals } from "@/hooks/useRepGoals";
import { usePreseasonFP } from "@/hooks/usePreseasonFP";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useFocusTier, FocusTier } from "@/hooks/useFocusTier";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";
import { Skeleton } from "@/components/ui/skeleton";

interface SeasonGoalsPreviewProps {
  className?: string;
}

const tierLabels: Record<FocusTier, string> = {
  mustDo: 'Must Do',
  willDo: 'Will Do',
  couldDo: 'Could Do',
};

export const SeasonGoalsPreview = ({ className }: SeasonGoalsPreviewProps) => {
  const { goals, isLoading: goalsLoading } = useRepGoals();
  const { totalFP, totalEFP } = usePreseasonFP();
  const { efpModeEnabled } = useEfpMode();
  const { 
    isUserSummerStarted, 
    focusTier, 
    setFocusTier,
    allTiers,
    isLoading: tierLoading,
  } = useFocusTier();

  const isLoading = goalsLoading || tierLoading;

  if (isLoading) {
    return (
      <Card className={`p-4 border-border/50 ${className}`}>
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!goals?.setup_complete) {
    return null; // DailyMissionCard handles the CTA
  }

  const unitLabel = efpModeEnabled ? 'EFP' : 'FP+';
  const currentProgress = efpModeEnabled ? totalEFP : totalFP;

  // Preseason mode - show only preseason goal
  if (!isUserSummerStarted) {
    const preseasonGoal = goals.preseason_fp_goal || 0;
    const progressPercent = preseasonGoal > 0 ? Math.min((currentProgress / preseasonGoal) * 100, 100) : 0;

    return (
      <Card className={`p-4 border-border/50 ${className}`}>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-foreground">Preseason Goal</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-foreground">
              {Math.round(currentProgress * 10) / 10}
            </span>
            <span className="text-sm text-muted-foreground">
              / {preseasonGoal} {unitLabel}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </Card>
    );
  }

  // Summer mode - show tier pills and focused goal
  const handleTierTap = async (tier: FocusTier) => {
    if (tier === focusTier) return;
    hapticLight();
    await setFocusTier(tier);
  };

  const focusedGoal = allTiers[focusTier].goal;
  const progressPercent = focusedGoal > 0 ? Math.min((currentProgress / focusedGoal) * 100, 100) : 0;

  return (
    <Card className={`p-4 border-border/50 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4 text-amber-500" />
        <span className="text-sm font-semibold text-foreground">Summer Goals</span>
      </div>

      {/* Tier pills */}
      <div className="flex gap-2 mb-4">
        {(['mustDo', 'willDo', 'couldDo'] as FocusTier[]).map((tier) => {
          const isActive = tier === focusTier;
          const tierGoal = allTiers[tier].goal;
          const isComplete = allTiers[tier].complete;
          
          return (
            <button
              key={tier}
              onClick={() => handleTierTap(tier)}
              className={cn(
                "flex-1 py-2 px-3 rounded-lg text-center transition-all active:scale-[0.97]",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : isComplete
                    ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
                    : "bg-muted/50 text-muted-foreground border border-border/30"
              )}
            >
              <div className="text-xs font-medium opacity-80">{tierLabels[tier]}</div>
              <div className="text-sm font-bold">{Math.round(tierGoal)}</div>
            </button>
          );
        })}
      </div>

      {/* Focused goal progress */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-semibold text-foreground">
            Your focus: {tierLabels[focusTier]}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-foreground font-medium">
            {Math.round(currentProgress * 10) / 10} {unitLabel}
          </span>
          <span className="text-muted-foreground">
            / {Math.round(focusedGoal)} {unitLabel}
          </span>
        </div>
        <Progress value={progressPercent} className="h-2" />
      </div>
    </Card>
  );
};
