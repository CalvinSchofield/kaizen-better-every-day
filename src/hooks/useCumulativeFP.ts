import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEfpMode } from "./useEfpMode";

export type CumulativeDataPoint = {
  date: string;
  cumulative: number;
  movingAvg6: number | null;
  movingAvg12: number | null;
  dailyValue: number;
  cumulativePrmr: number;
  movingAvgPrmr6: number | null;
  movingAvgPrmr12: number | null;
  dailyPrmr: number;
  cumulativeFp: number; // Always track actual FP+ regardless of mode
  movingAvgFp6: number | null;
  movingAvgFp12: number | null;
  dailyFp: number;
}

export const useCumulativeFP = () => {
  const { efpModeEnabled, calculateEfp } = useEfpMode();

  return useQuery({
    queryKey: ["cumulative-fp", efpModeEnabled],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("entry_date, fp_plus, prmr, upgrade_prmr, is_finalized, doors_knocked")
        .eq("user_id", user.id)
        .eq("is_finalized", true)
        .order("entry_date", { ascending: true });

      if (error) throw error;

      if (!entries || entries.length === 0) return [];

      // Helper to determine if an entry is a "real knocking day" vs just a referral/result-only day
      // A real knocking day has: doors_knocked >= 10 OR has work_start_time AND work_end_time set
      const isRealKnockingDay = (entry: typeof entries[0]): boolean => {
        const hasMeaningfulActivity = (entry.doors_knocked || 0) >= 10;
        // Note: we don't have work_start_time in this query, so just use doors threshold
        return hasMeaningfulActivity;
      };

      // Filter to only real knocking days for rolling averages
      const realKnockingEntries = entries.filter(isRealKnockingDay);

      // Build cumulative data points
      const dataPoints: CumulativeDataPoint[] = [];
      let cumulative = 0;
      let cumulativePrmr = 0;
      let cumulativeFp = 0;

      entries.forEach((entry, index) => {
        // prmr = FP sales PRMR, upgrade_prmr = upgrade sales PRMR
        // Total PRMR = prmr + upgrade_prmr
        // prmr field IS total PRMR (already includes upgrade_prmr)
        const totalPrmr = entry.prmr || 0;
        const fpValue = entry.fp_plus || 0;
        
        // EFP = total PRMR / 85
        const value = efpModeEnabled 
          ? calculateEfp(totalPrmr)
          : fpValue;
        
        cumulative += value;
        cumulativePrmr += totalPrmr;
        cumulativeFp += fpValue;

        // For rolling averages, only use real knocking days up to current date
        const currentDate = entry.entry_date;
        const realEntriesUpToNow = realKnockingEntries.filter(e => e.entry_date <= currentDate);

        // Calculate 6-day moving average (last 6 REAL knocking days)
        const last6Real = realEntriesUpToNow.slice(-6);
        const movingAvg6 = last6Real.length >= 1
          ? last6Real.reduce((sum, e) => {
              const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp_plus || 0);
              return sum + v;
            }, 0) / last6Real.length
          : null;

        const movingAvgPrmr6 = last6Real.length >= 1
          ? last6Real.reduce((sum, e) => sum + (e.prmr || 0), 0) / last6Real.length
          : null;

        // Calculate 12-day moving average (last 12 REAL knocking days)
        const last12Real = realEntriesUpToNow.slice(-12);
        const movingAvg12 = last12Real.length >= 1
          ? last12Real.reduce((sum, e) => {
              const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp_plus || 0);
              return sum + v;
            }, 0) / last12Real.length
          : null;

        const movingAvgPrmr12 = last12Real.length >= 1
          ? last12Real.reduce((sum, e) => sum + (e.prmr || 0), 0) / last12Real.length
          : null;

        // Calculate FP+ moving averages (always actual FP+, not EFP)
        const movingAvgFp6 = last6Real.length >= 1
          ? last6Real.reduce((sum, e) => sum + (e.fp_plus || 0), 0) / last6Real.length
          : null;

        const movingAvgFp12 = last12Real.length >= 1
          ? last12Real.reduce((sum, e) => sum + (e.fp_plus || 0), 0) / last12Real.length
          : null;

        dataPoints.push({
          date: entry.entry_date,
          cumulative,
          movingAvg6,
          movingAvg12,
          dailyValue: value,
          cumulativePrmr,
          movingAvgPrmr6,
          movingAvgPrmr12,
          dailyPrmr: totalPrmr,
          cumulativeFp,
          movingAvgFp6,
          movingAvgFp12,
          dailyFp: fpValue,
        });
      });

      return dataPoints;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
