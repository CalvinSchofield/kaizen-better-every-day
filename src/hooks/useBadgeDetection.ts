import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { emitInAppNotification } from "@/components/InAppNotificationBanner";
import {
  DAILY_FP_THRESHOLDS, dailyFpSlug,
  WEEKLY_FP_THRESHOLDS, weeklyFpSlug,
  WEEKLY_PRMR_THRESHOLDS, weeklyPrmrSlug,
  CLUB_THRESHOLDS, clubSlug,
  SPECIAL_SLUGS,
  STREAK_FREEZE,
  SALES_STREAK_THRESHOLDS, salesStreakSlug,
  TRANSITION_STREAK_THRESHOLDS, transitionStreakSlug,
  PRESENTATION_STREAK_THRESHOLDS, presentationStreakSlug,
  MULTI_SALE_STREAKS,
  STREAK_PROTECTION,
  SEASON_DATES,
} from "@/utils/badgeDefinitions";
import { getSeasonAverage, getRecentProtectionCount } from "@/hooks/useStreakProtection";
import { startOfWeek, endOfWeek, format } from "date-fns";

const SEASON_START = "2025-09-28";

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
        .select("id, name, icon_emoji, rookie_only, rarity, description")
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
        if (error.code === '23505') return false;
        console.error("[BadgeDetection] Insert error:", error);
        return false;
      }

      // Full-screen celebration
      const { emitBadgeCelebration } = await import("@/components/badges/BadgeCelebrationOverlay");
      emitBadgeCelebration({
        id: `${slug}-${entryDate}-${Date.now()}`,
        emoji: def.icon_emoji || '🏅',
        name: def.name,
        description: def.description || undefined,
        rarity: def.rarity || 'common',
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

    // First Blood: check if this is the user's first-ever sale
    if (closes > 0) {
      const { count } = await supabase
        .from("user_badges")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("badge_id", (await supabase.from("badge_definitions").select("id").eq("slug", "first_blood").maybeSingle()).data?.id || "");
      if (count === 0) {
        await awardBadge(SPECIAL_SLUGS.FIRST_BLOOD, date);
      }
    }

    // --- Rookie Quick-Win Badges (first-ever tracked, skip if synced historical data exists) ---
    if (isRookie) {
      // Check if the rep has any historical_entries (synced data) - if so, skip rookie firsts
      const { count: historicalCount } = await supabase
        .from("historical_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .limit(1);

      const hasHistorical = (historicalCount || 0) > 0;

      if (!hasHistorical) {
        // Check prior daily_entries (excluding today) for each field
        const { data: priorEntries } = await supabase
          .from("daily_entries")
          .select("doors_knocked, transitions, presentations, closes")
          .eq("user_id", userId)
          .neq("entry_date", date)
          .limit(500);

        const priorDoors = priorEntries?.some(e => (e.doors_knocked || 0) > 0);
        const priorTransitions = priorEntries?.some(e => (e.transitions || 0) > 0);
        const priorPresentations = priorEntries?.some(e => (e.presentations || 0) > 0);
        const priorCloses = priorEntries?.some(e => (e.closes || 0) > 0);

        if (doors > 0 && !priorDoors) {
          await awardBadge(SPECIAL_SLUGS.FIRST_DOOR, date);
        }
        if ((todayEntry.transitions || 0) > 0 && !priorTransitions) {
          await awardBadge(SPECIAL_SLUGS.FIRST_TRANSITION, date);
        }
        if ((todayEntry.presentations || 0) > 0 && !priorPresentations) {
          await awardBadge(SPECIAL_SLUGS.FIRST_PRESENTATION, date);
        }
        if (closes > 0 && !priorCloses) {
          await awardBadge(SPECIAL_SLUGS.FIRST_SALE, date);
        }
      }
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

    // --- Season Club Badges (cumulative FP+ from season start) ---
    if (date >= SEASON_START) {
      const { data: seasonEntries } = await supabase
        .from("daily_entries")
        .select("fp_plus")
        .eq("user_id", userId)
        .gte("entry_date", SEASON_START)
        .eq("is_finalized", true);

      if (seasonEntries) {
        const totalFp = seasonEntries.reduce((sum, e) => sum + (e.fp_plus || 0), 0);
        // Include today's live FP even if not finalized
        const effectiveTotal = totalFp + (todayEntry.fp_plus || 0);

        for (const threshold of CLUB_THRESHOLDS) {
          if (effectiveTotal >= threshold) {
            // Check if already awarded (any date) - clubs are once-per-season
            const { data: existingClub } = await supabase
              .from("user_badges")
              .select("id")
              .eq("user_id", userId)
              .eq("badge_id", (await supabase.from("badge_definitions").select("id").eq("slug", clubSlug(threshold)).maybeSingle()).data?.id || "")
              .limit(1);

            if (!existingClub || existingClub.length === 0) {
              await awardBadge(clubSlug(threshold), date, { total: Math.round(effectiveTotal * 10) / 10 });
            }
          }
        }
      }
    }

    // --- Weekly Milestone Badges ---
    if (date >= SEASON_START) {
      const weekStart = format(startOfWeek(new Date(date + "T12:00:00"), { weekStartsOn: 0 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(new Date(date + "T12:00:00"), { weekStartsOn: 0 }), "yyyy-MM-dd");

      const { data: weekEntries } = await supabase
        .from("daily_entries")
        .select("fp_plus, prmr, is_finalized")
        .eq("user_id", userId)
        .gte("entry_date", weekStart)
        .lte("entry_date", weekEnd);

      if (weekEntries) {
        const weeklyFp = weekEntries.reduce((sum, e) => sum + (e.fp_plus || 0), 0);
        const weeklyPrmr = weekEntries.reduce((sum, e) => sum + (e.prmr || 0), 0);

        for (const threshold of WEEKLY_FP_THRESHOLDS) {
          if (weeklyFp >= threshold) {
            await awardBadge(weeklyFpSlug(threshold), date, { weeklyFp: Math.round(weeklyFp * 10) / 10 });
          }
        }
        for (const threshold of WEEKLY_PRMR_THRESHOLDS) {
          if (weeklyPrmr >= threshold) {
            await awardBadge(weeklyPrmrSlug(threshold), date, { weeklyPrmr: Math.round(weeklyPrmr) });
          }
        }
      }
    }

    // --- Streak detection ---
    // Fetch protections for this user to factor into streak calc
    const [recentEntriesResult, protectionsResult] = await Promise.all([
      supabase
        .from("daily_entries")
        .select("entry_date, closes, transitions, presentations, doors_knocked")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false })
        .limit(35),
      supabase
        .from("streak_protections")
        .select("entry_date")
        .eq("user_id", userId)
        .order("entry_date", { ascending: false })
        .limit(100),
    ]);

    const recentEntries = recentEntriesResult.data;
    const protectedDates = new Set(
      (protectionsResult.data || []).map(p => p.entry_date)
    );

    if (recentEntries && recentEntries.length > 0) {
      // Sales streaks (with protection support)
      const salesStreak = calcStreakWithProtection(recentEntries, 'closes', 1, null, protectedDates);
      for (const t of SALES_STREAK_THRESHOLDS) {
        if (salesStreak >= t) {
          await awardBadge(salesStreakSlug(t), date, { streak: salesStreak });
        }
      }

      // Streak milestone notification (every 10 days)
      if (salesStreak > 0 && salesStreak % 10 === 0) {
        emitInAppNotification({
          id: `streak-milestone-${salesStreak}-${date}`,
          title: `🔥 ${salesStreak}-Day Streak!`,
          body: `You've sold ${salesStreak} days in a row. Keep the fire alive!`,
          type: "streak_milestone",
        });
      }

      // Multi-sale streaks (no protection — these require actual multi-sales)
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

      // --- Streak protection detection ---
      // If today has no sale, check if rep earned effort-based protection
      if (closes === 0 && doors > 0) {
        await detectStreakProtection(userId, date, todayEntry, isRookie);
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

    const val = Number(entry[field]) || 0;
    if (val >= minValue) {
      streak++;
    } else if (freezeRule) {
      const freezeVal = Number(entry[freezeRule.field]) || 0;
      if (freezeVal >= freezeRule.threshold) {
        streak++;
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

/**
 * Like calcStreak but also continues the streak if the date has a protection record.
 */
function calcStreakWithProtection(
  entries: { entry_date: string; closes: number | null; transitions: number | null; presentations: number | null; doors_knocked: number | null }[],
  field: 'closes' | 'transitions' | 'presentations',
  minValue: number,
  freezeRule: { field: 'doors_knocked' | 'transitions'; threshold: number } | null,
  protectedDates: Set<string>
): number {
  if (!entries.length) return 0;

  let streak = 0;
  let expectedDate = new Date(entries[0].entry_date + 'T12:00:00');

  for (const entry of entries) {
    const entryDate = new Date(entry.entry_date + 'T12:00:00');
    const diffDays = Math.round((expectedDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > 1) break;

    const val = Number(entry[field]) || 0;
    if (val >= minValue) {
      streak++;
    } else if (protectedDates.has(entry.entry_date)) {
      // Day was protected by effort
      streak++;
    } else if (freezeRule) {
      const freezeVal = Number(entry[freezeRule.field]) || 0;
      if (freezeVal >= freezeRule.threshold) {
        streak++;
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

/**
 * Detect if a rep earned streak protection on a no-sale day.
 * Checks: season average for doors/presentations, weekly limits, then inserts protection.
 */
async function detectStreakProtection(
  userId: string,
  date: string,
  todayEntry: { doors_knocked: number; presentations: number; entry_date: string },
  isRookie: boolean
) {
  // Check if protection already exists for this date
  const { data: existing } = await supabase
    .from("streak_protections")
    .select("id")
    .eq("user_id", userId)
    .eq("entry_date", date)
    .maybeSingle();

  if (existing) return;

  // Check weekly limit
  const recentCount = await getRecentProtectionCount(userId);
  const maxPerWeek = isRookie ? STREAK_PROTECTION.MAX_PER_WEEK_ROOKIE : STREAK_PROTECTION.MAX_PER_WEEK_VET;
  if (recentCount >= maxPerWeek) return;

  // Get season averages
  const [avgDoors, avgPresentations] = await Promise.all([
    getSeasonAverage(userId, 'doors_knocked'),
    getSeasonAverage(userId, 'presentations'),
  ]);

  // Check minimum history — count knocking days this season
  const todayStr = date;
  const seasonStart = todayStr >= (SEASON_DATES.SUMMER_START_GLOBAL)
    ? SEASON_DATES.SUMMER_START_GLOBAL
    : SEASON_DATES.PRESEASON_START;

  const { count: knockingDayCount } = await supabase
    .from("daily_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("entry_date", seasonStart)
    .lt("entry_date", todayStr)
    .gt("doors_knocked", 0);

  const hasEnoughHistory = (knockingDayCount || 0) >= STREAK_PROTECTION.MIN_HISTORY_DAYS;

  // Calculate thresholds
  let doorThreshold: number;
  let presThreshold: number;

  if (hasEnoughHistory) {
    doorThreshold = Math.ceil(avgDoors * STREAK_PROTECTION.EFFORT_MULTIPLIER);
    presThreshold = Math.ceil(avgPresentations * STREAK_PROTECTION.EFFORT_MULTIPLIER);
  } else {
    // Use default floors for new reps
    if (isRookie) {
      doorThreshold = STREAK_PROTECTION.ROOKIE_DEFAULT_DOORS;
      presThreshold = Math.ceil(avgPresentations > 0 ? avgPresentations * STREAK_PROTECTION.EFFORT_MULTIPLIER : 999);
    } else {
      doorThreshold = Math.ceil(avgDoors > 0 ? avgDoors * STREAK_PROTECTION.EFFORT_MULTIPLIER : 999);
      presThreshold = STREAK_PROTECTION.VET_DEFAULT_TRANSITIONS;
    }
  }

  const doors = todayEntry.doors_knocked || 0;
  const presentations = todayEntry.presentations || 0;

  let method: string | null = null;
  let baseline = 0;
  let actual = 0;

  if (doors >= doorThreshold && doorThreshold > 0) {
    method = 'doors_150';
    baseline = avgDoors;
    actual = doors;
  } else if (presentations >= presThreshold && presThreshold > 0) {
    method = 'presentations_150';
    baseline = avgPresentations;
    actual = presentations;
  }

  if (!method) return;

  // Insert protection
  await supabase.from("streak_protections").insert({
    user_id: userId,
    entry_date: date,
    protection_type: 'earned',
    method,
    baseline_value: Math.round(baseline * 10) / 10,
    actual_value: actual,
    streak_length: 0, // will be updated by streak calc
  });

  // Toast + in-app notification
  toast({
    title: "🛡️ Streak Protected!",
    description: "Your effort today earned you a streak shield!",
  });

  emitInAppNotification({
    id: `streak-shield-${date}`,
    title: "🛡️ Streak Protected!",
    body: "Your effort today earned you a streak shield!",
    type: "streak_shield_earned",
  });
}
