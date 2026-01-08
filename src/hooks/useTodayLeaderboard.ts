import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { tiebreakerCompare, YearRank } from "@/utils/leaderboardTiebreaker";

interface RankingEntry {
  userId: string;
  name: string;
  value: number;
  isWorking?: boolean;
  profilePhotoUrl?: string | null;
  year?: YearRank;
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
  };
}

// Get "today" date string for a given timezone
const getTodayInTimezone = (timezone: string | null): string => {
  try {
    const tz = timezone || 'America/Los_Angeles'; // Default to Pacific
    const now = new Date();
    // Format the current time in the target timezone to get local date
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now); // Returns YYYY-MM-DD format
  } catch {
    // Fallback to local date if timezone is invalid
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
};

export const useTodayLeaderboard = (filterByYear?: string) => {
  return useQuery({
    queryKey: ["today-leaderboard", filterByYear],
    queryFn: async () => {
      // Fetch reps with timezone info
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, year, timezone, profile_photo_url");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { 
        name: r.name, 
        year: r.year,
        timezone: r.timezone,
        profilePhotoUrl: r.profile_photo_url
      }]) || []);

      // Fetch entries from the last 2 days to handle timezone edge cases
      // (entry_date stored as YYYY-MM-DD may be "today" or "yesterday" depending on viewer's timezone)
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
      const twoDaysAgoStr = twoDaysAgo.toISOString().split('T')[0];
      
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, is_finalized, sales_log")
        .gte("entry_date", twoDaysAgoStr);

      if (error) throw error;

      // Filter entries to only include those where entry_date matches "today" in rep's timezone
      const todayEntries = entries?.filter(entry => {
        const repInfo = repsMap.get(entry.user_id);
        if (!repInfo) return false;
        
        const repToday = getTodayInTimezone(repInfo.timezone);
        return entry.entry_date === repToday;
      }) || [];
      
      // PROTECTION LAYER: Deduplicate by user - if someone has both finalized and unfinalized for today,
      // prioritize finalized. Sort so finalized entries appear first, then take first per user.
      const seenUsers = new Set<string>();
      const dedupedEntries = todayEntries
        .sort((a, b) => {
          // Finalized first
          if (a.is_finalized && !b.is_finalized) return -1;
          if (!a.is_finalized && b.is_finalized) return 1;
          return 0;
        })
        .filter(entry => {
          if (seenUsers.has(entry.user_id)) return false;
          seenUsers.add(entry.user_id);
          return true;
        });

      const filteredEntries = filterByYear 
        ? dedupedEntries.filter(e => repsMap.get(e.user_id)?.year === filterByYear)
        : dedupedEntries;

      // Create rankings arrays for each metric with tiebreaking
      // Activity order: doors → decision_makers → pitches → transitions → presentations
      const createRanking = (
        field: keyof typeof filteredEntries[0], 
        tiebreakerField?: keyof typeof filteredEntries[0]
      ): RankingEntry[] => {
        return filteredEntries
          .map(entry => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;
            const value = Number(entry[field]) || 0;
            if (value === 0) return null;
            const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
            // User is "working" if entry is unfinalized and has activity
            const isWorking = !entry.is_finalized && (
              (entry.doors_knocked ?? 0) > 0 ||
              (entry.decision_makers ?? 0) > 0 ||
              (entry.pitches ?? 0) > 0 ||
              (entry.transitions ?? 0) > 0 ||
              (entry.presentations ?? 0) > 0 ||
              (entry.fp_plus ?? 0) > 0
            );
            const tiebreaker = tiebreakerField ? (Number(entry[tiebreakerField]) || 0) : 0;
            return { 
              userId: entry.user_id, 
              name: cleanName, 
              value, 
              isWorking, 
              profilePhotoUrl: repInfo.profilePhotoUrl,
              year: repInfo.year as YearRank,
              tiebreaker
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => tiebreakerCompare(a.value, b.value, a.tiebreaker ?? 0, b.tiebreaker ?? 0, a.year, b.year));
      };

      // Helper to calculate running totals from sales_log for unfinalized entries
      const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number } => {
        if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0 };
        
        let fp = 0;
        let prmr = 0;
        
        for (const sale of salesLog) {
          // Skip sales that were never installed
          if (sale.install_status === 'never_installed') continue;
          
          const salePrmr = Number(sale.prmr) || 0;
          prmr += salePrmr;
          
          if (sale.type === 'fp') {
            fp += 1;
          } else if (sale.type === 'upgrade') {
            // Upgrade FP+ = PRMR / 85
            fp += salePrmr / 85;
          }
        }
        
        return { fp, prmr };
      };

      // Create FP+ ranking - use sales_log for unfinalized, columns for finalized
      // Include PRMR as tiebreaker, then year
      const createFpRanking = (): RankingEntry[] => {
        // First, build a map of user_id to their PRMR for tiebreaker
        const prmrByUser = new Map<string, number>();
        filteredEntries.forEach(entry => {
          let prmrValue: number;
          if (entry.is_finalized) {
            prmrValue = Number(entry.prmr) || 0;
          } else {
            // Prioritize sales_log if it has entries (supports edits/deletes)
            const salesLog = entry.sales_log as any[];
            const fromLog = calculateFromSalesLog(salesLog);
            const fromColumns = Number(entry.prmr) || 0;
            prmrValue = (salesLog && salesLog.length > 0) ? fromLog.prmr : fromColumns;
          }
          prmrByUser.set(entry.user_id, prmrValue);
        });

        return filteredEntries
          .map(entry => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;
            
            let value: number;
            if (entry.is_finalized) {
              // Finalized: use the saved column value
              value = Number(entry.fp_plus) || 0;
            } else {
              // Unfinalized: prioritize sales_log if it has entries (supports edits/deletes)
              const salesLog = entry.sales_log as any[];
              const fromLog = calculateFromSalesLog(salesLog);
              const fromColumn = Number(entry.fp_plus) || 0;
              // Use sales_log calculation if there are sales, otherwise use column
              value = (salesLog && salesLog.length > 0) ? fromLog.fp : fromColumn;
            }
            
            if (value === 0) return null;
            const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
            const isWorking = !entry.is_finalized && (
              (entry.doors_knocked ?? 0) > 0 ||
              (entry.decision_makers ?? 0) > 0 ||
              (entry.pitches ?? 0) > 0 ||
              (entry.transitions ?? 0) > 0 ||
              (entry.presentations ?? 0) > 0 ||
              value > 0
            );
            const prmrTiebreaker = prmrByUser.get(entry.user_id) || 0;
            return { 
              userId: entry.user_id, 
              name: cleanName, 
              value, 
              isWorking, 
              profilePhotoUrl: repInfo.profilePhotoUrl,
              year: repInfo.year as YearRank,
              tiebreaker: prmrTiebreaker
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => tiebreakerCompare(a.value, b.value, a.tiebreaker ?? 0, b.tiebreaker ?? 0, a.year, b.year));
      };

      // Create PRMR ranking - use sales_log for unfinalized, columns for finalized
      // FP+ as tiebreaker, then year
      const createPrmrRanking = (): RankingEntry[] => {
        // Build FP+ map for tiebreaker
        const fpByUser = new Map<string, number>();
        filteredEntries.forEach(entry => {
          let fpValue: number;
          if (entry.is_finalized) {
            fpValue = Number(entry.fp_plus) || 0;
          } else {
            const salesLog = entry.sales_log as any[];
            const fromLog = calculateFromSalesLog(salesLog);
            fpValue = (salesLog && salesLog.length > 0) ? fromLog.fp : (Number(entry.fp_plus) || 0);
          }
          fpByUser.set(entry.user_id, fpValue);
        });

        return filteredEntries
          .map(entry => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;
            
            let value: number;
            if (entry.is_finalized) {
              value = Number(entry.prmr) || 0;
            } else {
              const salesLog = entry.sales_log as any[];
              const fromLog = calculateFromSalesLog(salesLog);
              const fromColumns = Number(entry.prmr) || 0;
              value = (salesLog && salesLog.length > 0) ? fromLog.prmr : fromColumns;
            }
            
            if (value === 0) return null;
            const cleanName = repInfo.name.replace(/[\p{Emoji}\p{Emoji_Component}]/gu, '').trim();
            const isWorking = !entry.is_finalized && (
              (entry.doors_knocked ?? 0) > 0 || (entry.fp_plus ?? 0) > 0 || value > 0
            );
            const fpTiebreaker = fpByUser.get(entry.user_id) || 0;
            return { 
              userId: entry.user_id, name: cleanName, value, isWorking, 
              profilePhotoUrl: repInfo.profilePhotoUrl,
              year: repInfo.year as YearRank,
              tiebreaker: fpTiebreaker
            };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => tiebreakerCompare(a.value, b.value, a.tiebreaker ?? 0, b.tiebreaker ?? 0, a.year, b.year));
      };

      const leaderboard: TodayLeaderboard = {
        rankings: {
          fp_plus: createFpRanking(),
          prmr: createPrmrRanking(),
          presentations: createRanking('presentations', 'transitions'),
          transitions: createRanking('transitions', 'presentations'),
          pitches: createRanking('pitches', 'transitions'),
          doors_knocked: createRanking('doors_knocked', 'decision_makers'),
          decision_makers: createRanking('decision_makers', 'pitches'),
        },
      };

      return leaderboard;
    },
    staleTime: 30000, // 30 seconds for real-time feel
    refetchInterval: 60000, // Auto-refetch every minute
  });
};
