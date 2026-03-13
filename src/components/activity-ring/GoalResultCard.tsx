/**
 * GoalResultCard - Now powered by UnifiedGoalProgress
 * 
 * Drop-in replacement that uses the unified goal pace calculator
 * instead of its own calculation logic.
 */

import { UnifiedGoalProgress } from '@/components/goals/UnifiedGoalProgress';
import { useGoalPaceCalculator } from '@/hooks/useGoalPaceCalculator';
import { Skeleton } from '@/components/ui/skeleton';

interface GoalResultCardProps {
  fpToday: number;
  prmrToday?: number;
  className?: string;
}

export const GoalResultCard = ({
  className,
}: GoalResultCardProps) => {
  const data = useGoalPaceCalculator();

  if (data.isLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (!data.hasGoals) return null;

  return (
    <UnifiedGoalProgress
      data={data}
      mode="compact"
      compactTimeframes={['D', 'Y']}
      showPaceContext={true}
      className={className}
    />
  );
};
