import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
  isSaturday?: boolean;
}

interface SeasonLeaderboard {
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

export const useSeasonLeaderboard = (filterByYear?: string, isSummer: boolean = false) => {
  // Include today's date in cache key for daily invalidation
  const todayStr = getLocalDateString(new Date());

  return useQuery({
    queryKey: ["season-leaderboard", todayStr, filterByYear, isSummer],
    queryFn: async () => {
      // Determine season dates
      const now = new Date();
      const currentYear = now.getFullYear();
      
      let startDate: Date;
      let endDate: Date;
      
      if (isSummer) {
        // Summer: April 12 to Sept 27 of current year
        startDate = new Date(currentYear, 3, 12); // April 12
        endDate = new Date(currentYear, 8, 27); // Sept 27
      } else {
        // Preseason: Sept 28 to April 11 (spans two calendar years)
        const currentMonth = now.getMonth();
        const currentDay = now.getDate();
        
        if (currentMonth >= 8 && (currentMonth > 8 || currentDay >= 28)) {
          // Between Sept 28 and Dec 31: show current year Sept 28 to next year April 11
          startDate = new Date(currentYear, 8, 28); // Sept 28 current year
          endDate = new Date(currentYear + 1, 3, 11); // April 11 next year
        } else {
          // Between Jan 1 and Sept 27: show previous year Sept 28 to current year April 11
          startDate = new Date(currentYear - 1, 8, 28); // Sept 28 previous year
          endDate = new Date(currentYear, 3, 11); // April 11 current year
        }
      }
      
      const startStr = getLocalDateString(startDate);
      const endStr = getLocalDateString(endDate);

      // Fetch all reps data
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { name: r.name, year: r.year }]) || []);

      // Fetch all entries for the season (include sales_log for accurate calculations)
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, entry_date, doors_knocked, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, counter_timestamps, timezone, sales_log, is_finalized")
        .gte("entry_date", startStr)
        .lte("entry_date", endStr);

      if (error) throw error;
      
      // Filter to finalized entries only for season totals
      const finalizedEntries = entries?.filter(e => e.is_finalized) || [];

      // Filter by year if specified
      const filteredEntries = filterByYear 
        ? finalizedEntries.filter(e => repsMap.get(e.user_id)?.year === filterByYear)
        : finalizedEntries;

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
        earliestDoorMins: number | null;
        earliestDoorTs: string | null;
        earliestDoorDate: string | null;
        latestDoorMins: number | null;
        latestDoorTs: string | null;
        timezone: string;
      }>();

      filteredEntries.forEach(entry => {
        const userTimezone = entry.timezone || 'America/Los_Angeles';
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
          earliestDoorMins: null,
          earliestDoorTs: null,
          earliestDoorDate: null,
          latestDoorMins: null,
          latestDoorTs: null,
          timezone: userTimezone,
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

        let entryEarliestMins = current.earliestDoorMins;
        let entryEarliestTs = current.earliestDoorTs;
        let entryEarliestDate = current.earliestDoorDate;
        let entryLatestMins = current.latestDoorMins;
        let entryLatestTs = current.latestDoorTs;

        if (entry.counter_timestamps) {
          const timestamps = entry.counter_timestamps as any;
          if (timestamps.doors_knocked && Array.isArray(timestamps.doors_knocked) && timestamps.doors_knocked.length > 0) {
            timestamps.doors_knocked.forEach((ts: string) => {
              // Use local time-of-day comparison, not UTC timestamps
              const mins = getLocalMinutesOfDay(ts, userTimezone);
              if (entryEarliestMins === null || mins < entryEarliestMins) {
                entryEarliestMins = mins;
                entryEarliestTs = ts;
                entryEarliestDate = entry.entry_date;
              }
              if (entryLatestMins === null || mins > entryLatestMins) {
                entryLatestMins = mins;
                entryLatestTs = ts;
              }
            });
          }
        }

        // Always prioritize sales_log if it has entries (regardless of finalization)
        const salesLog = (entry as any).sales_log as any[];
        const hasSalesLog = salesLog && salesLog.length > 0;
        let fp: number;
        let prmr: number;
        if (hasSalesLog) {
          const calculated = calculateFromSalesLog(salesLog);
          fp = calculated.fp;
          prmr = calculated.prmr;
        } else {
          fp = entry.fp_plus || 0;
          prmr = entry.prmr || 0;
        }
        
        const upgradePrmr = entry.upgrade_prmr || 0;
        const upgradeFp = upgradePrmr > 0 ? upgradePrmr / 85 : 0;
        
        userTotals.set(entry.user_id, {
          doors: current.doors + (entry.doors_knocked || 0),
          pitches: current.pitches + (entry.pitches || 0),
          transitions: current.transitions + (entry.transitions || 0),
          presentations: current.presentations + (entry.presentations || 0),
          fp: current.fp + fp,
          prmr: current.prmr + prmr,
          upgradePrmr: current.upgradePrmr + upgradePrmr,
          upgradeFp: current.upgradeFp + upgradeFp,
          hoursWorked: current.hoursWorked + entryHours,
          earliestDoorMins: entryEarliestMins,
          earliestDoorTs: entryEarliestTs,
          earliestDoorDate: entryEarliestDate,
          latestDoorMins: entryLatestMins,
          latestDoorTs: entryLatestTs,
          timezone: userTimezone,
        });
      });

      const leaderboard: SeasonLeaderboard = {
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

        // Earliest door - compare local time-of-day (minutes)
        if (totals.earliestDoorMins !== null && totals.earliestDoorTs) {
          const earliestTime = new Date(totals.earliestDoorTs).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: totals.timezone
          });
          
          // Determine if the earliest door was on a Saturday
          let isSaturday = false;
          if (totals.earliestDoorDate) {
            const dateObj = new Date(totals.earliestDoorDate + 'T12:00:00');
            isSaturday = dateObj.getDay() === 6;
          }

          if (!leaderboard.earliestDoor || totals.earliestDoorMins < (leaderboard.earliestDoor.value || Infinity)) {
            leaderboard.earliestDoor = {
              userId,
              name: cleanName,
              value: totals.earliestDoorMins,
              timeValue: earliestTime,
              isSaturday
            };
          }
        }

        // Latest door - compare local time-of-day (minutes)
        if (totals.latestDoorMins !== null && totals.latestDoorTs) {
          const latestTime = new Date(totals.latestDoorTs).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: totals.timezone
          });

          if (!leaderboard.latestDoor || totals.latestDoorMins > (leaderboard.latestDoor.value || 0)) {
            leaderboard.latestDoor = {
              userId,
              name: cleanName,
              value: totals.latestDoorMins,
              timeValue: latestTime
            };
          }
        }
      });

      return leaderboard;
    },
    staleTime: 0, // Force fresh data on every mount
  });
};
