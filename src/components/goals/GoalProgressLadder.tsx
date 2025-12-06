import { GoalTierCard, GoalTier } from "./GoalTierCard";
import { RepGoals } from "@/hooks/useRepGoals";
import { useEfpMode } from "@/hooks/useEfpMode";

interface GoalProgressLadderProps {
  goals: RepGoals;
  currentFpPlus: number;
  currentPrmr?: number;
  fundedFpPlus?: number;
  fundedPrmr?: number;
  isRookie: boolean;
  onTierClick?: (tier: GoalTier) => void;
}

export const GoalProgressLadder = ({
  goals,
  currentFpPlus,
  currentPrmr = 0,
  fundedFpPlus = 0,
  fundedPrmr = 0,
  isRookie,
  onTierClick,
}: GoalProgressLadderProps) => {
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  
  // Calculate current progress based on mode (total = for goals, funded = for income)
  const currentProgress = efpModeEnabled ? calculateEfp(currentPrmr) : currentFpPlus;
  const fundedProgress = efpModeEnabled ? calculateEfp(fundedPrmr) : fundedFpPlus;
  
  // Always use $85 for conversion
  const conversionFactor = efpModeEnabled ? 85 / 85 : 1;
  
  const preseasonGoal = (goals.preseason_fp_goal || 0) * conversionFactor;
  const mustDoGoal = goals.must_do_fp_goal * conversionFactor;
  const willDoGoal = goals.will_do_fp_goal * conversionFactor;
  const couldDoGoal = goals.could_do_fp_goal * conversionFactor;
  
  // Determine which goals are complete and which is the current target
  const preseasonComplete = currentProgress >= preseasonGoal && preseasonGoal > 0;
  const mustDoComplete = currentProgress >= mustDoGoal && mustDoGoal > 0;
  const willDoComplete = currentProgress >= willDoGoal && willDoGoal > 0;
  const couldDoComplete = currentProgress >= couldDoGoal && couldDoGoal > 0;

  // Check if we're in preseason
  const isPreseason = new Date() < new Date('2026-04-12');

  // Find current target (first incomplete goal)
  let currentTarget: GoalTier | null = null;
  if (isPreseason && preseasonGoal > 0 && !preseasonComplete) {
    currentTarget = 'preseason';
  } else if (mustDoGoal > 0 && !mustDoComplete) {
    currentTarget = 'mustDo';
  } else if (willDoGoal > 0 && !willDoComplete) {
    currentTarget = 'willDo';
  } else if (couldDoGoal > 0 && !couldDoComplete) {
    currentTarget = 'couldDo';
  }

  // Only show funded progress if it differs from total
  const showFundedProgress = fundedProgress < currentProgress;

  const sharedProps = {
    avgPrmrPerFp: 85,
    upgradeFpGoal: goals.upgrade_fp_goal,
    rentType: goals.rent_type,
    weeksWorking: goals.weeks_working,
    currentProgress,
    fundedProgress: showFundedProgress ? fundedProgress : undefined,
    efpMode: efpModeEnabled,
  };

  // Show Preseason during preseason until completed
  const showPreseason = isPreseason && preseasonGoal > 0 && !preseasonComplete;
  
  // Show Must Do for everyone until it's completed
  const showMustDo = mustDoGoal > 0 && !mustDoComplete;

  return (
    <div className="space-y-3">
      {/* Preseason - During preseason only */}
      {showPreseason && (
        <GoalTierCard
          tier="preseason"
          fpGoal={goals.preseason_fp_goal || 0}
          displayGoal={preseasonGoal}
          isCurrentTarget={currentTarget === 'preseason'}
          isComplete={preseasonComplete}
          onClick={() => onTierClick?.('preseason')}
          {...sharedProps}
        />
      )}

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
