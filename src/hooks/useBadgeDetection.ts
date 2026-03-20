import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  DAILY_FP_THRESHOLDS, dailyFpSlug,
  SPECIAL_SLUGS,
  STREAK_FREEZE,
  SALES_STREAK_THRESHOLDS, salesStreakSlug,
  TRANSITION_STREAK_THRESHOLDS, transitionStreakSlug,
  PRESENTATION_STREAK_THRESHOLDS, presentationStreakSlug,
  MULTI_SALE_STREAKS,
} from "@/utils/badgeDefinitions";

interface DailyEntryForBadge {
  entry_date: string;
  doors_knocked: number;
  decision_makers: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp_plus: number;
  prmr: number;
  upgrade_prmr: number;
  counter_timestamps: Record<string, string[]> | null;
  sales_log: any[] | null;
  timezone: string | null;
}

/**
 * Detects and awards badges based on today's entry data.
 * Should be called from the Track page or on entry finalization.
 */
export const useBadgeDetection = (
  userId: string | null,
  todayEntry: DailyEntryForBadge | null,
  isRookie: boolean
) => {
  const queryClient = useQueryClient();
  const hasRunRef = useRef<string | null>(null);

  const awardBadge = useCallback(async (slug: string, entryDate: string, metadata: Record<string, any> = {}) => {
    if (!userId) return false;

    try {
      // Get badge definition
      const { data: def } = await supabase
        .from("badge_definitions")
        .select("id, name, icon_emoji, rookie_only")
        .eq("slug", slug)
        .maybeSingle();

      if (!def) return false;
      if (def.rookie_only && !isRookie) return false;

      // Check if already earned
      const { data: existing } = await supabase
        .from("user_badges")
        .select("id")
        .eq("user_id", userId)
        .eq("badge_id", def.id)
        .eq("entry_date", entryDate)
        .maybeSingle();

      if (existing) return false;

      // Award it
      const { error } = await supabase.from("user_badges").insert({
        user_id: userId,
        badge_id: def.id,
        entry_date: entryDate,
        metadata,
      });

      if (error) {
        // Likely unique constraint — badge already exists
        if (error.code === '23505') return false;
        console.error("[BadgeDetection] Insert error:", error);
        return false;
      }

      // Celebration toast
      toast({
        title: `${def.icon_emoji} Badge Earned!`,
        description: def.name,
      });

      // Invalidate badge queries
      queryClient.invalidateQueries({ queryKey: ["user-badges"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard-badges"] });

      return true;
    } catch (err) {
      console.error("[BadgeDetection] Error awarding badge:", err);
      return false;
    }
  }, [userId, isRookie, queryClient]);

  const detectBadges = useCallback(async () => {
    if (!userId || !todayEntry) return;

    const date = todayEntry.entry_date;
    const fp = todayEntry.fp_plus || 0;
    const closes = todayEntry.closes || 0;
    const doors = todayEntry.doors_knocked || 0;
    const upgradePrmr = todayEntry.upgrade_prmr || 0;
    const salesLog = todayEntry.sales_log;

    // --- Daily FP+ milestones ---
    for (const threshold of DAILY_FP_THRESHOLDS) {
      if (fp >= threshold) {
        await awardBadge(dailyFpSlug(threshold), date, { value: fp });
      }
    }

    // --- Special badges ---
    // First Door Magic: sold with exactly 1 door
    if (closes > 0 && doors === 1) {
      await awardBadge(SPECIAL_SLUGS.FIRST_DOOR_MAGIC, date);
    }

    // Night Owl: has a door timestamp after 9 PM LOCAL TIME and made a sale
    if (closes > 0 && todayEntry.counter_timestamps) {
      const doorTs = todayEntry.counter_timestamps['doors_knocked'];
      if (doorTs && Array.isArray(doorTs)) {
        const repTz = todayEntry.timezone || 'America/Los_Angeles';
        const hasLateKnock = doorTs.some(ts => {
          try {
            const hourStr = new Intl.DateTimeFormat('en-US', {
              timeZone: repTz,
              hour: 'numeric',
              hour12: false,
            }).format(new Date(ts));
            return parseInt(hourStr, 10) >= 21;
          } catch {
            return false;
          }
        });
        if (hasLateKnock) {
          await awardBadge(SPECIAL_SLUGS.NIGHT_OWL, date);
        }
      }
    }

    // 1-2 Combo: FP+ and upgrade in same day
    if (salesLog && Array.isArray(salesLog)) {
      const hasFp = salesLog.some((s: any) => s.type === 'fp' && s.install_status !== 'never_installed' && s.install_status !== 'cancelled');
      const hasUpgrade = salesLog.some((s: any) => s.type === 'upgrade' && s.install_status !== 'never_installed' && s.install_status !== 'cancelled');
      if (hasFp && hasUpgrade) {
        await awardBadge(SPECIAL_SLUGS.ONE_TWO_COMBO, date);
      }
    }

    // Upgrade Assassin: upgrade_prmr >= 85
    if (upgradePrmr >= 85) {
      await awardBadge(SPECIAL_SLUGS.UPGRADE_ASSASSIN, date, { value: upgradePrmr });
    }

    // --- Streak detection ---
    // Fetch recent entries for streak calculation
    const { data: recentEntries } = await supabase
      .from("daily_entries")
      .select("entry_date, closes, transitions, presentations, doors_knocked")
      .eq("user_id", userId)
      .order("entry_date", { ascending: false })
      .limit(35);

    if (recentEntries && recentEntries.length > 0) {
      // Sales streaks (no freeze)
      const salesStreak = calcStreak(recentEntries, 'closes', 1, null);
      for (const t of SALES_STREAK_THRESHOLDS) {
        if (salesStreak >= t) {
          await awardBadge(salesStreakSlug(t), date, { streak: salesStreak });
        }
      }

      // Multi-sale streaks
      for (const ms of MULTI_SALE_STREAKS) {
        const streak = calcStreak(recentEntries, 'closes', ms.min, null);
        if (streak >= ms.days) {
          await awardBadge(ms.slug, date, { streak, minCloses: ms.min });
        }
      }

      // Transition streaks (rookie only, freeze with 80+ doors)
      if (isRookie) {
        const transStreak = calcStreak(recentEntries, 'transitions', 1, STREAK_FREEZE.transition);
        for (const t of TRANSITION_STREAK_THRESHOLDS) {
          if (transStreak >= t) {
            await awardBadge(transitionStreakSlug(t), date, { streak: transStreak });
          }
        }

        // Presentation streaks (rookie only, freeze with 2+ transitions)
        const presStreak = calcStreak(recentEntries, 'presentations', 1, STREAK_FREEZE.presentation);
        for (const t of PRESENTATION_STREAK_THRESHOLDS) {
          if (presStreak >= t) {
            await awardBadge(presentationStreakSlug(t), date, { streak: presStreak });
          }
        }
      }
    }
  }, [userId, todayEntry, isRookie, awardBadge]);

  // Run detection when entry changes (debounce by entry_date + fp value)
  useEffect(() => {
    if (!todayEntry || !userId) return;
    const key = `${todayEntry.entry_date}-${todayEntry.fp_plus}-${todayEntry.closes}-${todayEntry.doors_knocked}`;
    if (hasRunRef.current === key) return;
    hasRunRef.current = key;

    // Small delay to batch rapid counter changes
    const timer = setTimeout(() => {
      detectBadges();
    }, 2000);

    return () => clearTimeout(timer);
  }, [todayEntry, userId, detectBadges]);
};

/**
 * Calculate streak length from sorted (desc) recent entries.
 * freezeRule: if set, the streak continues if the freeze field meets the threshold.
 */
function calcStreak(
  entries: { entry_date: string; closes: number | null; transitions: number | null; presentations: number | null; doors_knocked: number | null }[],
  field: 'closes' | 'transitions' | 'presentations',
  minValue: number,
  freezeRule: { field: 'doors_knocked' | 'transitions'; threshold: number } | null
): number {
  if (!entries.length) return 0;

  let streak = 0;
  let expectedDate = new Date(entries[0].entry_date + 'T12:00:00');

  for (const entry of entries) {
    const entryDate = new Date(entry.entry_date + 'T12:00:00');
    const diffDays = Math.round((expectedDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) break; // Gap too big
    if (diffDays === 1) {
      // This is the expected previous day — check it
    }

    const val = Number(entry[field]) || 0;
    if (val >= minValue) {
      streak++;
    } else if (freezeRule) {
      // Check freeze condition
      const freezeVal = Number(entry[freezeRule.field]) || 0;
      if (freezeVal >= freezeRule.threshold) {
        streak++; // Frozen — streak continues
      } else {
        break;
      }
    } else {
      break;
    }

    expectedDate = new Date(entryDate);
    expectedDate.setDate(expectedDate.getDate() - 1);
  }

  return streak;
}
