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
  };
  workStartTime?: string;
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

export const useTeamLiveData = ({ userIds, excludeUserIds = [] }: UseTeamLiveDataParams) => {
  return useQuery({
    queryKey: ['team-live-data', userIds, excludeUserIds],
    queryFn: async () => {
      const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
      
      if (filteredUserIds.length === 0) {
        return { liveReps: [], workingCount: 0, forgottenCount: 0 };
      }

      // Fetch reps with their info
      const { data: repsData, error: repsError } = await supabase
        .from("reps")
        .select("user_id, name, timezone")
        .in("user_id", filteredUserIds);

      if (repsError) throw repsError;

      const repsMap = new Map(repsData?.map(r => [r.user_id, r]) || []);

      // Fetch recent unfinalized entries (last 3 days to catch forgotten entries)
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

      const { data: entries, error } = await supabase
        .from("daily_entries")
        .select("*")
        .in("user_id", filteredUserIds)
        .eq("is_finalized", false)
        .gte("entry_date", threeDaysAgoStr);

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

      entries?.forEach(entry => {
        if (processedUsers.has(entry.user_id)) return;
        
        const repInfo = repsMap.get(entry.user_id);
        const teamInfo = repInfoMap.get(entry.user_id);
        const timezone = repInfo?.timezone;
        const repToday = getTodayInTimezone(timezone);
        
        const hasActivity = 
          (entry.doors_knocked ?? 0) > 0 ||
          (entry.decision_makers ?? 0) > 0 ||
          (entry.pitches ?? 0) > 0 ||
          (entry.transitions ?? 0) > 0 ||
          (entry.presentations ?? 0) > 0 ||
          (entry.closes ?? 0) > 0 ||
          entry.work_start_time !== null;

        const isToday = entry.entry_date === repToday;

        if (isToday && hasActivity) {
          processedUsers.add(entry.user_id);
          liveReps.push({
            userId: entry.user_id,
            name: repInfo?.name || 'Unknown',
            teamName: teamInfo?.teamName || 'Unknown Team',
            mgmtGroupName: teamInfo?.mgmtGroupName || 'Unknown Group',
            isWorking: true,
            hasForgottenEntry: false,
            todayStats: {
              doors: entry.doors_knocked || 0,
              dms: entry.decision_makers || 0,
              pitches: entry.pitches || 0,
              transitions: entry.transitions || 0,
              presentations: entry.presentations || 0,
              closes: entry.closes || 0,
              fp: entry.fp_plus || 0,
              prmr: entry.prmr || 0,
            },
            workStartTime: entry.work_start_time || undefined,
          });
        } else if (!isToday && hasActivity && !entry.is_finalized) {
          // Forgot to log a previous day - only add if not already working today
          const existingRep = liveReps.find(r => r.userId === entry.user_id);
          if (!existingRep) {
            liveReps.push({
              userId: entry.user_id,
              name: repInfo?.name || 'Unknown',
              teamName: teamInfo?.teamName || 'Unknown Team',
              mgmtGroupName: teamInfo?.mgmtGroupName || 'Unknown Group',
              isWorking: false,
              hasForgottenEntry: true,
              forgottenDate: entry.entry_date,
              todayStats: {
                doors: 0,
                dms: 0,
                pitches: 0,
                transitions: 0,
                presentations: 0,
                closes: 0,
                fp: 0,
                prmr: 0,
              },
            });
            processedUsers.add(entry.user_id);
          }
        }
      });

      // Sort: working first, then by FP+, then by doors
      liveReps.sort((a, b) => {
        if (a.isWorking && !b.isWorking) return -1;
        if (!a.isWorking && b.isWorking) return 1;
        if (a.todayStats.fp !== b.todayStats.fp) return b.todayStats.fp - a.todayStats.fp;
        return b.todayStats.doors - a.todayStats.doors;
      });

      return {
        liveReps,
        workingCount: liveReps.filter(r => r.isWorking).length,
        forgottenCount: liveReps.filter(r => r.hasForgottenEntry).length,
      };
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
    enabled: userIds.length > 0,
  });
};
