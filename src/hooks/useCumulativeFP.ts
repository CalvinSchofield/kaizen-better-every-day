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
  isKnockingDay: boolean; // doors >= 5 AND work_start AND work_end set
  knockingDayNumber: number; // 1-indexed count of knocking days up to this point
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
        .select("entry_date, fp_plus, prmr, upgrade_prmr, is_finalized, doors_knocked, work_start_time, work_end_time")
        .eq("user_id", user.id)
        .eq("is_finalized", true)
        .order("entry_date", { ascending: true });

      if (error) throw error;

      if (!entries || entries.length === 0) return [];

      // A knocking day requires: doors_knocked >= 5 AND work_start_time set AND work_end_time set
      const isKnockingDay = (entry: typeof entries[0]): boolean => {
        return (entry.doors_knocked || 0) >= 5 && 
               !!entry.work_start_time && 
               !!entry.work_end_time;
      };

      // Filter to only knocking days for rolling averages
      const knockingEntries = entries.filter(isKnockingDay);

      // Build cumulative data points
      const dataPoints: CumulativeDataPoint[] = [];
      let cumulative = 0;
      let cumulativePrmr = 0;
      let cumulativeFp = 0;
      let knockingDayCount = 0;

      entries.forEach((entry, index) => {
        // prmr = FP sales PRMR, upgrade_prmr = upgrade sales PRMR
        // Total PRMR = prmr + upgrade_prmr
        // prmr field IS total PRMR (already includes upgrade_prmr)
        const totalPrmr = entry.prmr || 0;
        const fpValue = entry.fp_plus || 0;
        
        // Check if this is a knocking day
        const entryIsKnockingDay = isKnockingDay(entry);
        if (entryIsKnockingDay) {
          knockingDayCount++;
        }
        
        // EFP = total PRMR / 85
        const value = efpModeEnabled 
          ? calculateEfp(totalPrmr)
          : fpValue;
        
        cumulative += value;
        cumulativePrmr += totalPrmr;
        cumulativeFp += fpValue;

        // For rolling averages, only use knocking days up to current date
        const currentDate = entry.entry_date;
        const knockingEntriesUpToNow = knockingEntries.filter(e => e.entry_date <= currentDate);

        // Calculate 6-day moving average (last 6 knocking days)
        const last6 = knockingEntriesUpToNow.slice(-6);
        const movingAvg6 = last6.length >= 1
          ? last6.reduce((sum, e) => {
              const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp_plus || 0);
              return sum + v;
            }, 0) / last6.length
          : null;

        const movingAvgPrmr6 = last6.length >= 1
          ? last6.reduce((sum, e) => sum + (e.prmr || 0), 0) / last6.length
          : null;

        // Calculate 12-day moving average (last 12 knocking days)
        const last12 = knockingEntriesUpToNow.slice(-12);
        const movingAvg12 = last12.length >= 1
          ? last12.reduce((sum, e) => {
              const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp_plus || 0);
              return sum + v;
            }, 0) / last12.length
          : null;

        const movingAvgPrmr12 = last12.length >= 1
          ? last12.reduce((sum, e) => sum + (e.prmr || 0), 0) / last12.length
          : null;

        // Calculate FP+ moving averages (always actual FP+, not EFP)
        const movingAvgFp6 = last6.length >= 1
          ? last6.reduce((sum, e) => sum + (e.fp_plus || 0), 0) / last6.length
          : null;

        const movingAvgFp12 = last12.length >= 1
          ? last12.reduce((sum, e) => sum + (e.fp_plus || 0), 0) / last12.length
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
          isKnockingDay: entryIsKnockingDay,
          knockingDayNumber: knockingDayCount,
        });
      });

      return dataPoints;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
