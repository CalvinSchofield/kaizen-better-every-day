import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LiveRepData {
  userId: string;
  name: string;
  year?: string;
  teamName: string;
  mgmtGroupName: string;
  phone?: string;
  notionPageId?: string;
  timezone?: string;
  isWorking: boolean;
  hasForgottenEntry: boolean;
  forgottenDate?: string;
  forgottenEntryId?: string;
  personalSummerStart?: string | null;
  todayStats: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    upgradePrmr?: number;
    isFinalized?: boolean;
  };
  // Historical averages for pace comparison
  avgPitchesPerHour?: number;
  avgTransitionsPerHour?: number;
  avgDoorsPerHour?: number;
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes?: number;
  // Timeline data for detailed view
  entryId?: string;
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
}

interface UseTeamLiveDataParams {
  userIds: string[];
  excludeUserIds?: string[];
}

// Get "today" date string for a given timezone
const getTodayInTimezone = (timezone: string | null): string => {
  try {
    const tz = timezone || 'America/Los_Angeles';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', { 
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now);
  } catch {
    const now = new Date();
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

// Calculate FP+ and PRMR from sales_log for unfinalized entries
const calculateFromSalesLog = (salesLog: any[]): { fp: number; prmr: number; upgradePrmr: number } => {
  if (!salesLog || !Array.isArray(salesLog)) return { fp: 0, prmr: 0, upgradePrmr: 0 };
  
  let fp = 0;
  let prmr = 0;
  let upgradePrmr = 0;
  
  for (const sale of salesLog) {
    const salePrmr = Number(sale.prmr) || 0;
    prmr += salePrmr;
    
    if (sale.type === 'fp') {
      fp += 1;
    } else if (sale.type === 'upgrade') {
      // Upgrade FP+ = PRMR / 85
      fp += salePrmr / 85;
      upgradePrmr += salePrmr;
    }
  }
  
  return { fp, prmr, upgradePrmr };
};

export const useTeamLiveData = ({ userIds, excludeUserIds = [] }: UseTeamLiveDataParams) => {
  return useQuery({
    queryKey: ['team-live-data', userIds, excludeUserIds],
    queryFn: async () => {
      const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
      
      if (filteredUserIds.length === 0) {
        return { liveReps: [], workingCount: 0, forgottenCount: 0 };
      }

      // Fetch reps with their info including team_leader, year, phone, and id
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("id, user_id, name, timezone, team_leader, year, phone")
        .in("user_id", filteredUserIds);

      if (repsError) throw repsError;

      // Fetch season_config for summer start dates
      const { data: seasonConfigs } = await supabase
        .from("season_config")
        .select("user_id, personal_summer_start")
        .in("user_id", filteredUserIds);

      const repsMap = new Map(repsData?.map(r => [r.user_id, r]) || []);
      const seasonConfigMap = new Map(seasonConfigs?.map(c => [c.user_id, c]) || []);

      // Fetch recent entries (last 14 days for historical averages) - include BOTH finalized and unfinalized
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const fourteenDaysAgoStr = fourteenDaysAgo.toISOString().split('T')[0];

      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("*, sales_log, counter_timestamps")
        .in("user_id", filteredUserIds)
        .gte("entry_date", fourteenDaysAgoStr)
        .order("entry_date", { ascending: false });

      if (error) throw error;

      // Fetch team/MGMT group mapping from the team access cache
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

      const liveReps: LiveRepData[] = [];
      const processedUsers = new Set<string>();

      // Group entries by user
      const entriesByUser = new Map<string, typeof entries>();
      entries?.forEach(entry => {
        if (!entriesByUser.has(entry.user_id)) {
          entriesByUser.set(entry.user_id, []);
        }
        entriesByUser.get(entry.user_id)!.push(entry);
      });

      // Process each user's entries
      entriesByUser.forEach((userEntries, userId) => {
        const repInfo = repsMap.get(userId);
        const teamInfo = repInfoMap.get(userId);
        const seasonConfig = seasonConfigMap.get(userId);
        const timezone = repInfo?.timezone;
        const repToday = getTodayInTimezone(timezone);
        
        // Use teamName from cache, or fallback to "Team [leader name]", or finally "No Team"
        const teamLeaderName = repInfo?.team_leader;
        const teamName = teamInfo?.teamName || 
                        (teamLeaderName ? `Team ${teamLeaderName}` : 'No Team');
        const mgmtGroupName = teamInfo?.mgmtGroupName || '';

        // Calculate historical averages from past finalized entries
        const pastEntries = userEntries.filter(e => 
          e.entry_date !== repToday && 
          e.is_finalized && 
          e.work_start_time && 
          e.work_end_time
        );
        
        let avgPitchesPerHour = 0;
        let avgTransitionsPerHour = 0;
        let avgDoorsPerHour = 0;
        
        if (pastEntries.length > 0) {
          let totalPitches = 0;
          let totalTransitions = 0;
          let totalDoors = 0;
          let totalHours = 0;
          
          for (const entry of pastEntries) {
            const start = new Date(entry.work_start_time);
            const end = new Date(entry.work_end_time);
            const breakMins = calculateBreakMinutes(entry.break_periods);
            const hours = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60) - breakMins / 60);
            
            if (hours > 0.5) { // Only count entries with at least 30 min of work
              totalPitches += entry.pitches || 0;
              totalTransitions += entry.transitions || 0;
              totalDoors += entry.doors_knocked || 0;
              totalHours += hours;
            }
          }
          
          if (totalHours > 0) {
            avgPitchesPerHour = totalPitches / totalHours;
            avgTransitionsPerHour = totalTransitions / totalHours;
            avgDoorsPerHour = totalDoors / totalHours;
          }
        }

        // Find today's entry - prioritize finalized if both exist
        const todayEntries = userEntries.filter(e => e.entry_date === repToday);
        const todayFinalized = todayEntries.find(e => e.is_finalized);
        const todayUnfinalized = todayEntries.find(e => !e.is_finalized);
        const todayEntry = todayFinalized || todayUnfinalized;

        // Find forgotten entries (past unfinalized with activity)
        const forgottenEntry = userEntries.find(e => 
          e.entry_date !== repToday && 
          !e.is_finalized && 
          ((e.doors_knocked ?? 0) > 0 || (e.fp_plus ?? 0) > 0)
        );

        if (todayEntry) {
          const hasActivity = 
            (todayEntry.doors_knocked ?? 0) > 0 ||
            (todayEntry.decision_makers ?? 0) > 0 ||
            (todayEntry.pitches ?? 0) > 0 ||
            (todayEntry.transitions ?? 0) > 0 ||
            (todayEntry.presentations ?? 0) > 0 ||
            (todayEntry.closes ?? 0) > 0 ||
            (todayEntry.fp_plus ?? 0) > 0 ||
            todayEntry.work_start_time !== null;

          if (hasActivity) {
            // Calculate FP+ and PRMR - use sales_log for unfinalized, columns for finalized
            let fpValue: number;
            let prmrValue: number;
            let upgradePrmrValue: number;
            
            if (todayEntry.is_finalized) {
              // For finalized entries, use the saved column values
              fpValue = todayEntry.fp_plus || 0;
              prmrValue = todayEntry.prmr || 0;
              upgradePrmrValue = todayEntry.upgrade_prmr || 0;
            } else {
              // For unfinalized entries, prioritize sales_log if it has entries (supports edits/deletes)
              const salesLog = todayEntry.sales_log as any[];
              const fromLog = calculateFromSalesLog(salesLog);
              // Use sales_log calculation if there are sales, otherwise use column
              fpValue = (salesLog && salesLog.length > 0) ? fromLog.fp : (todayEntry.fp_plus || 0);
              prmrValue = (salesLog && salesLog.length > 0) ? fromLog.prmr : (todayEntry.prmr || 0);
              upgradePrmrValue = (salesLog && salesLog.length > 0) ? fromLog.upgradePrmr : (todayEntry.upgrade_prmr || 0);
            }
            
            processedUsers.add(userId);
            // Get phone from accessibleReps cache (from Notion) OR from reps table
            const cachedPhone = teamInfo?.phone || repInfo?.phone;
            liveReps.push({
              userId,
              name: repInfo?.name || 'Unknown',
              year: repInfo?.year || teamInfo?.year || undefined,
              teamName,
              mgmtGroupName,
              phone: cachedPhone || undefined,
              notionPageId: repInfo?.id || teamInfo?.notionPageId || undefined,
              timezone: timezone || 'America/Los_Angeles',
              isWorking: !todayEntry.is_finalized,
              hasForgottenEntry: !!forgottenEntry,
              forgottenDate: forgottenEntry?.entry_date,
              forgottenEntryId: forgottenEntry?.id,
              personalSummerStart: seasonConfig?.personal_summer_start || null,
              todayStats: {
                doors: todayEntry.doors_knocked || 0,
                dms: todayEntry.decision_makers || 0,
                pitches: todayEntry.pitches || 0,
                transitions: todayEntry.transitions || 0,
                presentations: todayEntry.presentations || 0,
                closes: todayEntry.closes || 0,
                fp: fpValue,
                prmr: prmrValue,
                upgradePrmr: upgradePrmrValue,
                isFinalized: todayEntry.is_finalized || false,
              },
              avgPitchesPerHour,
              avgTransitionsPerHour,
              avgDoorsPerHour,
              workStartTime: todayEntry.work_start_time || undefined,
              workEndTime: todayEntry.work_end_time || undefined,
              breakMinutes: calculateBreakMinutes(todayEntry.break_periods),
              // Timeline data
              entryId: todayEntry.id,
              counterTimestamps: todayEntry.counter_timestamps as Record<string, string[]> || undefined,
              salesLog: todayEntry.sales_log as Array<{ type: string; prmr: number; timestamp?: string }> || undefined,
            });
          }
        } else if (forgottenEntry && !processedUsers.has(userId)) {
          // Only has forgotten entry
          processedUsers.add(userId);
          const cachedPhone = teamInfo?.phone || repInfo?.phone;
          liveReps.push({
            userId,
            name: repInfo?.name || 'Unknown',
            teamName,
            mgmtGroupName,
            phone: cachedPhone || undefined,
            notionPageId: repInfo?.id || teamInfo?.notionPageId || undefined,
            timezone: timezone || 'America/Los_Angeles',
            isWorking: false,
            hasForgottenEntry: true,
            forgottenDate: forgottenEntry.entry_date,
            forgottenEntryId: forgottenEntry.id,
            personalSummerStart: seasonConfig?.personal_summer_start || null,
            todayStats: {
              doors: 0,
              dms: 0,
              pitches: 0,
              transitions: 0,
              presentations: 0,
              closes: 0,
              fp: 0,
              prmr: 0,
              isFinalized: false,
            },
          });
        }
      });

      // Sort: working first, then by funnel priority: FP+ → PRMR → presentations → transitions → pitches → DMs → doors
      liveReps.sort((a, b) => {
        // Working reps first
        if (a.isWorking && !b.isWorking) return -1;
        if (!a.isWorking && b.isWorking) return 1;
        
        // FP+ (highest priority output metric)
        if (a.todayStats.fp !== b.todayStats.fp) return b.todayStats.fp - a.todayStats.fp;
        
        // PRMR
        if (a.todayStats.prmr !== b.todayStats.prmr) return b.todayStats.prmr - a.todayStats.prmr;
        
        // Presentations (bottom of funnel)
        if (a.todayStats.presentations !== b.todayStats.presentations) return b.todayStats.presentations - a.todayStats.presentations;
        
        // Transitions
        if (a.todayStats.transitions !== b.todayStats.transitions) return b.todayStats.transitions - a.todayStats.transitions;
        
        // Pitches
        if (a.todayStats.pitches !== b.todayStats.pitches) return b.todayStats.pitches - a.todayStats.pitches;
        
        // Decision makers
        if (a.todayStats.dms !== b.todayStats.dms) return b.todayStats.dms - a.todayStats.dms;
        
        // Doors (top of funnel - lowest priority)
        return b.todayStats.doors - a.todayStats.doors;
      });

      return {
        liveReps,
        workingCount: liveReps.filter(r => r.isWorking).length,
        // Only count forgotten entries for reps NOT currently working (to match what's displayed)
        forgottenCount: liveReps.filter(r => r.hasForgottenEntry && !r.isWorking).length,
      };
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: userIds.length > 0,
  });
};
