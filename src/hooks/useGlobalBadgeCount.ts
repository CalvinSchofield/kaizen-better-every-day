import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches how many distinct users have earned each badge.
 * Returns a map of badge_id -> count of unique users.
 */
export const useGlobalBadgeCounts = () => {
  return useQuery({
    queryKey: ["global-badge-counts"],
    queryFn: async () => {
      // Use RPC or raw query to get distinct user counts per badge
      const { data, error } = await supabase
        .from("user_badges")
        .select("badge_id, user_id");

      if (error) throw error;

      // Count distinct users per badge_id
      const countMap: Record<string, Set<string>> = {};
      for (const row of data || []) {
        if (!countMap[row.badge_id]) countMap[row.badge_id] = new Set();
        countMap[row.badge_id].add(row.user_id);
      }

      const result: Record<string, number> = {};
      for (const [badgeId, users] of Object.entries(countMap)) {
        result[badgeId] = users.size;
      }
      return result;
    },
    staleTime: 1000 * 60 * 10,
  });
};
