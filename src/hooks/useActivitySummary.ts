import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, isBefore, isAfter, getDay } from "date-fns";

interface ActivitySummaryData {
  mode: "blitz" | "summer" | "preseason";
  title: string;
  subtitle?: string;
  dayNumber?: number;
  totals: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    fp: number;
    prmr: number;
  };
  dailyAverages: {
    doors: number;
    pitches: number;
    transitions: number;
    presentations: number;
    fp: number;
    prmr: number;
  };
  upfrontPay: number;
  comparison?: {
    fpChange: number;
    label: string;
    previousBlitzFp?: number;
    previousPeriodTotal?: number;
    previousDaysWorked?: number;
    showComparison: boolean;
  };
  chartData: Array<{ date: string; fp: number }>;
  daysWorked: number;
  isEmpty: boolean;
}

const PRESEASON_START = new Date("2025-09-28");
const PRESEASON_END = new Date("2026-04-11");
const SUMMER_START = new Date("2026-04-12");

export const useActivitySummary = (repData: any) => {
  return useQuery({
    queryKey: ["activity-summary", repData?.user_id],
    queryFn: async (): Promise<ActivitySummaryData> => {
      if (!repData?.user_id) {
        throw new Error("No user data");
      }

      const now = new Date();
      const committed_blitzes = repData.committed_blitzes || [];

      // Find active blitz (4 PM start on startDate, 10 AM end on endDate)
      const activeBlitz = committed_blitzes.find((blitz: any) => {
        if (!blitz.date || !blitz.endDate) return false;
        
        // Parse dates in local timezone
        const startDate = new Date(blitz.date + 'T00:00:00');
        startDate.setHours(16, 0, 0, 0); // 4pm start
        
        const endDate = new Date(blitz.endDate + 'T00:00:00');
        endDate.setHours(10, 0, 0, 0); // 10am end
        
        return now >= startDate && now <= endDate;
      });

      // Determine mode
      let mode: "blitz" | "summer" | "preseason" = "preseason";
      if (activeBlitz) {
        mode = "blitz";
      } else if (isAfter(now, PRESEASON_END)) {
        mode = "summer";
      }

      let startDate: Date;
      let endDate: Date;
      let title: string;
      let subtitle: string | undefined;
      let dayNumber: number | undefined;

      if (mode === "blitz") {
        startDate = new Date(activeBlitz.date + 'T00:00:00');
        endDate = new Date(activeBlitz.endDate + 'T00:00:00');
        const daysIntoBlitz = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        dayNumber = daysIntoBlitz;
        title = `This Blitz — Day ${daysIntoBlitz}`;
        subtitle = activeBlitz.name || activeBlitz.location;
      } else if (mode === "summer") {
        startDate = startOfWeek(now, { weekStartsOn: 1 });
        endDate = endOfWeek(now, { weekStartsOn: 1 });
        title = "This Week";
      } else {
        // Preseason mode - Today + totals
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = startDate;
        title = "Today";
      }

      // Fetch entries for the period
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", repData.user_id)
        .gte("entry_date", format(startDate, "yyyy-MM-dd"))
        .lte("entry_date", format(endDate, "yyyy-MM-dd"))
        .eq("is_finalized", true)
        .order("entry_date", { ascending: true });

      if (error) throw error;

      // Filter out Sundays from entries
      const workdayEntries = entries?.filter(entry => {
        const entryDate = new Date(entry.entry_date + 'T00:00:00');
        return getDay(entryDate) !== 0; // 0 = Sunday
      }) || [];

      const totals = workdayEntries.reduce(
        (acc, entry) => ({
          doors: acc.doors + (entry.doors_knocked || 0),
          pitches: acc.pitches + (entry.pitches || 0),
          transitions: acc.transitions + (entry.transitions || 0),
          presentations: acc.presentations + (entry.presentations || 0),
          fp: acc.fp + (Number(entry.fp_plus) || 0),
          prmr: acc.prmr + (Number(entry.prmr) || 0),
        }),
        { doors: 0, pitches: 0, transitions: 0, presentations: 0, fp: 0, prmr: 0 }
      );

      const daysWorked = workdayEntries.length;
      const isEmpty = daysWorked === 0;

      const dailyAverages = {
        doors: daysWorked > 0 ? totals.doors / daysWorked : 0,
        pitches: daysWorked > 0 ? totals.pitches / daysWorked : 0,
        transitions: daysWorked > 0 ? totals.transitions / daysWorked : 0,
        presentations: daysWorked > 0 ? totals.presentations / daysWorked : 0,
        fp: daysWorked > 0 ? totals.fp / daysWorked : 0,
        prmr: daysWorked > 0 ? totals.prmr / daysWorked : 0,
      };

      const upfrontPay = totals.prmr * 4;

      // Chart data (last 7 data points, excluding Sundays)
      const chartData = workdayEntries.slice(-7).map((entry) => ({
        date: entry.entry_date,
        fp: Number(entry.fp_plus) || 0,
      }));

      // Comparison logic
      let comparison: ActivitySummaryData["comparison"];

      if (mode === "blitz") {
        // Compare to previous blitz (day-aligned)
        const previousBlitzes = committed_blitzes
          .filter((b: any) => b.endDate && isBefore(new Date(b.endDate + 'T00:00:00'), now))
          .sort((a: any, b: any) => new Date(b.endDate + 'T00:00:00').getTime() - new Date(a.endDate + 'T00:00:00').getTime());

        if (previousBlitzes.length > 0) {
          const prevBlitz = previousBlitzes[0];
          const prevBlitzStart = new Date(prevBlitz.date + 'T00:00:00');
          
          // Get full previous blitz stats first
          const { data: prevFullEntries } = await supabase
            .from("daily_entries")
            .select("*")
            .eq("user_id", repData.user_id)
            .gte("entry_date", prevBlitz.date)
            .lte("entry_date", prevBlitz.endDate)
            .eq("is_finalized", true);

          const prevFullWorkdayEntries = prevFullEntries?.filter(entry => {
            const entryDate = new Date(entry.entry_date + 'T00:00:00');
            return getDay(entryDate) !== 0; // Exclude Sundays
          }) || [];

          const prevBlitzTotalFp = prevFullWorkdayEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
          const prevBlitzDaysWorked = prevFullWorkdayEntries.length;
          
          // Calculate day-aligned comparison for same number of days
          const currentBlitzDays = daysWorked;
          const prevDayAlignedEntries = prevFullWorkdayEntries.slice(0, currentBlitzDays);
          const prevDayAlignedFp = prevDayAlignedEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
          
          comparison = {
            fpChange: totals.fp - prevDayAlignedFp,
            label: `day ${currentBlitzDays} last blitz`,
            previousBlitzFp: prevBlitzTotalFp,
            previousPeriodTotal: prevBlitzTotalFp,
            previousDaysWorked: prevBlitzDaysWorked,
            showComparison: currentBlitzDays <= prevBlitzDaysWorked,
          };
        }
      } else if (mode === "summer") {
        // Compare to last week (day-aligned)
        const lastWeekStart = startOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
        
        // Get full last week data first
        const { data: lastWeekFullEntries } = await supabase
          .from("daily_entries")
          .select("*")
          .eq("user_id", repData.user_id)
          .gte("entry_date", format(lastWeekStart, "yyyy-MM-dd"))
          .lte("entry_date", format(lastWeekEnd, "yyyy-MM-dd"))
          .eq("is_finalized", true);

        const lastWeekFullWorkdayEntries = lastWeekFullEntries?.filter(entry => {
          const entryDate = new Date(entry.entry_date + 'T00:00:00');
          return getDay(entryDate) !== 0;
        }) || [];

        const lastWeekTotalFp = lastWeekFullWorkdayEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
        const lastWeekDaysWorked = lastWeekFullWorkdayEntries.length;
        
        // Day-aligned comparison
        const currentWeekDays = daysWorked;
        const lastWeekDayAlignedEntries = lastWeekFullWorkdayEntries.slice(0, currentWeekDays);
        const lastWeekDayAlignedFp = lastWeekDayAlignedEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
        
        comparison = {
          fpChange: totals.fp - lastWeekDayAlignedFp,
          label: `day ${currentWeekDays} last week`,
          previousPeriodTotal: lastWeekTotalFp,
          previousDaysWorked: lastWeekDaysWorked,
          showComparison: currentWeekDays <= lastWeekDaysWorked,
        };
      } else if (mode === "preseason" && daysWorked > 0) {
        // Compare to last same day of week
        const todayDayOfWeek = getDay(now);
        const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

        const { data: sameDayEntries } = await supabase
          .from("daily_entries")
          .select("*")
          .eq("user_id", repData.user_id)
          .lt("entry_date", format(now, "yyyy-MM-dd"))
          .eq("is_finalized", true);

        const lastSameDayEntry = sameDayEntries
          ?.filter((e) => getDay(new Date(e.entry_date + 'T00:00:00')) === todayDayOfWeek)
          .sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0];

        if (lastSameDayEntry) {
          const lastFp = Number(lastSameDayEntry.fp_plus) || 0;
          comparison = {
            fpChange: totals.fp - lastFp,
            label: `vs last ${dayNames[todayDayOfWeek]}`,
            showComparison: true,
          };
        }
      }

      return {
        mode,
        title,
        subtitle,
        dayNumber,
        totals,
        dailyAverages,
        upfrontPay,
        comparison,
        chartData,
        daysWorked,
        isEmpty,
      };
    },
    enabled: !!repData?.user_id,
  });
};
