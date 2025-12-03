import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
  timeValue?: string;
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

      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, work_start_time, work_end_time, break_periods, counter_timestamps, timezone")
        .eq("entry_date", yesterdayStr)
        .eq("is_finalized", true);

      if (error) throw error;

      const filteredEntries = filterByYear 
        ? entries?.filter(e => repsMap.get(e.user_id)?.year === filterByYear) || []
        : entries || [];

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

        if (entry.fp_plus && entry.fp_plus > 0 && (!leaderboard.mostFP || entry.fp_plus > leaderboard.mostFP.value)) {
          leaderboard.mostFP = { userId: entry.user_id, name: cleanName, value: entry.fp_plus };
        }

        const totalPrmr = (entry.prmr || 0) + (entry.upgrade_prmr || 0);
        if (totalPrmr > 0 && (!leaderboard.mostPRMR || totalPrmr > leaderboard.mostPRMR.value)) {
          leaderboard.mostPRMR = { userId: entry.user_id, name: cleanName, value: totalPrmr };
        }

        if (entry.upgrade_prmr && entry.upgrade_prmr > 0) {
          const upgradeFp = entry.upgrade_prmr / 85;
          if (!leaderboard.mostUpgradeFP || upgradeFp > leaderboard.mostUpgradeFP.value) {
            leaderboard.mostUpgradeFP = { userId: entry.user_id, name: cleanName, value: upgradeFp };
          }
          if (!leaderboard.mostUpgradePRMR || entry.upgrade_prmr > leaderboard.mostUpgradePRMR.value) {
            leaderboard.mostUpgradePRMR = { userId: entry.user_id, name: cleanName, value: entry.upgrade_prmr };
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
          if (timestamps.doors_knocked && Array.isArray(timestamps.doors_knocked) && timestamps.doors_knocked.length > 0) {
            const doorTimestamps = timestamps.doors_knocked.map((ts: string) => new Date(ts));
            const earliest = new Date(Math.min(...doorTimestamps.map(d => d.getTime())));
            const latest = new Date(Math.max(...doorTimestamps.map(d => d.getTime())));

            const userTimezone = entry.timezone || 'America/Denver';
            const earliestTime = earliest.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              timeZone: userTimezone 
            });
            const latestTime = latest.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit',
              timeZone: userTimezone 
            });

            if (!leaderboard.earliestDoor || earliest.getTime() < (leaderboard.earliestDoor.value || Infinity)) {
              leaderboard.earliestDoor = { 
                userId: entry.user_id, 
                name: cleanName, 
                value: earliest.getTime(),
                timeValue: earliestTime
              };
            }

            if (!leaderboard.latestDoor || latest.getTime() > (leaderboard.latestDoor.value || 0)) {
              leaderboard.latestDoor = { 
                userId: entry.user_id, 
                name: cleanName, 
                value: latest.getTime(),
                timeValue: latestTime
              };
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
