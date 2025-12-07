import { useMemo } from "react";
import { useGroupRecruits } from "./useGroupRecruits";

// Stages that count as "sold"
const SOLD_STAGES = ['Sold 💲', 'Sold (5+) 💰'];

// Stages that should NOT count (even if previously sold)
const EXCLUDED_STAGES = ['Not Interested', 'Signed but Not Interested', 'Potential Follow Up'];

/**
 * Hook to calculate the number of direct recruits who have made a sale.
 * Only counts recruits in "Sold" or "Sold (5+)" stages.
 * Excludes recruits who were moved to Not Interested, Signed but Not Interested, or Potential Follow Up.
 */
export const useRepsWithSaleCount = () => {
  const { data, isLoading, isLeader } = useGroupRecruits();

  const count = useMemo(() => {
    if (!data?.recruits) return 0;
    
    return data.recruits.filter(recruit => {
      // Only count if in a sold stage
      if (!SOLD_STAGES.includes(recruit.stage)) return false;
      
      // Exclude if in an excluded stage (this shouldn't happen but just in case)
      if (EXCLUDED_STAGES.includes(recruit.stage)) return false;
      
      return true;
    }).length;
  }, [data?.recruits]);

  return {
    count,
    isLoading,
    isLeader,
  };
};
