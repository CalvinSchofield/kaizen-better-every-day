import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { STREAK_PROTECTION, SEASON_DATES } from "@/utils/badgeDefinitions";

/**
 * Checks streak protections for a user — how many shields were used in their
 * current streak, whether they have an active recovery window, etc.
 */
export const useStreakProtection = (userId: string | null) => {
  return useQuery({
    queryKey: ["streak-protection", userId],
    queryFn: async () => {
      if (!userId) return { shieldCount: 0, hasActiveRecovery: false, recoveryWindow: null };

      // Fetch protections used during the current streak window
      // We need to know which dates in the streak used protection
      const [protectionsResult, recoveryResult] = await Promise.all([
        supabase
          .from("streak_protections")
          .select("id, entry_date, protection_type, method")
          .eq("user_id", userId)
          .order("entry_date", { ascending: false })
          .limit(60),
        supabase
          .from("streak_recovery_windows")
          .select("*")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1),
      ]);

      const protections = protectionsResult.data || [];
      const activeRecovery = recoveryResult.data?.[0] || null;

      return {
        shieldCount: protections.length,
        protections,
        hasActiveRecovery: !!activeRecovery,
        recoveryWindow: activeRecovery,
      };
    },
    enabled: !!userId,
    staleTime: 1000 * 60 * 2,
  });
};

/**
 * Calculate the season-specific average for a stat.
 * Uses personal_summer_start if available, otherwise global dates.
 * Only counts "knocking days" (doors_knocked > 0).
 */
export async function getSeasonAverage(
  userId: string,
  field: 'doors_knocked' | 'presentations' | 'fp_plus' | 'prmr',
  personalSummerStart?: string | null
): Promise<number> {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  // Determine which season we're in
  const summerStart = personalSummerStart || SEASON_DATES.SUMMER_START_GLOBAL;
  const inSummer = todayStr >= summerStart;
  const seasonStart = inSummer ? summerStart : SEASON_DATES.PRESEASON_START;

  const { data: entries } = await supabase
    .from("daily_entries")
    .select(`entry_date, doors_knocked, presentations, fp_plus, prmr`)
    .eq("user_id", userId)
    .gte("entry_date", seasonStart)
    .lt("entry_date", todayStr) // exclude today
    .order("entry_date", { ascending: false });

  if (!entries || entries.length === 0) return 0;

  // Only count knocking days (doors > 0) and exclude Sundays
  const knockingDays = entries.filter(e => {
    const dayOfWeek = new Date(e.entry_date + 'T12:00:00').getDay();
    return dayOfWeek !== 0 && (e.doors_knocked || 0) > 0;
  });

  if (knockingDays.length === 0) return 0;

  const total = knockingDays.reduce((sum, e) => sum + (Number((e as any)[field]) || 0), 0);
  return total / knockingDays.length;
}

/**
 * Check how many streak protections a user has used in the last 7 days.
 */
export async function getRecentProtectionCount(userId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

  const { count } = await supabase
    .from("streak_protections")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("entry_date", sevenDaysAgoStr);

  return count || 0;
}
