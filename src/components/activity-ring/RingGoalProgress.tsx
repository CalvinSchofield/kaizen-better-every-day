/**
 * RingGoalProgress - Now powered by UnifiedGoalProgress
 * 
 * Drop-in replacement for the Activity Ring section.
 */

import { UnifiedGoalProgress } from '@/components/goals/UnifiedGoalProgress';
import { useGoalPaceCalculator } from '@/hooks/useGoalPaceCalculator';
import { cn } from '@/lib/utils';

interface RingGoalProgressProps {
  // Legacy props kept for API compatibility but ignored
  preseasonMode?: boolean;
  preseasonFP?: number;
  preseasonGoal?: number;
  summerMode?: boolean;
  seasonFP?: number;
  focusTierGoal?: number;
  focusTier?: string | null;
  todayFP?: number;
  dailyNeed?: number;
  weeklyFP?: number;
  weeklyGoal?: number;
  dayOfSeason?: number;
  totalSeasonDays?: number;
  seasonGoal?: number;
  className?: string;
}

export const RingGoalProgress = ({ className }: RingGoalProgressProps) => {
  const data = useGoalPaceCalculator();

  if (!data.hasGoals) {
    return null;
  }

  return (
    <UnifiedGoalProgress
      data={data}
      mode="compact"
      compactTimeframes={['D', 'Y']}
      showPaceContext={true}
      className={cn("mx-4", className)}
    />
  );
};
