import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLocalDateString } from "@/lib/utils";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
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

const getMondayOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const getSaturdayOfWeek = (date: Date): Date => {
  const monday = getMondayOfWeek(date);
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  return saturday;
};

export const useWeeklyLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["weekly-leaderboard", filterByYear],
    queryFn: async () => {
      const today = new Date();
      const monday = getMondayOfWeek(today);
      const saturday = getSaturdayOfWeek(today);
      
      const mondayStr = getLocalDateString(monday);
      const saturdayStr = getLocalDateString(saturday);

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
        .select("user_id, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, counter_timestamps, timezone")
        .eq("is_finalized", true)
        .gte("entry_date", mondayStr)
        .lte("entry_date", saturdayStr);

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
        earliestDoorTime: number | null;
        latestDoorTime: number | null;
        timezone: string;
      }>();

      filteredEntries.forEach((entry) => {
        const userId = entry.user_id;
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

        let entryEarliest = existing.earliestDoorTime;
        let entryLatest = existing.latestDoorTime;

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
          earliestDoorTime: entryEarliest,
          latestDoorTime: entryLatest,
          timezone: entry.timezone || existing.timezone,
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

        if (totals.prmr > 0 && (!leaderboard.mostPRMR || totals.prmr > leaderboard.mostPRMR.value)) {
          leaderboard.mostPRMR = { userId, name: userData.name, value: totals.prmr };
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

        if (totals.earliestDoorTime !== null) {
          const earliestTime = new Date(totals.earliestDoorTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: totals.timezone
          });

          if (!leaderboard.earliestDoor || totals.earliestDoorTime < (leaderboard.earliestDoor.value || Infinity)) {
            leaderboard.earliestDoor = {
              userId,
              name: userData.name,
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
              name: userData.name,
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
