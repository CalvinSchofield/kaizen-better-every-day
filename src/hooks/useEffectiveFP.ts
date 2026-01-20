import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";
import { useOfficialTotals } from "./useOfficialTotals";
import { useEfpMode } from "./useEfpMode";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

export interface EffectiveFPResult {
  // The "true" totals combining official baseline + tracked since verification
  effectiveFp: number;
  effectivePrmr: number;
  effectiveKnockingDays: number;
  
  // Official baseline
  officialFp: number;
  officialPrmr: number;
  officialKnockingDays: number;
  
  // Tracked since last verification
  trackedFpSinceVerification: number;
  trackedPrmrSinceVerification: number;
  trackedKnockingDaysSinceVerification: number;
  
  // Total tracked (all time, for comparison)
  totalTrackedFp: number;
  totalTrackedPrmr: number;
  totalTrackedKnockingDays: number;
  
  // Discrepancy info
  hasDiscrepancy: boolean;
  discrepancyAmount: number; // positive = untracked sales, negative = over-tracked
  
  // Status
  lastVerifiedAt: string | null;
  daysSinceVerification: number | null;
  needsVerification: boolean;
  hasOfficialTotals: boolean;
}

interface UseEffectiveFPParams {
  seasonType: 'preseason' | 'summer';
  seasonStartDate: string;
  seasonEndDate: string;
}

export const useEffectiveFP = ({ seasonType, seasonStartDate, seasonEndDate }: UseEffectiveFPParams) => {
  const { userId, isReady } = useCurrentUserId();
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { data: officialTotalsData, isLoading: officialLoading } = useOfficialTotals(seasonType);

  const officialTotals = officialTotalsData?.find(t => t.season_type === seasonType);

  const query = useQuery({
    queryKey: ['effective-fp', userId, seasonType, seasonStartDate, seasonEndDate, officialTotals?.last_verified_at],
    enabled: isReady && !!userId && !officialLoading,
    queryFn: async (): Promise<EffectiveFPResult> => {
      if (!userId) throw new Error('No user ID');

      // Fetch all daily entries for the season
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, prmr, doors_knocked, work_start_time, work_end_time, is_finalized, sales_log')
        .eq('user_id', userId)
        .gte('entry_date', seasonStartDate)
        .lte('entry_date', seasonEndDate)
        .order('entry_date', { ascending: true });

      if (error) throw error;

      // Calculate knocking day (doors >= 4 AND work_start AND work_end)
      const isKnockingDay = (entry: typeof entries[0]): boolean => {
        return (entry.doors_knocked || 0) >= 4 && 
               !!entry.work_start_time && 
               !!entry.work_end_time;
      };

      // Calculate total tracked values
      let totalTrackedFp = 0;
      let totalTrackedPrmr = 0;
      let totalTrackedKnockingDays = 0;

      // Calculate tracked values since last verification
      let trackedFpSinceVerification = 0;
      let trackedPrmrSinceVerification = 0;
      let trackedKnockingDaysSinceVerification = 0;

      const lastVerifiedAt = officialTotals?.last_verified_at;
      const lastVerifiedDate = lastVerifiedAt ? new Date(lastVerifiedAt).toISOString().split('T')[0] : null;

      for (const entry of entries || []) {
        // Use sales_log for accurate calculation if available and not finalized
        let fp = entry.fp_plus || 0;
        let prmr = entry.prmr || 0;

        if (entry.sales_log && !entry.is_finalized) {
          const calculated = calculateFromSalesLog(entry.sales_log as any[]);
          fp = calculated.fp;
          prmr = calculated.prmr;
        }

        const isKnocking = isKnockingDay(entry);

        totalTrackedFp += fp;
        totalTrackedPrmr += prmr;
        if (isKnocking) totalTrackedKnockingDays++;

        // Only count entries after verification date
        if (!lastVerifiedDate || entry.entry_date > lastVerifiedDate) {
          trackedFpSinceVerification += fp;
          trackedPrmrSinceVerification += prmr;
          if (isKnocking) trackedKnockingDaysSinceVerification++;
        }
      }

      // Get official baseline (or 0 if not set)
      const officialFp = officialTotals?.fp_plus || 0;
      const officialPrmr = officialTotals?.prmr || 0;
      const officialKnockingDays = officialTotals?.knocking_days || 0;

      // Calculate effective totals
      // If we have official totals, use: official + tracked since verification
      // If no official totals, use: total tracked
      const hasOfficialTotals = !!officialTotals;
      
      const effectiveFp = hasOfficialTotals
        ? officialFp + trackedFpSinceVerification
        : totalTrackedFp;
      
      const effectivePrmr = hasOfficialTotals
        ? officialPrmr + trackedPrmrSinceVerification
        : totalTrackedPrmr;
      
      const effectiveKnockingDays = hasOfficialTotals
        ? officialKnockingDays + trackedKnockingDaysSinceVerification
        : totalTrackedKnockingDays;

      // Calculate discrepancy (if official is set)
      // Positive = user has untracked sales (official > tracked at verification time)
      // Negative = user over-tracked (tracked > official)
      const discrepancyAmount = hasOfficialTotals
        ? officialFp - (totalTrackedFp - trackedFpSinceVerification)
        : 0;
      const hasDiscrepancy = Math.abs(discrepancyAmount) >= 0.5; // Half an FP threshold

      // Calculate days since verification
      let daysSinceVerification: number | null = null;
      if (lastVerifiedAt) {
        daysSinceVerification = Math.floor(
          (Date.now() - new Date(lastVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)
        );
      }

      // Needs verification if: no official totals, OR > 7 days since last verification
      const needsVerification = !hasOfficialTotals || (daysSinceVerification !== null && daysSinceVerification > 7);

      return {
        effectiveFp,
        effectivePrmr,
        effectiveKnockingDays,
        officialFp,
        officialPrmr,
        officialKnockingDays,
        trackedFpSinceVerification,
        trackedPrmrSinceVerification,
        trackedKnockingDaysSinceVerification,
        totalTrackedFp,
        totalTrackedPrmr,
        totalTrackedKnockingDays,
        hasDiscrepancy,
        discrepancyAmount,
        lastVerifiedAt,
        daysSinceVerification,
        needsVerification,
        hasOfficialTotals,
      };
    },
    staleTime: 60 * 1000, // 1 minute
  });

  return {
    data: query.data,
    isLoading: query.isLoading || officialLoading,
    error: query.error,
  };
};
