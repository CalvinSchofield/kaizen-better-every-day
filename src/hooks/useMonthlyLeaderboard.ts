import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
}

interface MonthlyLeaderboard {
  mostDoors: LeaderboardEntry | null;
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

export const useMonthlyLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["monthly-leaderboard", filterByYear],
    queryFn: async () => {
      // Get current month start and end dates
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      const startStr = getLocalDateString(monthStart);
      const endStr = getLocalDateString(monthEnd);

      // Fetch all reps data
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { name: r.name, year: r.year }]) || []);

      // Fetch all finalized entries for the month
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, counter_timestamps, timezone")
        .gte("entry_date", startStr)
        .lte("entry_date", endStr)
        .eq("is_finalized", true);

      if (error) throw error;

      // Filter by year if specified
      const filteredEntries = filterByYear 
        ? entries?.filter(e => repsMap.get(e.user_id)?.year === filterByYear) || []
        : entries || [];

      // Aggregate by user
      const userTotals = new Map<string, {
        doors: number;
        pitches: number;
        transitions: number;
        presentations: number;
        fp: number;
        prmr: number;
        upgradePrmr: number;
        upgradeFp: number;
        hoursWorked: number;
        earliestDoorTime: number | null;
        latestDoorTime: number | null;
        timezone: string;
      }>();

      filteredEntries.forEach(entry => {
        const current = userTotals.get(entry.user_id) || {
          doors: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          fp: 0,
          prmr: 0,
          upgradePrmr: 0,
          upgradeFp: 0,
          hoursWorked: 0,
          earliestDoorTime: null,
          latestDoorTime: null,
          timezone: entry.timezone || 'America/Denver',
        };

        let entryHours = 0;
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

          entryHours = totalMinutes / 60;
        }

        let entryEarliest = current.earliestDoorTime;
        let entryLatest = current.latestDoorTime;

        if (entry.counter_timestamps) {
          const timestamps = entry.counter_timestamps as any;
          if (timestamps.doors_knocked && Array.isArray(timestamps.doors_knocked) && timestamps.doors_knocked.length > 0) {
            const doorTimestamps = timestamps.doors_knocked.map((ts: string) => new Date(ts).getTime());
            const earliest = Math.min(...doorTimestamps);
            const latest = Math.max(...doorTimestamps);

            if (entryEarliest === null || earliest < entryEarliest) {
              entryEarliest = earliest;
            }
            if (entryLatest === null || latest > entryLatest) {
              entryLatest = latest;
            }
          }
        }

        const upgradePrmr = entry.upgrade_prmr || 0;
        const upgradeFp = upgradePrmr > 0 ? upgradePrmr / 85 : 0;
        
        userTotals.set(entry.user_id, {
          doors: current.doors + (entry.doors_knocked || 0),
          pitches: current.pitches + (entry.pitches || 0),
          transitions: current.transitions + (entry.transitions || 0),
          presentations: current.presentations + (entry.presentations || 0),
          fp: current.fp + (entry.fp_plus || 0),
          prmr: current.prmr + (entry.prmr || 0),
          upgradePrmr: current.upgradePrmr + upgradePrmr,
          upgradeFp: current.upgradeFp + upgradeFp,
          hoursWorked: current.hoursWorked + entryHours,
          earliestDoorTime: entryEarliest,
          latestDoorTime: entryLatest,
          timezone: entry.timezone || current.timezone,
        });
      });

      const leaderboard: MonthlyLeaderboard = {
        mostDoors: null,
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

      // Find top performers
      userTotals.forEach((totals, userId) => {
        const repInfo = repsMap.get(userId);
        if (!repInfo) return;

        const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();

        if (totals.doors > 0 && (!leaderboard.mostDoors || totals.doors > leaderboard.mostDoors.value)) {
          leaderboard.mostDoors = { userId, name: cleanName, value: totals.doors };
        }

        if (totals.pitches > 0 && (!leaderboard.mostPitches || totals.pitches > leaderboard.mostPitches.value)) {
          leaderboard.mostPitches = { userId, name: cleanName, value: totals.pitches };
        }

        if (totals.transitions > 0 && (!leaderboard.mostTransitions || totals.transitions > leaderboard.mostTransitions.value)) {
          leaderboard.mostTransitions = { userId, name: cleanName, value: totals.transitions };
        }

        if (totals.presentations > 0 && (!leaderboard.mostPresentations || totals.presentations > leaderboard.mostPresentations.value)) {
          leaderboard.mostPresentations = { userId, name: cleanName, value: totals.presentations };
        }

        if (totals.fp > 0 && (!leaderboard.mostFP || totals.fp > leaderboard.mostFP.value)) {
          leaderboard.mostFP = { userId, name: cleanName, value: totals.fp };
        }

        // Total PRMR = prmr (FP sales) + upgradePrmr (upgrade sales)
        const totalPrmr = totals.prmr + totals.upgradePrmr;
        if (totalPrmr > 0 && (!leaderboard.mostPRMR || totalPrmr > leaderboard.mostPRMR.value)) {
          leaderboard.mostPRMR = { userId, name: cleanName, value: totalPrmr };
        }

        if (totals.upgradeFp > 0 && (!leaderboard.mostUpgradeFP || totals.upgradeFp > leaderboard.mostUpgradeFP.value)) {
          leaderboard.mostUpgradeFP = { userId, name: cleanName, value: totals.upgradeFp };
        }

        if (totals.upgradePrmr > 0 && (!leaderboard.mostUpgradePRMR || totals.upgradePrmr > leaderboard.mostUpgradePRMR.value)) {
          leaderboard.mostUpgradePRMR = { userId, name: cleanName, value: totals.upgradePrmr };
        }

        if (totals.hoursWorked > 0 && (!leaderboard.mostHoursWorked || totals.hoursWorked > leaderboard.mostHoursWorked.value)) {
          leaderboard.mostHoursWorked = { userId, name: cleanName, value: totals.hoursWorked };
        }

        if (totals.earliestDoorTime !== null) {
          const earliestTime = new Date(totals.earliestDoorTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: totals.timezone
          });

          if (!leaderboard.earliestDoor || totals.earliestDoorTime < (leaderboard.earliestDoor.value || Infinity)) {
            leaderboard.earliestDoor = {
              userId,
              name: cleanName,
              value: totals.earliestDoorTime,
              timeValue: earliestTime
            };
          }
        }

        if (totals.latestDoorTime !== null) {
          const latestTime = new Date(totals.latestDoorTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: totals.timezone
          });

          if (!leaderboard.latestDoor || totals.latestDoorTime > (leaderboard.latestDoor.value || 0)) {
            leaderboard.latestDoor = {
              userId,
              name: cleanName,
              value: totals.latestDoorTime,
              timeValue: latestTime
            };
          }
        }
      });

      // Hide earliest/latest door if same person holds both (means only one person has timestamps)
      if (leaderboard.earliestDoor && leaderboard.latestDoor && 
          leaderboard.earliestDoor.userId === leaderboard.latestDoor.userId) {
        leaderboard.earliestDoor = null;
        leaderboard.latestDoor = null;
      }

      return leaderboard;
    },
    staleTime: 0, // Force fresh data on every mount
  });
};
