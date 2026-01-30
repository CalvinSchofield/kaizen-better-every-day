import { useMemo } from 'react';
import { useOfficialTotals } from './useOfficialTotals';

interface UseEffectiveSpendingParams {
  trackedSpending: number;
  seasonType?: 'preseason' | 'summer';
}

interface UseEffectiveSpendingResult {
  effectiveSpending: number;
  hasOverride: boolean;
  override: number | null;
  trackedSpending: number;
  isLoading: boolean;
}

/**
 * Hook to calculate effective spending, considering both tracked spending
 * from deals and any manual override from official_totals.
 * 
 * Returns the higher of: tracked spending OR official override
 * This ensures we never undercount spending.
 */
export const useEffectiveSpending = ({
  trackedSpending,
  seasonType = 'summer',
}: UseEffectiveSpendingParams): UseEffectiveSpendingResult => {
  const { getTotals, isLoading } = useOfficialTotals(seasonType);
  
  const result = useMemo(() => {
    const totals = getTotals(seasonType);
    const override = totals?.total_spent ?? null;
    const hasOverride = override !== null && override > 0;
    
    // Use the higher of tracked or override to never undercount
    const effectiveSpending = hasOverride 
      ? Math.max(trackedSpending, override)
      : trackedSpending;
    
    return {
      effectiveSpending,
      hasOverride,
      override,
      trackedSpending,
      isLoading,
    };
  }, [getTotals, seasonType, trackedSpending, isLoading]);
  
  return result;
};
