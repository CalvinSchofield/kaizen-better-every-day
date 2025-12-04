import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RankingEntry {
  userId: string;
  name: string;
  value: number;
  isWorking?: boolean;
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
        .select("user_id, name, year, timezone");

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, { 
        name: r.name, 
        year: r.year,
        timezone: r.timezone 
      }]) || []);

      // Fetch recent entries (RLS allows last 2 days for timezone coverage)
      // Include is_finalized to prioritize finalized data, sales_log for running totals
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("user_id, entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, fp_plus, prmr, upgrade_prmr, is_finalized, sales_log");

      if (error) throw error;

      // Filter entries to only include those where entry_date matches "today" in rep's timezone
      const todayEntries = entries?.filter(entry => {
        const repInfo = repsMap.get(entry.user_id);
        if (!repInfo) return false;
        
        const repToday = getTodayInTimezone(repInfo.timezone);
        return entry.entry_date === repToday;
      }) || [];
      
      // PROTECTION LAYER: Sort so finalized entries appear first (finalized > unfinalized)
      // This ensures when there's both finalized and unfinalized for same user, finalized wins
      todayEntries.sort((a, b) => {
        if (a.is_finalized && !b.is_finalized) return -1;
        if (!a.is_finalized && b.is_finalized) return 1;
        return 0;
      });

      const filteredEntries = filterByYear 
        ? todayEntries.filter(e => repsMap.get(e.user_id)?.year === filterByYear)
        : todayEntries;

      // Create rankings arrays for each metric
      const createRanking = (field: keyof typeof filteredEntries[0]): RankingEntry[] => {
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
            return { userId: entry.user_id, name: cleanName, value, isWorking };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => b.value - a.value);
      };

      // Helper to calculate running totals from sales_log for unfinalized entries
      const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number } => {
        if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0 };
        
        let fp = 0;
        let prmr = 0;
        
        for (const sale of salesLog) {
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
      const createFpRanking = (): RankingEntry[] => {
        return filteredEntries
          .map(entry => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;
            
            let value: number;
            if (entry.is_finalized) {
              // Finalized: use the saved column value
              value = Number(entry.fp_plus) || 0;
            } else {
              // Unfinalized: calculate from sales_log OR use column if manually entered
              const fromLog = calculateFromSalesLog(entry.sales_log as any[]);
              const fromColumn = Number(entry.fp_plus) || 0;
              // Use whichever is higher (in case they manually entered something)
              value = Math.max(fromLog.fp, fromColumn);
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
            return { userId: entry.user_id, name: cleanName, value, isWorking };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => b.value - a.value);
      };

      // Create PRMR ranking - use sales_log for unfinalized, columns for finalized
      // Total PRMR = prmr (FP sales) + upgrade_prmr (upgrade sales)
      const createPrmrRanking = (): RankingEntry[] => {
        return filteredEntries
          .map(entry => {
            const repInfo = repsMap.get(entry.user_id);
            if (!repInfo) return null;
            
            let value: number;
            if (entry.is_finalized) {
              // Finalized: Total PRMR = prmr + upgrade_prmr
              value = (Number(entry.prmr) || 0) + (Number(entry.upgrade_prmr) || 0);
            } else {
              // Unfinalized: calculate from sales_log OR use columns if manually entered
              const fromLog = calculateFromSalesLog(entry.sales_log as any[]);
              const fromColumns = (Number(entry.prmr) || 0) + (Number(entry.upgrade_prmr) || 0);
              // Use whichever is higher
              value = Math.max(fromLog.prmr, fromColumns);
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
            return { userId: entry.user_id, name: cleanName, value, isWorking };
          })
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .sort((a, b) => b.value - a.value);
      };

      const leaderboard: TodayLeaderboard = {
        rankings: {
          fp_plus: createFpRanking(),
          prmr: createPrmrRanking(),
          presentations: createRanking('presentations'),
          transitions: createRanking('transitions'),
          pitches: createRanking('pitches'),
          doors_knocked: createRanking('doors_knocked'),
          decision_makers: createRanking('decision_makers'),
        },
      };

      return leaderboard;
    },
    staleTime: 30000, // 30 seconds for real-time feel
    refetchInterval: 60000, // Auto-refetch every minute
  });
};
