import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, isBefore, isAfter, isWithinInterval, parseISO, getDay } from "date-fns";

interface ActivitySummaryData {
  mode: "blitz" | "summer" | "preseason";
  title: string;
  subtitle?: string;
  dayNumber?: number;
  totals: {
    doors: number;
    transitions: number;
    fp: number;
    prmr: number;
  };
  dailyAverages: {
    doors: number;
    transitions: number;
    fp: number;
    prmr: number;
  };
  upfrontPay: number;
  comparison?: {
    fpChange: number;
    label: string;
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

      // Find active blitz
      const activeBlitz = committed_blitzes.find((blitz: any) => {
        if (!blitz.startDate || !blitz.endDate) return false;
        const start = parseISO(blitz.startDate);
        const end = parseISO(blitz.endDate);
        return isWithinInterval(now, { start, end });
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
        startDate = parseISO(activeBlitz.startDate);
        endDate = parseISO(activeBlitz.endDate);
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

      const totals = entries?.reduce(
        (acc, entry) => ({
          doors: acc.doors + (entry.doors_knocked || 0),
          transitions: acc.transitions + (entry.transitions || 0),
          fp: acc.fp + (Number(entry.fp_plus) || 0),
          prmr: acc.prmr + (Number(entry.prmr) || 0),
        }),
        { doors: 0, transitions: 0, fp: 0, prmr: 0 }
      ) || { doors: 0, transitions: 0, fp: 0, prmr: 0 };

      const daysWorked = entries?.length || 0;
      const isEmpty = daysWorked === 0;

      const dailyAverages = {
        doors: daysWorked > 0 ? totals.doors / daysWorked : 0,
        transitions: daysWorked > 0 ? totals.transitions / daysWorked : 0,
        fp: daysWorked > 0 ? totals.fp / daysWorked : 0,
        prmr: daysWorked > 0 ? totals.prmr / daysWorked : 0,
      };

      const upfrontPay = totals.prmr * 4;

      // Chart data (last 7 data points)
      const chartData = entries?.slice(-7).map((entry) => ({
        date: entry.entry_date,
        fp: Number(entry.fp_plus) || 0,
      })) || [];

      // Comparison logic
      let comparison: ActivitySummaryData["comparison"];

      if (mode === "blitz") {
        // Compare to previous blitz
        const previousBlitzes = committed_blitzes
          .filter((b: any) => b.endDate && isBefore(parseISO(b.endDate), now))
          .sort((a: any, b: any) => parseISO(b.endDate).getTime() - parseISO(a.endDate).getTime());

        if (previousBlitzes.length > 0) {
          const prevBlitz = previousBlitzes[0];
          const { data: prevEntries } = await supabase
            .from("daily_entries")
            .select("fp_plus")
            .eq("user_id", repData.user_id)
            .gte("entry_date", prevBlitz.startDate)
            .lte("entry_date", prevBlitz.endDate)
            .eq("is_finalized", true);

          const prevFp = prevEntries?.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0) || 0;
          comparison = {
            fpChange: totals.fp - prevFp,
            label: `vs last blitz`,
          };
        }
      } else if (mode === "summer") {
        // Compare to last week
        const lastWeekStart = startOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 1 });
        const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });

        const { data: lastWeekEntries } = await supabase
          .from("daily_entries")
          .select("fp_plus")
          .eq("user_id", repData.user_id)
          .gte("entry_date", format(lastWeekStart, "yyyy-MM-dd"))
          .lte("entry_date", format(lastWeekEnd, "yyyy-MM-dd"))
          .eq("is_finalized", true);

        const lastWeekFp = lastWeekEntries?.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0) || 0;
        comparison = {
          fpChange: totals.fp - lastWeekFp,
          label: "vs last week",
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
          ?.filter((e) => getDay(parseISO(e.entry_date)) === todayDayOfWeek)
          .sort((a, b) => b.entry_date.localeCompare(a.entry_date))[0];

        if (lastSameDayEntry) {
          const lastFp = Number(lastSameDayEntry.fp_plus) || 0;
          comparison = {
            fpChange: totals.fp - lastFp,
            label: `vs last ${dayNames[todayDayOfWeek]}`,
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
