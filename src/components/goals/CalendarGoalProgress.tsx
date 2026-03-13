/**
 * CalendarGoalProgress
 * Thin wrapper that connects useGoalPaceCalculator to UnifiedGoalProgress in full mode.
 * Used on the Calendar page.
 */

import { useGoalPaceCalculator } from "@/hooks/useGoalPaceCalculator";
import { UnifiedGoalProgress } from "./UnifiedGoalProgress";
import { Skeleton } from "@/components/ui/skeleton";

export const CalendarGoalProgress = () => {
  const data = useGoalPaceCalculator();

  if (data.isLoading) {
    return <Skeleton className="h-48 w-full rounded-xl" />;
  }

  if (!data.hasGoals) {
    return null;
  }

  return (
    <UnifiedGoalProgress
      data={data}
      mode="full"
      showTierSelector
      showPaceContext
      showTimeframeToggle
    />
  );
};
