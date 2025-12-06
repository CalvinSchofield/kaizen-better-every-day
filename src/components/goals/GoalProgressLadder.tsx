import { GoalTierCard, GoalTier } from "./GoalTierCard";
import { RepGoals } from "@/hooks/useRepGoals";
import { useEfpMode } from "@/hooks/useEfpMode";

interface GoalProgressLadderProps {
  goals: RepGoals;
  currentFpPlus: number;
  currentPrmr?: number;
  isRookie: boolean;
  onTierClick?: (tier: GoalTier) => void;
}

export const GoalProgressLadder = ({
  goals,
  currentFpPlus,
  currentPrmr = 0,
  isRookie,
  onTierClick,
}: GoalProgressLadderProps) => {
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  
  // Calculate current progress based on mode
  const currentProgress = efpModeEnabled ? calculateEfp(currentPrmr) : currentFpPlus;
  
  // Convert goals to EFP if in EFP mode (EFP goal = FP+ goal * avgPrmrPerFp / 85)
  const conversionFactor = efpModeEnabled ? goals.avg_prmr_per_fp / 85 : 1;
  
  const mustDoGoal = goals.must_do_fp_goal * conversionFactor;
  const willDoGoal = goals.will_do_fp_goal * conversionFactor;
  const couldDoGoal = goals.could_do_fp_goal * conversionFactor;
  
  // Determine which goals are complete and which is the current target
  const mustDoComplete = currentProgress >= mustDoGoal && mustDoGoal > 0;
  const willDoComplete = currentProgress >= willDoGoal && willDoGoal > 0;
  const couldDoComplete = currentProgress >= couldDoGoal && couldDoGoal > 0;

  // Find current target (first incomplete goal)
  let currentTarget: GoalTier | null = null;
  if (mustDoGoal > 0 && !mustDoComplete) {
    currentTarget = 'mustDo';
  } else if (willDoGoal > 0 && !willDoComplete) {
    currentTarget = 'willDo';
  } else if (couldDoGoal > 0 && !couldDoComplete) {
    currentTarget = 'couldDo';
  }

  const sharedProps = {
    avgPrmrPerFp: goals.avg_prmr_per_fp,
    upgradeFpGoal: goals.upgrade_fp_goal,
    rentType: goals.rent_type,
    weeksWorking: goals.weeks_working,
    currentProgress,
    efpMode: efpModeEnabled,
  };

  // Show Must Do for everyone until it's completed
  const showMustDo = mustDoGoal > 0 && !mustDoComplete;

  return (
    <div className="space-y-3">
      {/* Must Do - First tier (minimum) */}
      {showMustDo && (
        <GoalTierCard
          tier="mustDo"
          fpGoal={goals.must_do_fp_goal}
          displayGoal={mustDoGoal}
          isCurrentTarget={currentTarget === 'mustDo'}
          isComplete={mustDoComplete}
          onClick={() => onTierClick?.('mustDo')}
          {...sharedProps}
        />
      )}

      {/* Will Do - Second tier (realistic) */}
      {willDoGoal > 0 && (
        <GoalTierCard
          tier="willDo"
          fpGoal={goals.will_do_fp_goal}
          displayGoal={willDoGoal}
          isCurrentTarget={currentTarget === 'willDo'}
          isComplete={willDoComplete}
          onClick={() => onTierClick?.('willDo')}
          {...sharedProps}
        />
      )}

      {/* Could Do - Top tier (stretch) */}
      {couldDoGoal > 0 && (
        <GoalTierCard
          tier="couldDo"
          fpGoal={goals.could_do_fp_goal}
          displayGoal={couldDoGoal}
          isCurrentTarget={currentTarget === 'couldDo'}
          isComplete={couldDoComplete}
          onClick={() => onTierClick?.('couldDo')}
          {...sharedProps}
        />
      )}
    </div>
  );
};
