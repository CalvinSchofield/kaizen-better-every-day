import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Calculates a user's current consecutive working days with at least 1 sale (closes >= 1),
 * factoring in streak protections (shield days where effort was high enough).
 * Returns the streak count, shield count, and a global comparison.
 */
export const useCurrentSalesStreak = (userId: string | null) => {
  return useQuery({
    queryKey: ["current-sales-streak", userId],
    queryFn: async () => {
      if (!userId) return { streak: 0, shieldCount: 0, globalReached: 0 };

      // Get recent entries and protections in parallel
      const [entriesResult, protectionsResult] = await Promise.all([
        supabase
          .from("daily_entries")
          .select("entry_date, closes")
          .eq("user_id", userId)
          .order("entry_date", { ascending: false })
          .limit(100),
        supabase
          .from("streak_protections")
          .select("entry_date")
          .eq("user_id", userId)
          .order("entry_date", { ascending: false })
          .limit(100),
      ]);

      if (entriesResult.error) throw entriesResult.error;
      const entries = entriesResult.data || [];
      if (entries.length === 0) return { streak: 0, shieldCount: 0, globalReached: 0 };

      // Build a set of protected dates for fast lookup
      const protectedDates = new Set(
        (protectionsResult.data || []).map(p => p.entry_date)
      );

      // Calculate current streak (with protection support)
      let streak = 0;
      let shieldCount = 0;
      let expectedDate = new Date(entries[0].entry_date + "T12:00:00");

      for (const entry of entries) {
        const entryDate = new Date(entry.entry_date + "T12:00:00");
        const diffDays = Math.round(
          (expectedDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diffDays > 1) break;

        if ((entry.closes || 0) >= 1) {
          streak++;
        } else if (protectedDates.has(entry.entry_date)) {
          // Day had no sale but was protected by effort
          streak++;
          shieldCount++;
        } else {
          break;
        }

        expectedDate = new Date(entryDate);
        expectedDate.setDate(expectedDate.getDate() - 1);
      }

      if (streak === 0) return { streak: 0, shieldCount: 0, globalReached: 0 };

      // Global comparison
      const { count } = await supabase
        .from("user_badges")
        .select("user_id", { count: "exact", head: true })
        .eq("badge_id", await getStreakBadgeId(streak));

      return { streak, shieldCount, globalReached: count || 0 };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
};

async function getStreakBadgeId(streak: number): Promise<string> {
  const thresholds = [60, 42, 36, 30, 24, 18, 12, 10, 6, 3];
  const matchedThreshold = thresholds.find(t => streak >= t) || 3;
  
  const { data } = await supabase
    .from("badge_definitions")
    .select("id")
    .eq("slug", `streak_sales_${matchedThreshold}`)
    .maybeSingle();

  return data?.id || "";
}
