import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
  isSaturday?: boolean;
}

interface YesterdayLeaderboard {
  mostDoors: LeaderboardEntry | null;
  mostDecisionMakers: LeaderboardEntry | null;
  mostPitches: LeaderboardEntry | null;
  mostTransitions: LeaderboardEntry | null;
  mostPresentations: LeaderboardEntry | null;
  mostFP: LeaderboardEntry | null;
  mostPRMR: LeaderboardEntry | null;
  mostUpgradeFP: LeaderboardEntry | null;
  mostUpgradePRMR: LeaderboardEntry | null;
  mostHoursWorked: LeaderboardEntry | null;
  earliestDoor: LeaderboardEntry | null;
  latestDoor: LeaderboardEntry | null;
}

// Extract local time-of-day as minutes since midnight
const getLocalMinutesOfDay = (timestamp: string, timezone: string): number => {
  try {
    const date = new Date(timestamp);
    const localTime = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(date);
    const [hours, minutes] = localTime.split(':').map(Number);
    return hours * 60 + minutes;
  } catch {
    return 0;
  }
};

export const useYesterdayLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["yesterday-leaderboard", filterByYear],
    queryFn: async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayStr = `${year}-${month}-${day}`;

      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { name: r.name, year: r.year }]) || []);

      // Include both finalized AND unfinalized entries for yesterday
      // This ensures accurate leaderboards even when reps forget to save
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, counter_timestamps, timezone, is_finalized, sales_log")
        .eq("entry_date", yesterdayStr);

      if (error) throw error;

      const filteredEntries = filterByYear 
        ? entries?.filter(e => repsMap.get(e.user_id)?.year === filterByYear) || []
        : entries || [];

      // Helper to calculate running totals from sales_log for unfinalized entries
      const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number; upgradePrmr: number } => {
        if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0, upgradePrmr: 0 };
        
        let fp = 0;
        let prmr = 0;
        let upgradePrmr = 0;
        
        for (const sale of salesLog) {
          const salePrmr = Number(sale.prmr) || 0;
          prmr += salePrmr;
          
          if (sale.type === 'fp') {
            fp += 1;
          } else if (sale.type === 'upgrade') {
            // Upgrade FP+ = PRMR / 85
            fp += salePrmr / 85;
            upgradePrmr += salePrmr;
          }
        }
        
        return { fp, prmr, upgradePrmr };
      };

      const leaderboard: YesterdayLeaderboard = {
        mostDoors: null,
        mostDecisionMakers: null,
        mostPitches: null,
        mostTransitions: null,
        mostPresentations: null,
        mostFP: null,
        mostPRMR: null,
        mostUpgradeFP: null,
        mostUpgradePRMR: null,
        mostHoursWorked: null,
        earliestDoor: null,
        latestDoor: null,
      };

      filteredEntries.forEach(entry => {
        const repInfo = repsMap.get(entry.user_id);
        if (!repInfo) return;

        const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();

        if (entry.doors_knocked && (!leaderboard.mostDoors || entry.doors_knocked > leaderboard.mostDoors.value)) {
          leaderboard.mostDoors = { userId: entry.user_id, name: cleanName, value: entry.doors_knocked };
        }

        if (entry.decision_makers && (!leaderboard.mostDecisionMakers || entry.decision_makers > leaderboard.mostDecisionMakers.value)) {
          leaderboard.mostDecisionMakers = { userId: entry.user_id, name: cleanName, value: entry.decision_makers };
        }

        if (entry.pitches && (!leaderboard.mostPitches || entry.pitches > leaderboard.mostPitches.value)) {
          leaderboard.mostPitches = { userId: entry.user_id, name: cleanName, value: entry.pitches };
        }

        if (entry.transitions && (!leaderboard.mostTransitions || entry.transitions > leaderboard.mostTransitions.value)) {
          leaderboard.mostTransitions = { userId: entry.user_id, name: cleanName, value: entry.transitions };
        }

        if (entry.presentations && (!leaderboard.mostPresentations || entry.presentations > leaderboard.mostPresentations.value)) {
          leaderboard.mostPresentations = { userId: entry.user_id, name: cleanName, value: entry.presentations };
        }

        // Calculate FP+ - use sales_log for unfinalized, columns for finalized
        let fpValue: number;
        if (entry.is_finalized) {
          fpValue = entry.fp_plus || 0;
        } else {
          const salesLog = entry.sales_log as any[];
          const fromLog = calculateFromSalesLog(salesLog);
          const fromColumn = entry.fp_plus || 0;
          fpValue = (salesLog && salesLog.length > 0) ? fromLog.fp : fromColumn;
        }
        
        if (fpValue > 0 && (!leaderboard.mostFP || fpValue > leaderboard.mostFP.value)) {
          leaderboard.mostFP = { userId: entry.user_id, name: cleanName, value: fpValue };
        }

        // Calculate PRMR - use sales_log for unfinalized, columns for finalized
        let prmrValue: number;
        if (entry.is_finalized) {
          prmrValue = entry.prmr || 0;
        } else {
          const salesLog = entry.sales_log as any[];
          const fromLog = calculateFromSalesLog(salesLog);
          const fromColumn = entry.prmr || 0;
          prmrValue = (salesLog && salesLog.length > 0) ? fromLog.prmr : fromColumn;
        }
        
        if (prmrValue > 0 && (!leaderboard.mostPRMR || prmrValue > leaderboard.mostPRMR.value)) {
          leaderboard.mostPRMR = { userId: entry.user_id, name: cleanName, value: prmrValue };
        }

        // Calculate upgrade PRMR - use sales_log for unfinalized, columns for finalized
        let upgradePrmrValue: number;
        if (entry.is_finalized) {
          upgradePrmrValue = entry.upgrade_prmr || 0;
        } else {
          const salesLog = entry.sales_log as any[];
          const fromLog = calculateFromSalesLog(salesLog);
          const fromColumn = entry.upgrade_prmr || 0;
          upgradePrmrValue = (salesLog && salesLog.length > 0) ? fromLog.upgradePrmr : fromColumn;
        }

        if (upgradePrmrValue > 0) {
          const upgradeFp = upgradePrmrValue / 85;
          if (!leaderboard.mostUpgradeFP || upgradeFp > leaderboard.mostUpgradeFP.value) {
            leaderboard.mostUpgradeFP = { userId: entry.user_id, name: cleanName, value: upgradeFp };
          }
          if (!leaderboard.mostUpgradePRMR || upgradePrmrValue > leaderboard.mostUpgradePRMR.value) {
            leaderboard.mostUpgradePRMR = { userId: entry.user_id, name: cleanName, value: upgradePrmrValue };
          }
        }

        if (entry.work_start_time && entry.work_end_time) {
          const startTime = new Date(entry.work_start_time);
          const endTime = new Date(entry.work_end_time);
          let totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

          if (entry.break_periods && Array.isArray(entry.break_periods)) {
            entry.break_periods.forEach((period: any) => {
              if (period.start && period.end) {
                const breakStart = new Date(period.start);
                const breakEnd = new Date(period.end);
                const breakMinutes = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
                totalMinutes -= breakMinutes;
              }
            });
          }

          const hours = totalMinutes / 60;
          if (hours > 0 && (!leaderboard.mostHoursWorked || hours > leaderboard.mostHoursWorked.value)) {
            leaderboard.mostHoursWorked = { userId: entry.user_id, name: cleanName, value: hours };
          }
        }

        if (entry.counter_timestamps) {
          const timestamps = entry.counter_timestamps as any;
          const userTimezone = entry.timezone || 'America/Los_Angeles';
          
          if (timestamps.doors_knocked && Array.isArray(timestamps.doors_knocked) && timestamps.doors_knocked.length > 0) {
            // Find earliest and latest by LOCAL time-of-day
            let earliestMins = Infinity;
            let latestMins = -1;
            let earliestTs = '';
            let latestTs = '';
            
            timestamps.doors_knocked.forEach((ts: string) => {
              const mins = getLocalMinutesOfDay(ts, userTimezone);
              if (mins < earliestMins) {
                earliestMins = mins;
                earliestTs = ts;
              }
              if (mins > latestMins) {
                latestMins = mins;
                latestTs = ts;
              }
            });

            if (earliestTs) {
              const earliestTime = new Date(earliestTs).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                timeZone: userTimezone 
              });
              
              // Check if yesterday was a Saturday
              const isSaturday = yesterday.getDay() === 6;
              
              const currentEarliestMins = leaderboard.earliestDoor?.value || Infinity;
              if (earliestMins < currentEarliestMins) {
                leaderboard.earliestDoor = { 
                  userId: entry.user_id, 
                  name: cleanName, 
                  value: earliestMins,
                  timeValue: earliestTime,
                  isSaturday
                };
              }
            }

            if (latestTs) {
              const latestTime = new Date(latestTs).toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                timeZone: userTimezone 
              });
              
              const currentLatestMins = leaderboard.latestDoor?.value || -1;
              if (latestMins > currentLatestMins) {
                leaderboard.latestDoor = { 
                  userId: entry.user_id, 
                  name: cleanName, 
                  value: latestMins,
                  timeValue: latestTime
                };
              }
            }
          }
        }
      });

      // Track if same person holds both earliest AND latest door (special achievement!)
      const isSamePersonEarliestLatest = leaderboard.earliestDoor && leaderboard.latestDoor && 
          leaderboard.earliestDoor.userId === leaderboard.latestDoor.userId;

      return { ...leaderboard, isSamePersonEarliestLatest };
    },
    staleTime: 0, // Force fresh data on every mount
  });
};
