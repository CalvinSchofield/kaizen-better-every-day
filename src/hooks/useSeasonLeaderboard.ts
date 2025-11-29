import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LeaderboardEntry {
  userId: string;
  name: string;
  value: number;
}

interface SeasonLeaderboard {
  mostDoors: LeaderboardEntry | null;
  mostPitches: LeaderboardEntry | null;
  mostTransitions: LeaderboardEntry | null;
  mostPresentations: LeaderboardEntry | null;
  mostFP: LeaderboardEntry | null;
  mostPRMR: LeaderboardEntry | null;
}

export const useSeasonLeaderboard = (filterByYear?: string, isSummer: boolean = false) => {
  return useQuery({
    queryKey: ["season-leaderboard", filterByYear, isSummer],
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
        // Preseason: Jan 1 to April 11 of current year
        startDate = new Date(currentYear, 0, 1); // Jan 1
        endDate = new Date(currentYear, 3, 11); // April 11
      }
      
      const startStr = startDate.toISOString().split("T")[0];
      const endStr = endDate.toISOString().split("T")[0];

      // Fetch all reps data
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { name: r.name, year: r.year }]) || []);

      // Fetch all finalized entries for the season
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, pitches, transitions, presentations, fp_plus, prmr")
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
      }>();

      filteredEntries.forEach(entry => {
        const current = userTotals.get(entry.user_id) || {
          doors: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          fp: 0,
          prmr: 0,
        };

        userTotals.set(entry.user_id, {
          doors: current.doors + (entry.doors_knocked || 0),
          pitches: current.pitches + (entry.pitches || 0),
          transitions: current.transitions + (entry.transitions || 0),
          presentations: current.presentations + (entry.presentations || 0),
          fp: current.fp + (entry.fp_plus || 0),
          prmr: current.prmr + (entry.prmr || 0),
        });
      });

      const leaderboard: SeasonLeaderboard = {
        mostDoors: null,
        mostPitches: null,
        mostTransitions: null,
        mostPresentations: null,
        mostFP: null,
        mostPRMR: null,
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

        if (totals.prmr > 0 && (!leaderboard.mostPRMR || totals.prmr > leaderboard.mostPRMR.value)) {
          leaderboard.mostPRMR = { userId, name: cleanName, value: totals.prmr };
        }
      });

      return leaderboard;
    },
    staleTime: 5 * 60 * 1000,
  });
};
