import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tiebreakerCompare, YearRank } from "@/utils/leaderboardTiebreaker";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { isRepActive } from "@/utils/repStatusUtils";
import { getCleanName } from "@/utils/nameUtils";

interface RankingEntry {
  userId: string;
  name: string;
  value: number;
  pendingValue?: number;
  isWorking?: boolean;
  profilePhotoUrl?: string | null;
  year?: YearRank;
  tiebreaker?: number;
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
    closes: RankingEntry[];
  };
}

const getLocalDateString = (date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Get "today" date string for a given timezone in stable YYYY-MM-DD format
const getTodayInTimezone = (timezone: string | null): string => {
  const fallback = getLocalDateString();

  try {
    const tz = timezone || "America/Los_Angeles";
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (!year || !month || !day) return fallback;
    return `${year}-${month}-${day}`;
  } catch {
    return fallback;
  }
};

export const useTodayLeaderboard = (filterByYear?: string) => {
  // Cache key rolls on local midnight to keep live query fresh per day
  const todayDateKey = getLocalDateString();

  return useQuery({
    queryKey: ["today-leaderboard", todayDateKey, filterByYear],
    queryFn: async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split("T")[0];

      const [repsResponse, entriesResponse] = await Promise.all([
        supabase
          .from("reps")
          .select("user_id, name, year, timezone, profile_photo_url, stage"),
        supabase
          .from("daily_entries")
          .select(
            "user_id, entry_date, timezone, updated_at, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, upgrade_prmr, is_finalized, sales_log"
          )
          .gte("entry_date", twoDaysAgoStr),
      ]);

      if (repsResponse.error) throw repsResponse.error;
      if (entriesResponse.error) throw entriesResponse.error;

      const repsMap = new Map(
        repsResponse.data
          ?.filter((r) => isRepActive(r.stage))
          .map((r) => [
            r.user_id,
            {
              name: r.name,
              year: r.year,
              timezone: r.timezone,
              profilePhotoUrl: r.profile_photo_url,
            },
          ]) || []
      );

      const entries = entriesResponse.data;

      // Filter entries to only include those where entry_date matches "today" in the entry/rep timezone
      const todayEntries =
        entries?.filter((entry) => {
          const repInfo = repsMap.get(entry.user_id);
          if (!repInfo) return false;

          const effectiveTimezone = entry.timezone || repInfo.timezone;
          const repToday = getTodayInTimezone(effectiveTimezone);
          return entry.entry_date === repToday;
        }) || [];

      // Deduplicate by user. Prefer finalized rows if both exist, then latest updated row.
      const seenUsers = new Set<string>();
      const dedupedEntries = todayEntries
        .sort((a, b) => {
          if (a.is_finalized && !b.is_finalized) return -1;
          if (!a.is_finalized && b.is_finalized) return 1;

          const aUpdatedAt = a.updated_at ? new Date(a.updated_at).getTime() : 0;
          const bUpdatedAt = b.updated_at ? new Date(b.updated_at).getTime() : 0;
          return bUpdatedAt - aUpdatedAt;
        })
        .filter((entry) => {
          if (seenUsers.has(entry.user_id)) return false;
          seenUsers.add(entry.user_id);
          return true;
        });

      const filteredEntries = filterByYear
        ? dedupedEntries.filter((e) => repsMap.get(e.user_id)?.year === filterByYear)
        : dedupedEntries;

      const hasLiveActivity = (entry: (typeof filteredEntries)[number], computedValue = 0): boolean => {
        const salesLog = entry.sales_log as any[] | null;
        const hasSalesLog = !!(salesLog && salesLog.length > 0);

        return (
          !entry.is_finalized &&
          ((entry.doors_knocked ?? 0) > 0 ||
            (entry.decision_makers ?? 0) > 0 ||
            (entry.pitches ?? 0) > 0 ||
            (entry.transitions ?? 0) > 0 ||
            (entry.presentations ?? 0) > 0 ||
            (entry.fp_plus ?? 0) > 0 ||
            (entry.prmr ?? 0) > 0 ||
            computedValue > 0 ||
            hasSalesLog)
        );
      };

      // Activity order: doors → decision_makers → pitches → transitions → presentations
      const createRanking = (
        field: keyof typeof filteredEntries[0],
        tiebreakerField?: keyof typeof filteredEntries[0]
      ): RankingEntry[] => {
        return filteredEntries
          .map((entry) => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;

            const value = Number(entry[field]) || 0;
            if (value === 0) return null;

            const cleanName = getCleanName(repInfo.name);
            const tiebreaker = tiebreakerField ? Number(entry[tiebreakerField]) || 0 : 0;

            return {
              userId: entry.user_id,
              name: cleanName,
              value,
              isWorking: hasLiveActivity(entry),
              profilePhotoUrl: repInfo.profilePhotoUrl,
              year: repInfo.year as YearRank,
              tiebreaker,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) =>
            tiebreakerCompare(a.value, b.value, a.tiebreaker ?? 0, b.tiebreaker ?? 0, a.year, b.year)
          );
      };

      // Create FP+ ranking - use sales_log when present
      const createFpRanking = (): RankingEntry[] => {
        const prmrByUser = new Map<string, number>();
        filteredEntries.forEach((entry) => {
          const salesLog = entry.sales_log as any[];
          const hasSalesLog = salesLog && salesLog.length > 0;

          const prmrValue = hasSalesLog
            ? calculateFromSalesLog(salesLog).prmr
            : Number(entry.prmr) || 0;

          prmrByUser.set(entry.user_id, prmrValue);
        });

        return filteredEntries
          .map((entry) => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;

            const salesLog = entry.sales_log as any[];
            const hasSalesLog = salesLog && salesLog.length > 0;
            let value: number;
            let pendingValue = 0;

            if (hasSalesLog) {
              const fromLog = calculateFromSalesLog(salesLog);
              value = fromLog.fp;
              pendingValue = fromLog.pendingFp;
            } else {
              value = Number(entry.fp_plus) || 0;
            }

            if (value === 0) return null;

            const cleanName = getCleanName(repInfo.name);
            const prmrTiebreaker = prmrByUser.get(entry.user_id) || 0;

            return {
              userId: entry.user_id,
              name: cleanName,
              value,
              pendingValue: pendingValue > 0 ? pendingValue : undefined,
              isWorking: hasLiveActivity(entry, value),
              profilePhotoUrl: repInfo.profilePhotoUrl,
              year: repInfo.year as YearRank,
              tiebreaker: prmrTiebreaker,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) =>
            tiebreakerCompare(a.value, b.value, a.tiebreaker ?? 0, b.tiebreaker ?? 0, a.year, b.year)
          );
      };

      // Create PRMR ranking - use sales_log when present
      const createPrmrRanking = (): RankingEntry[] => {
        const fpByUser = new Map<string, number>();
        filteredEntries.forEach((entry) => {
          const salesLog = entry.sales_log as any[];
          const hasSalesLog = salesLog && salesLog.length > 0;

          const fpValue = hasSalesLog ? calculateFromSalesLog(salesLog).fp : Number(entry.fp_plus) || 0;
          fpByUser.set(entry.user_id, fpValue);
        });

        return filteredEntries
          .map((entry) => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;

            const salesLog = entry.sales_log as any[];
            const hasSalesLog = salesLog && salesLog.length > 0;
            let value: number;
            let pendingValue = 0;

            if (hasSalesLog) {
              const fromLog = calculateFromSalesLog(salesLog);
              value = fromLog.prmr;
              pendingValue = fromLog.pendingPrmr;
            } else {
              value = Number(entry.prmr) || 0;
            }

            if (value === 0) return null;

            const cleanName = getCleanName(repInfo.name);
            const fpTiebreaker = fpByUser.get(entry.user_id) || 0;

            return {
              userId: entry.user_id,
              name: cleanName,
              value,
              pendingValue: pendingValue > 0 ? pendingValue : undefined,
              isWorking: hasLiveActivity(entry, value),
              profilePhotoUrl: repInfo.profilePhotoUrl,
              year: repInfo.year as YearRank,
              tiebreaker: fpTiebreaker,
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) =>
            tiebreakerCompare(a.value, b.value, a.tiebreaker ?? 0, b.tiebreaker ?? 0, a.year, b.year)
          );
      };

      const leaderboard: TodayLeaderboard = {
        rankings: {
          fp_plus: createFpRanking(),
          prmr: createPrmrRanking(),
          presentations: createRanking("presentations", "transitions"),
          transitions: createRanking("transitions", "presentations"),
          pitches: createRanking("pitches", "transitions"),
          doors_knocked: createRanking("doors_knocked", "decision_makers"),
          decision_makers: createRanking("decision_makers", "pitches"),
          closes: createRanking("closes", "presentations"),
        },
      };

      return leaderboard;
    },
    staleTime: 0,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
  });
};
