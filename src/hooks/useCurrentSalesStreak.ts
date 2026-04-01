import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calculates a user's current consecutive working days with at least 1 sale (closes >= 1).
 * Returns the streak count and a global comparison of how many other users have ever reached that length.
 */
export const useCurrentSalesStreak = (userId: string | null) => {
  return useQuery({
    queryKey: ["current-sales-streak", userId],
    queryFn: async () => {
      if (!userId) return { streak: 0, globalReached: 0 };

      // Get recent entries sorted descending
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("entry_date, closes")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false })
        .limit(100);

      if (error) throw error;
      if (!entries || entries.length === 0) return { streak: 0, globalReached: 0 };

      // Calculate current streak
      let streak = 0;
      let expectedDate = new Date(entries[0].entry_date + "T12:00:00");

      for (const entry of entries) {
        const entryDate = new Date(entry.entry_date + "T12:00:00");
        const diffDays = Math.round(
          (expectedDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays > 1) break;

        if ((entry.closes || 0) >= 1) {
          streak++;
        } else {
          break;
        }

        expectedDate = new Date(entryDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
      }

      // If streak is 0, skip the global query
      if (streak === 0) return { streak: 0, globalReached: 0 };

      // Global comparison: how many distinct users have ever had a sales streak >= this length
      // We approximate by checking user_badges for the closest streak_sales badge
      const { count } = await supabase
        .from("user_badges")
        .select("user_id", { count: "exact", head: true })
        .eq("badge_id", await getStreakBadgeId(streak));

      return { streak, globalReached: count || 0 };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
};

async function getStreakBadgeId(streak: number): Promise<string> {
  // Find the highest streak_sales badge <= current streak
  const thresholds = [60, 42, 36, 30, 24, 18, 12, 10, 6, 3];
  const matchedThreshold = thresholds.find(t => streak >= t) || 3;
  
  const { data } = await supabase
    .from("badge_definitions")
    .select("id")
    .eq("slug", `streak_sales_${matchedThreshold}`)
    .maybeSingle();

  return data?.id || "";
}
