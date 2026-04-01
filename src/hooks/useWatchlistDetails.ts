import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWatchlist } from "./useWatchlist";
import { useCurrentUserId } from "./useCurrentUserId";
import { getLocalDateString } from "@/lib/utils";
import { format, subDays } from "date-fns";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

export interface WatchedUserDetail {
  userId: string;
  name: string;
  photoUrl: string | null;
  year: string | null;
  // Today's stats
  todayFp: number;
  todayPrmr: number;
  todayDoors: number;
  // Yesterday's stats
  yesterdayFp: number;
  // 7-day sparkline data (fp_plus per day, oldest first)
  sparkline: number[];
  // Aggregated period stats
  weekFp: number;
  monthFp: number;
  seasonFp: number;
  // Current sales streak
  salesStreak: number;
  // Shield count in current streak
  streakShieldCount: number;
}

export interface WatchlistDetailsData {
  watchedUsers: WatchedUserDetail[];
  currentUser: WatchedUserDetail | null;
}

export const useWatchlistDetails = () => {
  const { watchedUserIds } = useWatchlist();
  const { userId } = useCurrentUserId();

  return useQuery({
    queryKey: ["watchlist-details", watchedUserIds, userId],
    queryFn: async (): Promise<WatchlistDetailsData> => {
      if (!userId || watchedUserIds.length === 0) {
        return { watchedUsers: [], currentUser: null };
      }

      const allUserIds = [...new Set([...watchedUserIds, userId])];
      const today = getLocalDateString(new Date());
      const sevenDaysAgo = format(subDays(new Date(), 7), "yyyy-MM-dd");
      
      // Get this week's start (Sunday)
      const now = new Date();
      const sunday = new Date(now);
      sunday.setDate(sunday.getDate() - sunday.getDay());
      const weekStart = getLocalDateString(sunday);
      
      // Get this month's start
      const monthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
      
      // Season start
      const seasonStart = "2025-09-28";

      // Fetch reps info, entries, and protections in parallel
      const [repsResult, entriesResult, protectionsResult] = await Promise.all([
        supabase
          .from("reps")
          .select("user_id, name, profile_photo_url, year")
          .in("user_id", allUserIds),
        supabase
          .from("daily_entries")
          .select("user_id, entry_date, fp_plus, prmr, doors_knocked, sales_log, is_finalized, closes")
          .in("user_id", allUserIds)
          .gte("entry_date", seasonStart)
          .lte("entry_date", today),
        supabase
          .from("streak_protections")
          .select("user_id, entry_date")
          .in("user_id", allUserIds)
          .order("entry_date", { ascending: false })
          .limit(500),
      ]);

      // Build per-user protection date sets
      const userProtections = new Map<string, Set<string>>();
      for (const p of protectionsResult.data || []) {
        if (!userProtections.has(p.user_id)) userProtections.set(p.user_id, new Set());
        userProtections.get(p.user_id)!.add(p.entry_date);
      }

      const repsMap = new Map(
        (repsResult.data || []).map((r) => [r.user_id, r])
      );

      // Process entries per user
      const userDataMap = new Map<string, {
        todayFp: number; todayPrmr: number; todayDoors: number;
        yesterdayFp: number;
        dailyFp: Map<string, number>; // date -> fp for sparkline
        weekFp: number; monthFp: number; seasonFp: number;
        // For streak: sorted entry dates with closes info
        entryDates: { date: string; closes: number }[];
      }>();

      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

      for (const uid of allUserIds) {
        userDataMap.set(uid, {
          todayFp: 0, todayPrmr: 0, todayDoors: 0,
          yesterdayFp: 0,
          dailyFp: new Map(),
          weekFp: 0, monthFp: 0, seasonFp: 0,
          entryDates: [],
        });
      }

      for (const entry of entriesResult.data || []) {
        const ud = userDataMap.get(entry.user_id);
        if (!ud) continue;

        // Calculate FP from sales_log or fallback
        let fp = 0;
        let prmr = 0;
        const salesLog = entry.sales_log as any[];
        if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
          const fromLog = calculateFromSalesLog(salesLog);
          fp = fromLog.fp;
          prmr = fromLog.prmr;
        } else {
          fp = entry.fp_plus || 0;
          prmr = entry.prmr || 0;
        }

        // Season aggregate
        ud.seasonFp += fp;

        // Month aggregate
        if (entry.entry_date >= monthStart) ud.monthFp += fp;

        // Week aggregate
        if (entry.entry_date >= weekStart) ud.weekFp += fp;

        // Today
        if (entry.entry_date === today) {
          ud.todayFp += fp;
          ud.todayPrmr += prmr;
          ud.todayDoors += entry.doors_knocked || 0;
        }

        // Yesterday
        if (entry.entry_date === yesterday) {
          ud.yesterdayFp += fp;
        }

        // Sparkline (last 7 days)
        if (entry.entry_date >= sevenDaysAgo) {
          ud.dailyFp.set(entry.entry_date, (ud.dailyFp.get(entry.entry_date) || 0) + fp);
        }

        // Track for streak calculation
        ud.entryDates.push({ date: entry.entry_date, closes: entry.closes || 0 });
      }

      // Calculate sales streak for a user from their entries (with protection support)
      const calcSalesStreak = (uid: string, entryDates: { date: string; closes: number }[]): { streak: number; shieldCount: number } => {
        const protectedSet = userProtections.get(uid) || new Set<string>();
        // Sort descending by date
        const sorted = [...entryDates].sort((a, b) => b.date.localeCompare(a.date));
        // Deduplicate by date (take max closes)
        const byDate = new Map<string, number>();
        for (const e of sorted) {
          byDate.set(e.date, Math.max(byDate.get(e.date) || 0, e.closes));
        }
        const dates = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
        
        let streak = 0;
        let shieldCount = 0;
        let expectedDate = dates.length > 0 ? new Date(dates[0][0] + "T12:00:00") : null;
        
        for (const [dateStr, closes] of dates) {
          if (!expectedDate) break;
          const entryDate = new Date(dateStr + "T12:00:00");
          const diffDays = Math.round(
            (expectedDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (diffDays > 1) break;
          if (closes >= 1) {
            streak++;
          } else if (protectedSet.has(dateStr)) {
            streak++;
            shieldCount++;
          } else {
            break;
          }
          expectedDate = new Date(entryDate);
          expectedDate.setDate(expectedDate.getDate() - 1);
        }
        return { streak, shieldCount };
      };

      // Build sparkline arrays (7 days, oldest first)
      const buildSparkline = (dailyFp: Map<string, number>): number[] => {
        const result: number[] = [];
        for (let i = 6; i >= 0; i--) {
          const date = format(subDays(new Date(), i), "yyyy-MM-dd");
          result.push(dailyFp.get(date) || 0);
        }
        return result;
      };

      const buildDetail = (uid: string): WatchedUserDetail | null => {
        const rep = repsMap.get(uid);
        const ud = userDataMap.get(uid);
        if (!rep || !ud) return null;
        return {
          userId: uid,
          name: rep.name?.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim() || "Unknown",
          photoUrl: rep.profile_photo_url,
          year: rep.year,
          todayFp: ud.todayFp,
          todayPrmr: ud.todayPrmr,
          todayDoors: ud.todayDoors,
          yesterdayFp: ud.yesterdayFp,
          sparkline: buildSparkline(ud.dailyFp),
          weekFp: ud.weekFp,
          monthFp: ud.monthFp,
          seasonFp: ud.seasonFp,
          ...(() => {
            const s = calcSalesStreak(uid, ud.entryDates);
            return { salesStreak: s.streak, streakShieldCount: s.shieldCount };
          })(),
        };
      };

      const watchedUsers = watchedUserIds
        .map(buildDetail)
        .filter(Boolean) as WatchedUserDetail[];

      // Sort by season FP descending
      watchedUsers.sort((a, b) => b.seasonFp - a.seasonFp);

      return {
        watchedUsers,
        currentUser: buildDetail(userId),
      };
    },
    enabled: !!userId && watchedUserIds.length > 0,
    staleTime: 2 * 60 * 1000,
  });
};
