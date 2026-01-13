import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, isBefore, isAfter, getDay } from "date-fns";
import { calculateUpfrontPay } from "@/utils/roiCalculations";

interface ActivitySummaryData {
  mode: "blitz" | "summer" | "preseason";
  title: string;
  subtitle?: string;
  dayNumber?: number;
  totals: {
    doors: number;
    pitches: number;
    decisionMakers: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    upgradePrmr: number;
    moneySpent: number;
  };
  dailyAverages: {
    doors: number;
    pitches: number;
    decisionMakers: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
  };
  upfrontPay: number;
  totalMoneySpent: number;
  comparison?: {
    fpChange: number;
    prmrChange: number;
    label: string;
    previousBlitzFp?: number;
    previousPeriodTotal?: number;
    previousPeriodPrmr?: number;
    previousDayAlignedPrmr?: number;
    previousDaysWorked?: number;
    showComparison: boolean;
  };
  chartData: Array<{ date: string; fp: number }>;
  comparisonChartData?: {
    current: Array<{ day: number; value: number }>;
    previous: Array<{ day: number; value: number }>;
    currentLabel: string;
    previousLabel: string;
  };
  daysWorked: number;
  isEmpty: boolean;
}

const PRESEASON_START = new Date("2025-09-28");
const PRESEASON_END = new Date("2026-04-11");
const SUMMER_START = new Date("2026-04-12");

export const useActivitySummary = (repData: any) => {
  return useQuery({
    queryKey: ["activity-summary", repData?.user_id],
    staleTime: 30 * 1000, // 30 seconds - ensures quick refresh after mutations
    queryFn: async (): Promise<ActivitySummaryData> => {
      if (!repData?.user_id) {
        throw new Error("No user data");
      }

      const now = new Date();
      const committed_blitzes = repData.committed_blitzes || [];

      // Find active blitz - check if today falls within blitz date range
      const activeBlitz = committed_blitzes.find((blitz: any) => {
        if (!blitz.date || !blitz.endDate) return false;
        
        // Parse dates robustly - handle both "2025-12-04" and ISO strings
        const dateStr = typeof blitz.date === 'string' ? blitz.date.split('T')[0] : blitz.date;
        const endDateStr = typeof blitz.endDate === 'string' ? blitz.endDate.split('T')[0] : blitz.endDate;
        
        // Create dates at midnight for comparison (full day inclusion)
        const blitzStartDate = new Date(dateStr + 'T00:00:00');
        const blitzEndDate = new Date(endDateStr + 'T23:59:59');
        
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // User is on blitz if today falls within the blitz date range (inclusive)
        return todayMidnight >= blitzStartDate && todayMidnight <= blitzEndDate;
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
        
        // Calculate knocking day number - we'll update this after fetching entries
        // to show the actual last worked day number
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Helper to calculate knocking day number for a date (excluding Sundays)
        const getKnockingDayForDate = (targetDate: Date): number => {
          let knockingDay = 0;
          let currentDate = new Date(startDate);
          
          while (currentDate <= targetDate) {
            if (getDay(currentDate) !== 0) { // Skip Sundays
              knockingDay++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          return knockingDay;
        };
        
        // Calculate what today's knocking day number would be
        let todayKnockingDay = getKnockingDayForDate(todayMidnight);
        
        // If today is Sunday, use the previous knocking day
        if (getDay(todayMidnight) === 0) {
          const yesterday = new Date(todayMidnight);
          yesterday.setDate(yesterday.getDate() - 1);
          todayKnockingDay = getKnockingDayForDate(yesterday);
        }
        
        // Store for later - we'll update dayNumber after checking if today has activity
        dayNumber = Math.max(1, todayKnockingDay);
        title = `This Blitz — Day ${dayNumber}`;
        subtitle = activeBlitz.name || activeBlitz.location;
      } else if (mode === "summer") {
        // Summer weeks run Sunday to Saturday
        startDate = startOfWeek(now, { weekStartsOn: 0 });
        endDate = endOfWeek(now, { weekStartsOn: 0 });
        title = "This Week";
      } else {
        // Preseason mode - Today + totals
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        endDate = startDate;
        title = "Today";
      }

      // Fetch ALL entries for the period (finalized + unfinalized for live data)
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("*")
        .eq("user_id", repData.user_id)
        .gte("entry_date", format(startDate, "yyyy-MM-dd"))
        .lte("entry_date", format(endDate, "yyyy-MM-dd"))
        .order("entry_date", { ascending: true });

      if (error) throw error;

      // Filter out Sundays from entries
      const workdayEntries = entries?.filter(entry => {
        const entryDate = new Date(entry.entry_date + 'T00:00:00');
        return getDay(entryDate) !== 0; // 0 = Sunday
      }) || [];

      // Helper to calculate FP+, PRMR, and money spent from sales_log
      const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number; moneySpent: number } => {
        if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0, moneySpent: 0 };
        
        let fp = 0;
        let prmr = 0;
        let moneySpent = 0;
        
        for (const sale of salesLog) {
          // Always count money spent regardless of install status
          moneySpent += Number(sale.money_spent) || 0;
          
          // Skip sales that were never installed for FP/PRMR
          if (sale.install_status === 'never_installed') continue;
          
          const salePrmr = Number(sale.prmr) || 0;
          prmr += salePrmr;
          
          if (sale.type === 'fp') {
            fp += 1;
          } else if (sale.type === 'upgrade') {
            fp += salePrmr / 85; // Upgrade FP+ = PRMR / 85
          }
        }
        
        return { fp, prmr, moneySpent };
      };

      // Include all entries (finalized + today's unfinalized) for live totals
      // For unfinalized entries, calculate FP+/PRMR from sales_log if available
      const totals = workdayEntries.reduce(
        (acc, entry) => {
          let fp: number;
          let prmr: number;
          let upgradePrmr: number;
          let moneySpent: number = 0;
          
          // Calculate money spent from sales_log for all entries
          const salesLog = entry.sales_log as any[];
          if (salesLog && Array.isArray(salesLog)) {
            for (const sale of salesLog) {
              moneySpent += Number(sale.money_spent) || 0;
            }
          }
          
          if (entry.is_finalized) {
            // Finalized: use saved column values
            // prmr = FP sales PRMR, upgrade_prmr = upgrade sales PRMR
            fp = Number(entry.fp_plus) || 0;
            prmr = Number(entry.prmr) || 0;
            upgradePrmr = Number(entry.upgrade_prmr) || 0;
          } else {
            // Unfinalized: prioritize sales_log if it has entries (supports edits/deletes)
            const fromLog = calculateFromSalesLog(salesLog);
            const fromColumnFp = Number(entry.fp_plus) || 0;
            const fromColumnPrmr = Number(entry.prmr) || 0;
            // Use sales_log calculation if there are sales, otherwise use column
            fp = (salesLog && salesLog.length > 0) ? fromLog.fp : fromColumnFp;
            prmr = (salesLog && salesLog.length > 0) ? fromLog.prmr : fromColumnPrmr;
            upgradePrmr = 0; // Not yet saved for unfinalized entries
          }
          
          return {
            doors: acc.doors + (entry.doors_knocked || 0),
            pitches: acc.pitches + (entry.pitches || 0),
            decisionMakers: acc.decisionMakers + (entry.decision_makers || 0),
            transitions: acc.transitions + (entry.transitions || 0),
            presentations: acc.presentations + (entry.presentations || 0),
            closes: acc.closes + (entry.closes || 0),
            fp: acc.fp + fp,
            prmr: acc.prmr + prmr,
            upgradePrmr: acc.upgradePrmr + upgradePrmr,
            moneySpent: acc.moneySpent + moneySpent,
          };
        },
        { doors: 0, pitches: 0, decisionMakers: 0, transitions: 0, presentations: 0, closes: 0, fp: 0, prmr: 0, upgradePrmr: 0, moneySpent: 0 }
      );

      // Count entries with any activity as "days worked"
      const daysWorked = workdayEntries.filter(entry => 
        (entry.doors_knocked || 0) > 0 || 
        (entry.pitches || 0) > 0 || 
        (entry.transitions || 0) > 0 || 
        (entry.presentations || 0) > 0 ||
        (Number(entry.fp_plus) || 0) > 0
      ).length;
      const isEmpty = workdayEntries.length === 0;
      
      // For blitz mode: Update dayNumber and title based on actual worked days
      // If today has no activity yet, show the last worked day number
      if (mode === "blitz" && dayNumber !== undefined) {
        // Find the latest entry with activity to determine if we've worked today
        const entriesWithActivity = workdayEntries.filter(e => 
          (e.doors_knocked || 0) > 0 || 
          (e.pitches || 0) > 0 ||
          (e.transitions || 0) > 0 ||
          (e.presentations || 0) > 0 ||
          (Number(e.fp_plus) || 0) > 0
        );
        
        if (entriesWithActivity.length > 0) {
          // We have activity - show the knocking day of the latest entry with activity
          const latestEntryDate = entriesWithActivity[entriesWithActivity.length - 1].entry_date;
          const latestDate = new Date(latestEntryDate + 'T00:00:00');
          
          // Recalculate knocking day for latest entry date
          let latestKnockingDay = 0;
          let currentDate = new Date(startDate);
          while (currentDate <= latestDate) {
            if (getDay(currentDate) !== 0) {
              latestKnockingDay++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          dayNumber = Math.max(1, latestKnockingDay);
          title = `This Blitz — Day ${dayNumber}`;
        }
      }

      const dailyAverages = {
        doors: daysWorked > 0 ? totals.doors / daysWorked : 0,
        pitches: daysWorked > 0 ? totals.pitches / daysWorked : 0,
        decisionMakers: daysWorked > 0 ? totals.decisionMakers / daysWorked : 0,
        transitions: daysWorked > 0 ? totals.transitions / daysWorked : 0,
        presentations: daysWorked > 0 ? totals.presentations / daysWorked : 0,
        closes: daysWorked > 0 ? totals.closes / daysWorked : 0,
        fp: daysWorked > 0 ? totals.fp / daysWorked : 0,
        prmr: daysWorked > 0 ? totals.prmr / daysWorked : 0,
      };

      // Upfront pay is based on TOTAL PRMR (prmr field already IS total PRMR)
      const upfrontPay = calculateUpfrontPay(totals.prmr);

      // Chart data (last 7 data points, excluding Sundays)
      const chartData = workdayEntries.slice(-7).map((entry) => ({
        date: entry.entry_date,
        fp: Number(entry.fp_plus) || 0,
      }));

      // Comparison logic
      let comparison: ActivitySummaryData["comparison"];
      let comparisonChartData: ActivitySummaryData["comparisonChartData"];

      if (mode === "blitz") {
        // Compare to previous blitz (day-aligned using actual blitz day number)
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
            .lte("entry_date", prevBlitz.endDate);

          const prevFullWorkdayEntries = prevFullEntries?.filter(entry => {
            const entryDate = new Date(entry.entry_date + 'T00:00:00');
            return getDay(entryDate) !== 0; // Exclude Sundays
          }) || [];

          const prevBlitzTotalFp = prevFullWorkdayEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
          // prmr field IS total PRMR (already includes upgrade_prmr as subset)
          const prevBlitzTotalPrmr = prevFullWorkdayEntries.reduce((sum, e) => sum + (Number(e.prmr) || 0), 0);
          const prevBlitzDaysWorked = prevFullWorkdayEntries.length;
          
          // Use actual dayNumber for cumulative comparison (day 1+2 vs day 1+2)
          // dayNumber represents "which day of the blitz we're on" regardless of entries
          const currentBlitzDayNum = dayNumber || 1;
          const prevDayAlignedEntries = prevFullWorkdayEntries
            .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
            .slice(0, currentBlitzDayNum);
          const prevDayAlignedFp = prevDayAlignedEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
          const prevDayAlignedPrmr = prevDayAlignedEntries.reduce((sum, e) => sum + (Number(e.prmr) || 0), 0);
          
          comparison = {
            fpChange: totals.fp - prevDayAlignedFp,
            prmrChange: totals.prmr - prevDayAlignedPrmr,
            label: currentBlitzDayNum === 1 ? `day 1 last blitz` : `days 1-${currentBlitzDayNum} last blitz`,
            previousBlitzFp: prevBlitzTotalFp,
            previousPeriodTotal: prevBlitzTotalFp,
            previousPeriodPrmr: prevBlitzTotalPrmr,
            previousDayAlignedPrmr: prevDayAlignedPrmr,
            previousDaysWorked: prevBlitzDaysWorked,
            showComparison: currentBlitzDayNum <= prevBlitzDaysWorked,
          };

          // Build comparison chart data for blitz (day-by-day FP+ or PRMR for EFP calc)
          // Use knocking day number (excluding Sundays) for chart x-axis
          const sortedCurrentEntries = workdayEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
          const sortedPrevEntries = prevFullWorkdayEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
          
          // Only show data up to the current blitz day number
          const maxDayToShow = currentBlitzDayNum;
          
          // Helper to get FP+ and PRMR from entry (using sales_log for unfinalized)
          const getEntryMetrics = (e: any) => {
            if (e.is_finalized) {
              return {
                fp: Number(e.fp_plus) || 0,
                prmr: Number(e.prmr) || 0,
              };
            }
            // Unfinalized: calculate from sales_log if available
            const fromLog = calculateFromSalesLog(e.sales_log as any[]);
            const hasSalesLog = e.sales_log && Array.isArray(e.sales_log) && e.sales_log.length > 0;
            return {
              fp: hasSalesLog ? fromLog.fp : (Number(e.fp_plus) || 0),
              prmr: hasSalesLog ? fromLog.prmr : (Number(e.prmr) || 0),
            };
          };
          
          // Helper to calculate knocking day number (excluding Sundays)
          const getKnockingDayNum = (entryDateStr: string, blitzStartDate: Date): number => {
            const entryDate = new Date(entryDateStr + 'T00:00:00');
            let knockingDay = 0;
            let currentDate = new Date(blitzStartDate);
            
            while (currentDate <= entryDate) {
              if (getDay(currentDate) !== 0) { // Skip Sundays
                knockingDay++;
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
            return knockingDay;
          };
          
          comparisonChartData = {
            current: sortedCurrentEntries.map((e) => {
              const dayNum = getKnockingDayNum(e.entry_date, startDate);
              const metrics = getEntryMetrics(e);
              return {
                day: dayNum,
                value: metrics.fp,
                prmr: metrics.prmr,
                upgradePrmr: Number(e.upgrade_prmr) || 0,
              };
            }).filter(d => d.day <= maxDayToShow),
            previous: sortedPrevEntries.map((e) => {
              const dayNum = getKnockingDayNum(e.entry_date, prevBlitzStart);
              return {
                day: dayNum,
                value: Number(e.fp_plus) || 0,
                prmr: Number(e.prmr) || 0,
                upgradePrmr: Number(e.upgrade_prmr) || 0,
              };
            }).filter(d => d.day <= maxDayToShow),
            currentLabel: "This Blitz",
            previousLabel: "Last Blitz",
          };
        }
      } else if (mode === "summer") {
        // Compare to last week (day-aligned) - Summer weeks run Sunday to Saturday
        const lastWeekStart = startOfWeek(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 0 });
        const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 0 });
        
        // Get full last week data (including unfinalized)
        const { data: lastWeekFullEntries } = await supabase
          .from("daily_entries")
          .select("*")
          .eq("user_id", repData.user_id)
          .gte("entry_date", format(lastWeekStart, "yyyy-MM-dd"))
          .lte("entry_date", format(lastWeekEnd, "yyyy-MM-dd"));

        const lastWeekFullWorkdayEntries = lastWeekFullEntries?.filter(entry => {
          const entryDate = new Date(entry.entry_date + 'T00:00:00');
          return getDay(entryDate) !== 0;
        }) || [];

        const lastWeekTotalFp = lastWeekFullWorkdayEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
        // prmr field IS total PRMR (already includes upgrade_prmr as subset)
        const lastWeekTotalPrmr = lastWeekFullWorkdayEntries.reduce((sum, e) => sum + (Number(e.prmr) || 0), 0);
        const lastWeekDaysWorked = lastWeekFullWorkdayEntries.length;
        
        // Day-aligned comparison
        const currentWeekDays = daysWorked;
        const lastWeekDayAlignedEntries = lastWeekFullWorkdayEntries.slice(0, currentWeekDays);
        const lastWeekDayAlignedFp = lastWeekDayAlignedEntries.reduce((sum, e) => sum + (Number(e.fp_plus) || 0), 0);
        const lastWeekDayAlignedPrmr = lastWeekDayAlignedEntries.reduce((sum, e) => sum + (Number(e.prmr) || 0), 0);
        
        comparison = {
          fpChange: totals.fp - lastWeekDayAlignedFp,
          prmrChange: totals.prmr - lastWeekDayAlignedPrmr,
          label: `day ${currentWeekDays} last week`,
          previousPeriodTotal: lastWeekTotalFp,
          previousPeriodPrmr: lastWeekTotalPrmr,
          previousDayAlignedPrmr: lastWeekDayAlignedPrmr,
          previousDaysWorked: lastWeekDaysWorked,
          showComparison: currentWeekDays <= lastWeekDaysWorked,
        };

        // Build comparison chart data for summer (day-by-day using actual week day number)
        const sortedCurrentEntries = workdayEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
        const sortedPrevEntries = lastWeekFullWorkdayEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
        
        // Helper to get FP+ and PRMR from entry (using sales_log for unfinalized)
        const getEntryMetrics = (e: any) => {
          if (e.is_finalized) {
            return {
              fp: Number(e.fp_plus) || 0,
              prmr: Number(e.prmr) || 0,
            };
          }
          // Unfinalized: calculate from sales_log if available
          const fromLog = calculateFromSalesLog(e.sales_log as any[]);
          const hasSalesLog = e.sales_log && Array.isArray(e.sales_log) && e.sales_log.length > 0;
          return {
            fp: hasSalesLog ? fromLog.fp : (Number(e.fp_plus) || 0),
            prmr: hasSalesLog ? fromLog.prmr : (Number(e.prmr) || 0),
          };
        };
        
        // Week starts Sunday = 0, so Monday = 1, Saturday = 6
        comparisonChartData = {
          current: sortedCurrentEntries.map((e) => {
            const entryDate = new Date(e.entry_date + 'T00:00:00');
            const dayOfWeek = getDay(entryDate); // 0=Sun, 1=Mon, ..., 6=Sat
            const metrics = getEntryMetrics(e);
            return {
              day: dayOfWeek === 0 ? 7 : dayOfWeek, // Treat Sunday as 7 for sorting
              value: metrics.fp,
              prmr: metrics.prmr,
              upgradePrmr: Number(e.upgrade_prmr) || 0,
            };
          }),
          previous: sortedPrevEntries.map((e) => {
            const entryDate = new Date(e.entry_date + 'T00:00:00');
            const dayOfWeek = getDay(entryDate);
            return {
              day: dayOfWeek === 0 ? 7 : dayOfWeek,
              value: Number(e.fp_plus) || 0,
              prmr: Number(e.prmr) || 0,
              upgradePrmr: Number(e.upgrade_prmr) || 0,
            };
          }),
          currentLabel: "This Week",
          previousLabel: "Last Week",
        };
      } else if (mode === "preseason" && workdayEntries.length > 0) {
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
          const lastPrmr = Number(lastSameDayEntry.prmr) || 0;
          comparison = {
            fpChange: totals.fp - lastFp,
            prmrChange: totals.prmr - lastPrmr,
            label: `vs last ${dayNames[todayDayOfWeek]}`,
            previousDayAlignedPrmr: lastPrmr,
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
        totalMoneySpent: totals.moneySpent,
        comparison,
        chartData,
        comparisonChartData,
        daysWorked,
        isEmpty,
      };
    },
    enabled: !!repData?.user_id,
  });
};
