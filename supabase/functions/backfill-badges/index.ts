import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Badge slug helpers
const dailyFpSlug = (n: number) => `daily_fp_${n}`;
const salesStreakSlug = (n: number) => `streak_sales_${n}`;
const transitionStreakSlug = (n: number) => `streak_transition_${n}`;
const presentationStreakSlug = (n: number) => `streak_presentation_${n}`;

const DAILY_FP_THRESHOLDS = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const SALES_STREAK_THRESHOLDS = [3, 5, 7, 10, 14, 21];
const TRANSITION_STREAK_THRESHOLDS = [3, 5, 7, 10, 14, 21, 30];
const PRESENTATION_STREAK_THRESHOLDS = [3, 5, 7, 10, 14, 21, 30];
const MULTI_SALE_STREAKS = [
  { min: 2, days: 3, slug: "streak_multi_2_3" },
  { min: 2, days: 5, slug: "streak_multi_2_5" },
  { min: 3, days: 3, slug: "streak_multi_3_3" },
  { min: 4, days: 3, slug: "streak_multi_4_3" },
];

interface DailyEntry {
  entry_date: string;
  user_id: string;
  doors_knocked: number | null;
  transitions: number | null;
  presentations: number | null;
  closes: number | null;
  fp_plus: number | null;
  prmr: number | null;
  upgrade_prmr: number | null;
  sales_log: any[] | null;
  counter_timestamps: Record<string, string[]> | null;
  is_finalized: boolean | null;
  timezone: string | null;
}

interface BadgeDef {
  id: string;
  slug: string;
  rookie_only: boolean | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load all badge definitions
    const { data: badgeDefs, error: defError } = await supabase
      .from("badge_definitions")
      .select("id, slug, rookie_only");
    if (defError) throw defError;

    const slugToId = new Map<string, string>();
    const slugToRookieOnly = new Map<string, boolean>();
    for (const d of badgeDefs as BadgeDef[]) {
      slugToId.set(d.slug, d.id);
      slugToRookieOnly.set(d.slug, d.rookie_only ?? false);
    }

    // Load all reps to check rookie status
    const { data: reps } = await supabase
      .from("reps")
      .select("user_id, year, timezone");
    const rookieUserIds = new Set<string>();
    const userTimezones = new Map<string, string>();
    for (const r of reps || []) {
      if (r.user_id) {
        if (r.year === "Rookie" || r.year === "rookie" || !r.year) {
          rookieUserIds.add(r.user_id);
        }
        if (r.timezone) {
          userTimezones.set(r.user_id, r.timezone);
        }
      }
    }

    // Load ALL daily entries ordered by user and date
    const { data: entries, error: entryError } = await supabase
      .from("daily_entries")
      .select("entry_date, user_id, doors_knocked, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr, sales_log, counter_timestamps, is_finalized")
      .order("entry_date", { ascending: true });
    if (entryError) throw entryError;

    // Group entries by user
    const byUser = new Map<string, DailyEntry[]>();
    for (const e of (entries || []) as DailyEntry[]) {
      const list = byUser.get(e.user_id) || [];
      list.push(e);
      byUser.set(e.user_id, list);
    }

    // Load existing badges to avoid duplicates
    const { data: existingBadges } = await supabase
      .from("user_badges")
      .select("user_id, badge_id, entry_date");
    const existingSet = new Set<string>();
    for (const eb of existingBadges || []) {
      existingSet.add(`${eb.user_id}|${eb.badge_id}|${eb.entry_date}`);
    }

    const toInsert: { user_id: string; badge_id: string; entry_date: string; metadata: any }[] = [];

    function award(userId: string, slug: string, entryDate: string, metadata: any = {}) {
      const badgeId = slugToId.get(slug);
      if (!badgeId) return;
      if (slugToRookieOnly.get(slug) && !rookieUserIds.has(userId)) return;
      const key = `${userId}|${badgeId}|${entryDate}`;
      if (existingSet.has(key)) return;
      existingSet.add(key); // prevent dupes within this run
      toInsert.push({ user_id: userId, badge_id: badgeId, entry_date: entryDate, metadata });
    }

    for (const [userId, userEntries] of byUser) {
      // Sort ascending by date
      userEntries.sort((a, b) => a.entry_date.localeCompare(b.entry_date));
      const isRookie = rookieUserIds.has(userId);

      for (const entry of userEntries) {
        const date = entry.entry_date;
        const fp = entry.fp_plus || 0;
        const closes = entry.closes || 0;
        const doors = entry.doors_knocked || 0;
        const upgradePrmr = entry.upgrade_prmr || 0;
        const salesLog = entry.sales_log;

        // --- Daily FP+ milestones ---
        for (const threshold of DAILY_FP_THRESHOLDS) {
          if (fp >= threshold) {
            award(userId, dailyFpSlug(threshold), date, { value: fp });
          }
        }

        // --- First Door Magic ---
        if (closes > 0 && doors === 1) {
          award(userId, "first_door_magic", date);
        }

        // --- Night Owl ---
        if (closes > 0 && entry.counter_timestamps) {
          const doorTs = entry.counter_timestamps["doors_knocked"];
          if (doorTs && Array.isArray(doorTs)) {
            const hasLate = doorTs.some((ts: string) => new Date(ts).getHours() >= 21);
            if (hasLate) {
              award(userId, "night_owl", date);
            }
          }
        }

        // --- 1-2 Combo ---
        if (salesLog && Array.isArray(salesLog)) {
          const hasFp = salesLog.some(
            (s: any) => s.type === "fp" && s.install_status !== "never_installed" && s.install_status !== "cancelled"
          );
          const hasUpgrade = salesLog.some(
            (s: any) => s.type === "upgrade" && s.install_status !== "never_installed" && s.install_status !== "cancelled"
          );
          if (hasFp && hasUpgrade) {
            award(userId, "one_two_combo", date);
          }
        }

        // --- Upgrade Assassin ---
        if (upgradePrmr >= 85) {
          award(userId, "upgrade_assassin", date, { value: upgradePrmr });
        }
      }

      // --- Streak calculations ---
      // We need to process entries in reverse chronological order for each "peak" streak
      // But simpler: walk forward, tracking current streaks

      // Sales streak (no freeze)
      let salesStreak = 0;
      let lastSalesDate: string | null = null;
      let bestSalesStreakDate: string | null = null;

      // Transition streak (freeze if 80+ doors)
      let transStreak = 0;
      let lastTransDate: string | null = null;

      // Presentation streak (freeze if 2+ transitions)
      let presStreak = 0;
      let lastPresDate: string | null = null;

      // Multi-sale tracking
      const multiSaleStreaks: Record<string, { streak: number; lastDate: string | null }> = {};
      for (const ms of MULTI_SALE_STREAKS) {
        multiSaleStreaks[ms.slug] = { streak: 0, lastDate: null };
      }

      for (const entry of userEntries) {
        const date = entry.entry_date;
        const closes = entry.closes || 0;
        const doors = entry.doors_knocked || 0;
        const transitions = entry.transitions || 0;
        const presentations = entry.presentations || 0;

        const isConsecutive = (lastDate: string | null) => {
          if (!lastDate) return false;
          const prev = new Date(lastDate + "T12:00:00");
          const curr = new Date(date + "T12:00:00");
          const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
          return diff === 1;
        };

        // Sales streak
        if (closes >= 1) {
          salesStreak = isConsecutive(lastSalesDate) ? salesStreak + 1 : 1;
          lastSalesDate = date;
        } else {
          // Award any earned streaks before resetting
          for (const t of SALES_STREAK_THRESHOLDS) {
            if (salesStreak >= t && lastSalesDate) {
              award(userId, salesStreakSlug(t), lastSalesDate, { streak: salesStreak });
            }
          }
          salesStreak = 0;
          lastSalesDate = null;
        }

        // Multi-sale streaks
        for (const ms of MULTI_SALE_STREAKS) {
          const tracker = multiSaleStreaks[ms.slug];
          if (closes >= ms.min) {
            tracker.streak = isConsecutive(tracker.lastDate) ? tracker.streak + 1 : 1;
            tracker.lastDate = date;
            if (tracker.streak >= ms.days) {
              award(userId, ms.slug, date, { streak: tracker.streak, minCloses: ms.min });
            }
          } else {
            tracker.streak = 0;
            tracker.lastDate = null;
          }
        }

        // Transition streak (rookie only, freeze with 80+ doors)
        if (isRookie) {
          if (transitions >= 1) {
            transStreak = isConsecutive(lastTransDate) ? transStreak + 1 : 1;
            lastTransDate = date;
          } else if (doors >= 80) {
            // Freeze
            transStreak = isConsecutive(lastTransDate) ? transStreak + 1 : 1;
            lastTransDate = date;
          } else {
            for (const t of TRANSITION_STREAK_THRESHOLDS) {
              if (transStreak >= t && lastTransDate) {
                award(userId, transitionStreakSlug(t), lastTransDate, { streak: transStreak });
              }
            }
            transStreak = 0;
            lastTransDate = null;
          }

          // Presentation streak (rookie only, freeze with 2+ transitions)
          if (presentations >= 1) {
            presStreak = isConsecutive(lastPresDate) ? presStreak + 1 : 1;
            lastPresDate = date;
          } else if (transitions >= 2) {
            presStreak = isConsecutive(lastPresDate) ? presStreak + 1 : 1;
            lastPresDate = date;
          } else {
            for (const t of PRESENTATION_STREAK_THRESHOLDS) {
              if (presStreak >= t && lastPresDate) {
                award(userId, presentationStreakSlug(t), lastPresDate, { streak: presStreak });
              }
            }
            presStreak = 0;
            lastPresDate = null;
          }
        }
      }

      // Award any remaining active streaks at end of data
      for (const t of SALES_STREAK_THRESHOLDS) {
        if (salesStreak >= t && lastSalesDate) {
          award(userId, salesStreakSlug(t), lastSalesDate, { streak: salesStreak });
        }
      }
      if (isRookie) {
        for (const t of TRANSITION_STREAK_THRESHOLDS) {
          if (transStreak >= t && lastTransDate) {
            award(userId, transitionStreakSlug(t), lastTransDate, { streak: transStreak });
          }
        }
        for (const t of PRESENTATION_STREAK_THRESHOLDS) {
          if (presStreak >= t && lastPresDate) {
            award(userId, presentationStreakSlug(t), lastPresDate, { streak: presStreak });
          }
        }
      }
    }

    // Batch insert all badges
    let inserted = 0;
    const batchSize = 500;
    for (let i = 0; i < toInsert.length; i += batchSize) {
      const batch = toInsert.slice(i, i + batchSize);
      const { error: insertError } = await supabase
        .from("user_badges")
        .upsert(batch, { onConflict: "user_id,badge_id,entry_date", ignoreDuplicates: true });
      if (insertError) {
        console.error("Batch insert error:", insertError);
      } else {
        inserted += batch.length;
      }
    }

    // Summary
    const userCount = byUser.size;
    const entryCount = entries?.length || 0;

    return new Response(
      JSON.stringify({
        success: true,
        users_processed: userCount,
        entries_scanned: entryCount,
        badges_awarded: inserted,
        badge_breakdown: toInsert.reduce((acc, b) => {
          const slug = [...slugToId.entries()].find(([_, id]) => id === b.badge_id)?.[0] || "unknown";
          acc[slug] = (acc[slug] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Backfill error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
