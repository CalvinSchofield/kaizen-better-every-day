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
  officialKnockingDays: number | null; // null = unknown baseline
  
  // Tracked since last verification
  trackedFpSinceVerification: number;
  trackedPrmrSinceVerification: number;
  trackedKnockingDaysSinceVerification: number;
  
  // Total tracked (all time, for comparison)
  totalTrackedFp: number;
  totalTrackedPrmr: number;
  totalTrackedKnockingDays: number;
  totalTrackedFpSold: number; // Count of type==='fp' sales (families protected)
  effectiveFpSold: number; // Official baseline FP sold + tracked since verification
  
  // Pending (scheduled-out) sales — included in totals but not yet on Curator
  totalPendingFp: number;
  totalPendingPrmr: number;
  totalPendingFpSold: number;
  
  // Discrepancy info
  hasDiscrepancy: boolean;
  discrepancyAmount: number; // positive = untracked sales, negative = over-tracked
  
  // Knocking days status
  knockingDaysUnknown: boolean; // true when official knocking_days is null
  
  // Status
  lastVerifiedAt: string | null;
  daysSinceVerification: number | null;
  needsVerification: boolean;
  needsBiweeklySync: boolean; // true when biweekly sync window is open
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
      let totalTrackedFpSold = 0;
      let totalPendingFp = 0;
      let totalPendingPrmr = 0;
      let totalPendingFpSold = 0;

      // Calculate tracked values since last verification
      let trackedFpSinceVerification = 0;
      let trackedPrmrSinceVerification = 0;
      let trackedKnockingDaysSinceVerification = 0;

      const lastVerifiedAt = officialTotals?.last_verified_at;
      const lastVerifiedDate = lastVerifiedAt ? new Date(lastVerifiedAt).toISOString().split('T')[0] : null;

      for (const entry of entries || []) {
        // Always prioritize sales_log if it has entries (regardless of finalization)
        const salesLog = entry.sales_log as any[];
        const hasSalesLog = salesLog && salesLog.length > 0;
        let fp: number;
        let prmr: number;
        let fpSoldCount = 0;
        if (hasSalesLog) {
          const calculated = calculateFromSalesLog(salesLog);
          fp = calculated.fp;
          prmr = calculated.prmr;
          totalPendingFp += calculated.pendingFp;
          totalPendingPrmr += calculated.pendingPrmr;
          // Count FP sold (type === 'fp', excluding never_installed)
          const fpSales = salesLog.filter((s: any) => 
            s.type === 'fp' && s.install_status !== 'never_installed' && s.install_status !== 'cancelled' && s.install_status !== 'canceled'
          );
          fpSoldCount = fpSales.length;
          totalPendingFpSold += fpSales.filter((s: any) => s.install_status === 'pending').length;
        } else {
          fp = entry.fp_plus || 0;
          prmr = entry.prmr || 0;
        }

        const isKnocking = isKnockingDay(entry);

        totalTrackedFp += fp;
        totalTrackedPrmr += prmr;
        totalTrackedFpSold += fpSoldCount;
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
      const officialKnockingDays: number | null = officialTotals?.knocking_days ?? null;

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
      
      // When official knocking days is null (unknown), only use tracked since verification
      const knockingDaysUnknown = hasOfficialTotals && officialKnockingDays === null;
      const effectiveKnockingDays = hasOfficialTotals
        ? (officialKnockingDays ?? 0) + trackedKnockingDaysSinceVerification
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

      // Biweekly sync check: anchored to epoch Sunday (Sept 28, 2025)
      // Every other Sunday at 6am local time, sync is required
      const EPOCH_SUNDAY = new Date('2025-09-28T00:00:00');
      const now = new Date();
      const daysSinceEpoch = Math.floor((now.getTime() - EPOCH_SUNDAY.getTime()) / (1000 * 60 * 60 * 24));
      const weeksSinceEpoch = Math.floor(daysSinceEpoch / 7);
      const isSyncWeek = weeksSinceEpoch % 2 === 0;
      
      // Check if last_verified_at is within the current sync window (last 13 days)
      const syncWindowDays = 13;
      const isRecentlyVerified = daysSinceVerification !== null && daysSinceVerification <= syncWindowDays;
      const needsBiweeklySync = hasOfficialTotals && isSyncWeek && !isRecentlyVerified;

      // Needs verification if: no official totals, OR biweekly sync is due
      const needsVerification = !hasOfficialTotals || needsBiweeklySync;

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
        totalTrackedFpSold,
        totalPendingFp,
        totalPendingPrmr,
        totalPendingFpSold,
        hasDiscrepancy,
        discrepancyAmount,
        knockingDaysUnknown,
        lastVerifiedAt,
        daysSinceVerification,
        needsVerification,
        needsBiweeklySync,
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
