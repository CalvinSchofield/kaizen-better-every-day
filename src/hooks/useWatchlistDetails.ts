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

      // Fetch reps info and entries in parallel
      const [repsResult, entriesResult] = await Promise.all([
        supabase
          .from("reps")
          .select("user_id, name, profile_photo_url, year")
          .in("user_id", allUserIds),
        supabase
          .from("daily_entries")
          .select("user_id, entry_date, fp_plus, prmr, doors_knocked, sales_log, is_finalized")
          .in("user_id", allUserIds)
          .gte("entry_date", seasonStart)
          .lte("entry_date", today),
      ]);

      const repsMap = new Map(
        (repsResult.data || []).map((r) => [r.user_id, r])
      );

      // Process entries per user
      const userDataMap = new Map<string, {
        todayFp: number; todayPrmr: number; todayDoors: number;
        yesterdayFp: number;
        dailyFp: Map<string, number>; // date -> fp for sparkline
        weekFp: number; monthFp: number; seasonFp: number;
      }>();

      const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

      for (const uid of allUserIds) {
        userDataMap.set(uid, {
          todayFp: 0, todayPrmr: 0, todayDoors: 0,
          yesterdayFp: 0,
          dailyFp: new Map(),
          weekFp: 0, monthFp: 0, seasonFp: 0,
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
      }

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
