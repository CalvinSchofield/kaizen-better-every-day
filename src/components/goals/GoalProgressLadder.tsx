import { GoalTierCard, GoalTier } from "./GoalTierCard";
import { RepGoals } from "@/hooks/useRepGoals";

interface GoalProgressLadderProps {
  goals: RepGoals;
  currentFpPlus: number;
  isRookie: boolean;
  onTierClick?: (tier: GoalTier) => void;
}

export const GoalProgressLadder = ({
  goals,
  currentFpPlus,
  isRookie,
  onTierClick,
}: GoalProgressLadderProps) => {
  // Determine which goals are complete and which is the current target
  const mustDoComplete = currentFpPlus >= goals.must_do_fp_goal && goals.must_do_fp_goal > 0;
  const willDoComplete = currentFpPlus >= goals.will_do_fp_goal && goals.will_do_fp_goal > 0;
  const couldDoComplete = currentFpPlus >= goals.could_do_fp_goal && goals.could_do_fp_goal > 0;

  // Find current target (first incomplete goal)
  let currentTarget: GoalTier | null = null;
  if (isRookie && goals.must_do_fp_goal > 0 && !mustDoComplete) {
    currentTarget = 'mustDo';
  } else if (goals.will_do_fp_goal > 0 && !willDoComplete) {
    currentTarget = 'willDo';
  } else if (goals.could_do_fp_goal > 0 && !couldDoComplete) {
    currentTarget = 'couldDo';
  }

  const sharedProps = {
    avgPrmrPerFp: goals.avg_prmr_per_fp,
    upgradeFpGoal: goals.upgrade_fp_goal,
    rentType: goals.rent_type,
    weeksWorking: goals.weeks_working,
    currentFpPlus,
  };

  return (
    <div className="space-y-3">
      {/* Could Do - Top tier */}
      {goals.could_do_fp_goal > 0 && (
        <GoalTierCard
          tier="couldDo"
          fpGoal={goals.could_do_fp_goal}
          isCurrentTarget={currentTarget === 'couldDo'}
          isComplete={couldDoComplete}
          onClick={() => onTierClick?.('couldDo')}
          {...sharedProps}
        />
      )}

      {/* Will Do - Middle tier */}
      {goals.will_do_fp_goal > 0 && (
        <GoalTierCard
          tier="willDo"
          fpGoal={goals.will_do_fp_goal}
          isCurrentTarget={currentTarget === 'willDo'}
          isComplete={willDoComplete}
          onClick={() => onTierClick?.('willDo')}
          {...sharedProps}
        />
      )}

      {/* Must Do - Rookies only */}
      {isRookie && goals.must_do_fp_goal > 0 && (
        <GoalTierCard
          tier="mustDo"
          fpGoal={goals.must_do_fp_goal}
          isCurrentTarget={currentTarget === 'mustDo'}
          isComplete={mustDoComplete}
          onClick={() => onTierClick?.('mustDo')}
          {...sharedProps}
        />
      )}
    </div>
  );
};
