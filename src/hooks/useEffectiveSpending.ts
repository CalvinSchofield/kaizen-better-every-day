import { useMemo } from 'react';
import { useOfficialTotals } from './useOfficialTotals';

interface UseEffectiveSpendingParams {
  trackedSpending: number;
  seasonType?: 'preseason' | 'summer';
  isSeasonScope?: boolean; // Only add baseline for season-level views
}

interface UseEffectiveSpendingResult {
  effectiveSpending: number;
  hasBaseline: boolean;
  baseline: number;
  trackedSpending: number;
  isSeasonScope: boolean;
  isLoading: boolean;
}

/**
 * Hook to calculate effective spending, considering both tracked spending
 * from deals and the pre-tracking baseline from official_totals.
 * 
 * Additive model: effectiveSpending = baseline + trackedSpending
 * 
 * The baseline only applies to season-level (YTD) views.
 * For time-scoped views (this week, this month), only tracked spending is used.
 */
export const useEffectiveSpending = ({
  trackedSpending,
  seasonType = 'summer',
  isSeasonScope = true, // Default to season scope
}: UseEffectiveSpendingParams): UseEffectiveSpendingResult => {
  const { getTotals, isLoading } = useOfficialTotals(seasonType);
  
  const result = useMemo(() => {
    const totals = getTotals(seasonType);
    const baseline = totals?.baseline_spent ?? 0;
    const hasBaseline = baseline > 0;
    
    // Only add baseline for season-level calculations
    const effectiveSpending = isSeasonScope
      ? baseline + trackedSpending
      : trackedSpending;
    
    return {
      effectiveSpending,
      hasBaseline,
      baseline,
      trackedSpending,
      isSeasonScope,
      isLoading,
    };
  }, [getTotals, seasonType, trackedSpending, isSeasonScope, isLoading]);
  
  return result;
};
