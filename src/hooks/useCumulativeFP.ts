import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEfpMode } from "./useEfpMode";

export interface CumulativeDataPoint {
  date: string;
  cumulative: number;
  movingAvg6: number | null;
  movingAvg12: number | null;
  dailyValue: number;
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
        .select("entry_date, fp_plus, prmr, is_finalized")
        .eq("user_id", user.id)
        .eq("is_finalized", true)
        .order("entry_date", { ascending: true });

      if (error) throw error;

      if (!entries || entries.length === 0) return [];

      // Build cumulative data points
      const dataPoints: CumulativeDataPoint[] = [];
      let cumulative = 0;

      entries.forEach((entry, index) => {
        const value = efpModeEnabled 
          ? calculateEfp(entry.prmr || 0)
          : (entry.fp_plus || 0);
        
        cumulative += value;

        // Calculate 6-day moving average (last 6 days including current)
        const last6 = entries.slice(Math.max(0, index - 5), index + 1);
        const movingAvg6 = last6.length >= 1
          ? last6.reduce((sum, e) => {
              const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp_plus || 0);
              return sum + v;
            }, 0) / last6.length
          : null;

        // Calculate 12-day moving average (last 12 days including current)
        const last12 = entries.slice(Math.max(0, index - 11), index + 1);
        const movingAvg12 = last12.length >= 1
          ? last12.reduce((sum, e) => {
              const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp_plus || 0);
              return sum + v;
            }, 0) / last12.length
          : null;

        dataPoints.push({
          date: entry.entry_date,
          cumulative,
          movingAvg6,
          movingAvg12,
          dailyValue: value,
        });
      });

      return dataPoints;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
