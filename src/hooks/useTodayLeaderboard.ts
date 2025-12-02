import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RankingEntry {
  userId: string;
  name: string;
  value: number;
}

interface TodayLeaderboard {
  rankings: {
    fp_plus: RankingEntry[];
    prmr: RankingEntry[];
    presentations: RankingEntry[];
    transitions: RankingEntry[];
    pitches: RankingEntry[];
    doors_knocked: RankingEntry[];
    decision_makers: RankingEntry[];
  };
}

export const useTodayLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["today-leaderboard", filterByYear],
    queryFn: async () => {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { name: r.name, year: r.year }]) || []);

      // Fetch UNFINALIZED entries for today (in-progress work)
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr")
        .eq("entry_date", todayStr)
        .eq("is_finalized", false);

      if (error) throw error;

      const filteredEntries = filterByYear 
        ? entries?.filter(e => repsMap.get(e.user_id)?.year === filterByYear) || []
        : entries || [];

      // Create rankings arrays for each metric
      const createRanking = (field: keyof typeof filteredEntries[0]): RankingEntry[] => {
        return filteredEntries
          .map(entry => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;
            const value = Number(entry[field]) || 0;
            if (value === 0) return null;
            const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
            return { userId: entry.user_id, name: cleanName, value };
          })
          .filter((e): e is RankingEntry => e !== null)
          .sort((a, b) => b.value - a.value);
      };

      const leaderboard: TodayLeaderboard = {
        rankings: {
          fp_plus: createRanking('fp_plus'),
          prmr: createRanking('prmr'),
          presentations: createRanking('presentations'),
          transitions: createRanking('transitions'),
          pitches: createRanking('pitches'),
          doors_knocked: createRanking('doors_knocked'),
          decision_makers: createRanking('decision_makers'),
        },
      };

      return leaderboard;
    },
    staleTime: 30000, // 30 seconds for real-time feel
    refetchInterval: 60000, // Auto-refetch every minute
  });
};
