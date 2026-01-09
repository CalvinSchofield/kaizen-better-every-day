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
  isPlannedFuture?: boolean; // true if this is a planned day that hasn't been worked yet
}

// Get today's date in user's local timezone
const getTodayInTimezone = (timezone: string | null): string => {
  try {
    const tz = timezone || 'America/Los_Angeles';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(now);
  } catch {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
};

export const useCumulativeFP = () => {
  const { efpModeEnabled, calculateEfp } = useEfpMode();

  return useQuery({
    queryKey: ["cumulative-fp", efpModeEnabled],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Fetch user's timezone and planned days in parallel
      const [entriesResult, repResult, plannedDaysResult] = await Promise.all([
        supabase
          .from("daily_entries")
          .select("entry_date, fp_plus, prmr, upgrade_prmr, is_finalized, doors_knocked, work_start_time, work_end_time")
          .eq("user_id", user.id)
          .eq("is_finalized", true)
          .order("entry_date", { ascending: true }),
        supabase
          .from("reps")
          .select("timezone")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("planned_work_days")
          .select("planned_date")
          .eq("user_id", user.id),
      ]);

      if (entriesResult.error) throw entriesResult.error;

      const entries = entriesResult.data || [];
      const userTimezone = repResult.data?.timezone || 'America/Los_Angeles';
      const plannedDates = new Set(plannedDaysResult.data?.map(p => p.planned_date) || []);
      const todayStr = getTodayInTimezone(userTimezone);
      
      // Check if today is in entries already
      const todayInEntries = entries.some(e => e.entry_date === todayStr);
      
      // Check if today is a planned day and not yet in finalized entries
      const todayIsPlanned = plannedDates.has(todayStr) && !todayInEntries;

      // A knocking day requires: doors_knocked >= 4 AND work_start_time set AND work_end_time set
      const isKnockingDay = (entry: typeof entries[0]): boolean => {
        return (entry.doors_knocked || 0) >= 4 && 
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

      // Add today as a placeholder if it's planned but not yet worked
      if (todayIsPlanned && dataPoints.length > 0) {
        const lastPoint = dataPoints[dataPoints.length - 1];
        dataPoints.push({
          date: todayStr,
          cumulative: lastPoint.cumulative,
          movingAvg6: lastPoint.movingAvg6,
          movingAvg12: lastPoint.movingAvg12,
          dailyValue: 0,
          cumulativePrmr: lastPoint.cumulativePrmr,
          movingAvgPrmr6: lastPoint.movingAvgPrmr6,
          movingAvgPrmr12: lastPoint.movingAvgPrmr12,
          dailyPrmr: 0,
          cumulativeFp: lastPoint.cumulativeFp,
          movingAvgFp6: lastPoint.movingAvgFp6,
          movingAvgFp12: lastPoint.movingAvgFp12,
          dailyFp: 0,
          isKnockingDay: false,
          knockingDayNumber: lastPoint.knockingDayNumber,
          isPlannedFuture: true,
        });
      }

      return dataPoints;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
