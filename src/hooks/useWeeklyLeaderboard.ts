import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
  isSaturday?: boolean;
}

interface WeeklyLeaderboard {
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

const getSundayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day); // Go back to Sunday
  return d;
};

export const useWeeklyLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["weekly-leaderboard", filterByYear],
    queryFn: async () => {
      const today = new Date();
      const sunday = getSundayOfWeek(today);
      
      // Week-to-date: Sunday to today
      const sundayStr = getLocalDateString(sunday);
      const todayStr = getLocalDateString(today);

      const { data: users, error: usersError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (usersError) throw usersError;

      const userMap = new Map(
        users?.map((user) => [
          user.user_id,
          { 
            name: user.name.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').trim(),
            year: user.year 
          },
        ]) || []
      );

      const { data: entries, error: entriesError } = await supabase
        .from("daily_entries")
        .select("user_id, entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, counter_timestamps, timezone")
        .eq("is_finalized", true)
        .gte("entry_date", sundayStr)
        .lte("entry_date", todayStr);

      if (entriesError) throw entriesError;

      let filteredEntries = entries || [];
      if (filterByYear) {
        filteredEntries = filteredEntries.filter((entry) => {
          const userData = userMap.get(entry.user_id);
          return userData?.year === filterByYear;
        });
      }

      if (filteredEntries.length === 0) {
        return null;
      }

      const userTotals = new Map<string, {
        doors: number;
        decisionMakers: number;
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

      filteredEntries.forEach((entry) => {
        const userId = entry.user_id;
        const userTimezone = entry.timezone || 'America/Los_Angeles';
        const existing = userTotals.get(userId) || {
          doors: 0,
          decisionMakers: 0,
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

        let entryEarliestMins = existing.earliestDoorMins;
        let entryEarliestTs = existing.earliestDoorTs;
        let entryEarliestDate = existing.earliestDoorDate;
        let entryLatestMins = existing.latestDoorMins;
        let entryLatestTs = existing.latestDoorTs;

        if (entry.counter_timestamps) {
          const timestamps = entry.counter_timestamps as any;
          if (timestamps.doors_knocked && Array.isArray(timestamps.doors_knocked) && timestamps.doors_knocked.length > 0) {
            timestamps.doors_knocked.forEach((ts: string) => {
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
        
        const upgradePrmr = entry.upgrade_prmr || 0;
        const upgradeFp = upgradePrmr > 0 ? upgradePrmr / 85 : 0;
        
        userTotals.set(userId, {
          doors: existing.doors + (entry.doors_knocked || 0),
          decisionMakers: existing.decisionMakers + (entry.decision_makers || 0),
          pitches: existing.pitches + (entry.pitches || 0),
          transitions: existing.transitions + (entry.transitions || 0),
          presentations: existing.presentations + (entry.presentations || 0),
          fp: existing.fp + (entry.fp_plus || 0),
          prmr: existing.prmr + (entry.prmr || 0),
          upgradePrmr: existing.upgradePrmr + upgradePrmr,
          upgradeFp: existing.upgradeFp + upgradeFp,
          hoursWorked: existing.hoursWorked + entryHours,
          earliestDoorMins: entryEarliestMins,
          earliestDoorTs: entryEarliestTs,
          earliestDoorDate: entryEarliestDate,
          latestDoorMins: entryLatestMins,
          latestDoorTs: entryLatestTs,
          timezone: userTimezone,
        });
      });

      const leaderboard: WeeklyLeaderboard = {
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

      userTotals.forEach((totals, userId) => {
        const userData = userMap.get(userId);
        if (!userData) return;

        if (totals.doors > 0 && (!leaderboard.mostDoors || totals.doors > leaderboard.mostDoors.value)) {
          leaderboard.mostDoors = { userId, name: userData.name, value: totals.doors };
        }

        if (totals.decisionMakers > 0 && (!leaderboard.mostDecisionMakers || totals.decisionMakers > leaderboard.mostDecisionMakers.value)) {
          leaderboard.mostDecisionMakers = { userId, name: userData.name, value: totals.decisionMakers };
        }

        if (totals.pitches > 0 && (!leaderboard.mostPitches || totals.pitches > leaderboard.mostPitches.value)) {
          leaderboard.mostPitches = { userId, name: userData.name, value: totals.pitches };
        }

        if (totals.transitions > 0 && (!leaderboard.mostTransitions || totals.transitions > leaderboard.mostTransitions.value)) {
          leaderboard.mostTransitions = { userId, name: userData.name, value: totals.transitions };
        }

        if (totals.presentations > 0 && (!leaderboard.mostPresentations || totals.presentations > leaderboard.mostPresentations.value)) {
          leaderboard.mostPresentations = { userId, name: userData.name, value: totals.presentations };
        }

        if (totals.fp > 0 && (!leaderboard.mostFP || totals.fp > leaderboard.mostFP.value)) {
          leaderboard.mostFP = { userId, name: userData.name, value: totals.fp };
        }

        // Total PRMR = prmr (FP sales) + upgradePrmr (upgrade sales)
        const totalPrmr = totals.prmr + totals.upgradePrmr;
        if (totalPrmr > 0 && (!leaderboard.mostPRMR || totalPrmr > leaderboard.mostPRMR.value)) {
          leaderboard.mostPRMR = { userId, name: userData.name, value: totalPrmr };
        }

        if (totals.upgradeFp > 0 && (!leaderboard.mostUpgradeFP || totals.upgradeFp > leaderboard.mostUpgradeFP.value)) {
          leaderboard.mostUpgradeFP = { userId, name: userData.name, value: totals.upgradeFp };
        }

        if (totals.upgradePrmr > 0 && (!leaderboard.mostUpgradePRMR || totals.upgradePrmr > leaderboard.mostUpgradePRMR.value)) {
          leaderboard.mostUpgradePRMR = { userId, name: userData.name, value: totals.upgradePrmr };
        }

        if (totals.hoursWorked > 0 && (!leaderboard.mostHoursWorked || totals.hoursWorked > leaderboard.mostHoursWorked.value)) {
          leaderboard.mostHoursWorked = { userId, name: userData.name, value: totals.hoursWorked };
        }

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
              name: userData.name,
              value: totals.earliestDoorMins,
              timeValue: earliestTime,
              isSaturday
            };
          }
        }

        if (totals.latestDoorMins !== null && totals.latestDoorTs) {
          const latestTime = new Date(totals.latestDoorTs).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: totals.timezone
          });

          if (!leaderboard.latestDoor || totals.latestDoorMins > (leaderboard.latestDoor.value || -1)) {
            leaderboard.latestDoor = {
              userId,
              name: userData.name,
              value: totals.latestDoorMins,
              timeValue: latestTime
            };
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
