import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface YesterdayRepData {
  userId: string;
  name: string;
  teamName: string;
  mgmtGroupName: string;
  stats: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    isFinalized: boolean;
  };
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes?: number;
  durationMinutes: number;
}

interface UseTeamYesterdayDataParams {
  userIds: string[];
  excludeUserIds?: string[];
}

// Get "yesterday" date string for a given timezone
const getYesterdayInTimezone = (timezone: string | null): string => {
  try {
    const tz = timezone || 'America/Los_Angeles';
    const now = new Date();
    now.setDate(now.getDate() - 1);
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now);
  } catch {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }
};

// Calculate break minutes from break_periods JSON
const calculateBreakMinutes = (breakPeriods: any): number => {
  if (!breakPeriods || !Array.isArray(breakPeriods)) return 0;
  
  let totalMinutes = 0;
  for (const period of breakPeriods) {
    if (period.start && period.end) {
      const start = new Date(period.start);
      const end = new Date(period.end);
      totalMinutes += Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }
  }
  return totalMinutes;
};

// Calculate running totals from sales_log for unfinalized entries
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

export const useTeamYesterdayData = ({ userIds, excludeUserIds = [] }: UseTeamYesterdayDataParams) => {
  return useQuery({
    queryKey: ['team-yesterday-data', userIds, excludeUserIds],
    queryFn: async () => {
      const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
      
      if (filteredUserIds.length === 0) {
        return { reps: [] };
      }

      // Fetch reps with their info
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, timezone, team_leader")
        .in("user_id", filteredUserIds);

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, r]) || []);

      // Fetch yesterday's entries - only finalized
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Include both finalized AND unfinalized entries for yesterday
      // This ensures accurate team reports even when reps forget to save
      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("*")
        .in("user_id", filteredUserIds)
        .gte("entry_date", yesterdayStr)
        .lte("entry_date", yesterdayStr);

      if (error) throw error;

      // Fetch team/MGMT group mapping from cache
      const cachedAccess = localStorage.getItem('team-access-cache');
      let accessibleReps: any[] = [];
      if (cachedAccess) {
        try {
          const { data } = JSON.parse(cachedAccess);
          accessibleReps = data?.accessibleReps || [];
        } catch (e) {
          console.error('Failed to parse team access cache:', e);
        }
      }

      const repInfoMap = new Map(accessibleReps.map((r: any) => [r.userId, r]));

      const reps: YesterdayRepData[] = [];

      entries?.forEach(entry => {
        const repInfo = repsMap.get(entry.user_id);
        const teamInfo = repInfoMap.get(entry.user_id);
        const timezone = repInfo?.timezone;
        const repYesterday = getYesterdayInTimezone(timezone);
        
        // Only include if entry matches rep's yesterday
        if (entry.entry_date !== repYesterday) return;
        
        const teamName = teamInfo?.teamName || (repInfo?.team_leader ? `Team ${repInfo.team_leader}` : 'Unknown Team');
        const mgmtGroupName = teamInfo?.mgmtGroupName || 'Unknown Group';

        // Calculate FP+ and PRMR - use sales_log for unfinalized entries
        let fpValue: number;
        let prmrValue: number;
        
        if (entry.is_finalized) {
          fpValue = entry.fp_plus || 0;
          prmrValue = entry.prmr || 0;
        } else {
          const salesLog = entry.sales_log as any[];
          const fromLog = calculateFromSalesLog(salesLog);
          const fpFromColumn = entry.fp_plus || 0;
          const prmrFromColumn = entry.prmr || 0;
          fpValue = (salesLog && salesLog.length > 0) ? fromLog.fp : fpFromColumn;
          prmrValue = (salesLog && salesLog.length > 0) ? fromLog.prmr : prmrFromColumn;
        }

        const hasActivity = 
          (entry.doors_knocked ?? 0) > 0 ||
          fpValue > 0;

        if (!hasActivity) return;

        // Calculate duration
        let durationMinutes = 0;
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          durationMinutes = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
          durationMinutes -= calculateBreakMinutes(entry.break_periods);
          durationMinutes = Math.max(0, durationMinutes);
        }

        reps.push({
          userId: entry.user_id,
          name: repInfo?.name || 'Unknown',
          teamName,
          mgmtGroupName,
          stats: {
            doors: entry.doors_knocked || 0,
            dms: entry.decision_makers || 0,
            pitches: entry.pitches || 0,
            transitions: entry.transitions || 0,
            presentations: entry.presentations || 0,
            closes: entry.closes || 0,
            fp: fpValue,
            prmr: prmrValue,
            isFinalized: entry.is_finalized || false,
          },
          workStartTime: entry.work_start_time || undefined,
          workEndTime: entry.work_end_time || undefined,
          breakMinutes: calculateBreakMinutes(entry.break_periods),
          durationMinutes,
        });
      });

      // Sort by FP+ then PRMR then doors
      reps.sort((a, b) => {
        if (a.stats.fp !== b.stats.fp) return b.stats.fp - a.stats.fp;
        if (a.stats.prmr !== b.stats.prmr) return b.stats.prmr - a.stats.prmr;
        return b.stats.doors - a.stats.doors;
      });

      return { reps };
    },
    staleTime: 60000,
    enabled: userIds.length > 0,
  });
};
