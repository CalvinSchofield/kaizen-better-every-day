import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LiveRepData {
  userId: string;
  name: string;
  teamName: string;
  mgmtGroupName: string;
  isWorking: boolean;
  hasForgottenEntry: boolean;
  forgottenDate?: string;
  todayStats: {
    doors: number;
    dms: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp: number;
    prmr: number;
    isFinalized?: boolean;
  };
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes?: number;
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

export const useTeamLiveData = ({ userIds, excludeUserIds = [] }: UseTeamLiveDataParams) => {
  return useQuery({
    queryKey: ['team-live-data', userIds, excludeUserIds],
    queryFn: async () => {
      const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
      
      if (filteredUserIds.length === 0) {
        return { liveReps: [], workingCount: 0, forgottenCount: 0 };
      }

      // Fetch reps with their info including team_leader
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, timezone, team_leader")
        .in("user_id", filteredUserIds);

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, r]) || []);

      // Fetch recent entries (last 3 days) - include BOTH finalized and unfinalized
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("*")
        .in("user_id", filteredUserIds)
        .gte("entry_date", threeDaysAgoStr)
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
        const timezone = repInfo?.timezone;
        const repToday = getTodayInTimezone(timezone);
        
        // Use teamName from cache, or fallback to "Team [leader name]"
        const teamName = teamInfo?.teamName || (repInfo?.team_leader ? `Team ${repInfo.team_leader}` : 'Unknown Team');
        const mgmtGroupName = teamInfo?.mgmtGroupName || 'Unknown Group';

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
            processedUsers.add(userId);
            liveReps.push({
              userId,
              name: repInfo?.name || 'Unknown',
              teamName,
              mgmtGroupName,
              isWorking: !todayEntry.is_finalized,
              hasForgottenEntry: !!forgottenEntry,
              forgottenDate: forgottenEntry?.entry_date,
              todayStats: {
                doors: todayEntry.doors_knocked || 0,
                dms: todayEntry.decision_makers || 0,
                pitches: todayEntry.pitches || 0,
                transitions: todayEntry.transitions || 0,
                presentations: todayEntry.presentations || 0,
                closes: todayEntry.closes || 0,
                fp: todayEntry.fp_plus || 0,
                prmr: todayEntry.prmr || 0,
                isFinalized: todayEntry.is_finalized || false,
              },
              workStartTime: todayEntry.work_start_time || undefined,
              workEndTime: todayEntry.work_end_time || undefined,
              breakMinutes: calculateBreakMinutes(todayEntry.break_periods),
            });
          }
        } else if (forgottenEntry && !processedUsers.has(userId)) {
          // Only has forgotten entry
          processedUsers.add(userId);
          liveReps.push({
            userId,
            name: repInfo?.name || 'Unknown',
            teamName,
            mgmtGroupName,
            isWorking: false,
            hasForgottenEntry: true,
            forgottenDate: forgottenEntry.entry_date,
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
