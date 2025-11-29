import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
}

interface YesterdayLeaderboard {
  mostDoors: LeaderboardEntry | null;
  mostDecisionMakers: LeaderboardEntry | null;
  mostPitches: LeaderboardEntry | null;
  mostTransitions: LeaderboardEntry | null;
  mostPresentations: LeaderboardEntry | null;
  mostFP: LeaderboardEntry | null;
  mostPRMR: LeaderboardEntry | null;
}

export const useYesterdayLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["yesterday-leaderboard", filterByYear],
    queryFn: async () => {
      // Get yesterday's date in local timezone
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const year = yesterday.getFullYear();
      const month = String(yesterday.getMonth() + 1).padStart(2, '0');
      const day = String(yesterday.getDate()).padStart(2, '0');
      const yesterdayStr = `${year}-${month}-${day}`;

      // Fetch all reps data to get names and year info
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (repsError) throw repsError;

      // Create lookup map
      const repsMap = new Map(repsData?.map(r => [r.user_id, { name: r.name, year: r.year }]) || []);

      // Fetch yesterday's finalized entries
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr")
        .eq("entry_date", yesterdayStr)
        .eq("is_finalized", true);

      if (error) throw error;

      // Filter by year if specified (for rookie-only leaderboard)
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
      };

      // Find top performers
      filteredEntries.forEach(entry => {
        const repInfo = repsMap.get(entry.user_id);
        if (!repInfo) return;

        // Strip emojis from names
        const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();

        // Most doors
        if (entry.doors_knocked && (!leaderboard.mostDoors || entry.doors_knocked > leaderboard.mostDoors.value)) {
          leaderboard.mostDoors = {
            userId: entry.user_id,
            name: cleanName,
            value: entry.doors_knocked,
          };
        }

        // Most decision makers (got into most homes)
        if (entry.decision_makers && (!leaderboard.mostDecisionMakers || entry.decision_makers > leaderboard.mostDecisionMakers.value)) {
          leaderboard.mostDecisionMakers = {
            userId: entry.user_id,
            name: cleanName,
            value: entry.decision_makers,
          };
        }

        // Most pitches
        if (entry.pitches && (!leaderboard.mostPitches || entry.pitches > leaderboard.mostPitches.value)) {
          leaderboard.mostPitches = {
            userId: entry.user_id,
            name: cleanName,
            value: entry.pitches,
          };
        }

        // Most transitions
        if (entry.transitions && (!leaderboard.mostTransitions || entry.transitions > leaderboard.mostTransitions.value)) {
          leaderboard.mostTransitions = {
            userId: entry.user_id,
            name: cleanName,
            value: entry.transitions,
          };
        }

        // Most presentations
        if (entry.presentations && (!leaderboard.mostPresentations || entry.presentations > leaderboard.mostPresentations.value)) {
          leaderboard.mostPresentations = {
            userId: entry.user_id,
            name: cleanName,
            value: entry.presentations,
          };
        }

        // Most FP+ (only if > 0)
        if (entry.fp_plus && entry.fp_plus > 0 && (!leaderboard.mostFP || entry.fp_plus > leaderboard.mostFP.value)) {
          leaderboard.mostFP = {
            userId: entry.user_id,
            name: cleanName,
            value: entry.fp_plus,
          };
        }

        // Most PRMR (only if > 0)
        if (entry.prmr && entry.prmr > 0 && (!leaderboard.mostPRMR || entry.prmr > leaderboard.mostPRMR.value)) {
          leaderboard.mostPRMR = {
            userId: entry.user_id,
            name: cleanName,
            value: entry.prmr,
          };
        }
      });

      return leaderboard;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
