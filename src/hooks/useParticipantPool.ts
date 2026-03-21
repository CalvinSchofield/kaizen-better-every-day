import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeamAccess } from "./useTeamAccess";
import { useAllOfficeReps } from "./useAllOfficeReps";
import { format } from "date-fns";

export interface ParticipantRep {
  id: string;
  userId: string;
  name: string;
  phone?: string | null;
  year?: string | null;
  stage?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
  isMyRecruit?: boolean; // In the user's downline (direct + indirect recruits)
  isDirectRecruit?: boolean; // Direct recruit of the current user
  isInMyTeam?: boolean; // Part of user's formal team or recruit tree
  isInMyMgmt?: boolean; // Part of user's management group
  isWorking?: boolean; // Has planned day or activity in date range
  isSelf?: boolean; // Is the current user
}

export type ScopeFilter = 'my_recruits' | 'my_team' | 'my_mgmt' | 'all_office';
export type YearFilter = 'rookie' | 'sophomore' | 'vet';

// Normalize year for filtering
const normalizeYear = (year: string | null | undefined): YearFilter | null => {
  if (!year) return null;
  const lower = year.toLowerCase().trim();
  
  if (lower.includes('rookie') || lower === 'r' || lower === '1st' || lower === 'first') return 'rookie';
  if (lower.includes('sophomore') || lower.includes('soph') || lower === 's' || lower === '2nd' || lower === 'second') return 'sophomore';
  if (lower.includes('vet') || lower === 'v' || lower === '3rd' || lower === 'third' || lower.includes('senior')) return 'vet';
  
  return null;
};

// Get year display label
export const getYearLabel = (year: string | null | undefined): string => {
  const normalized = normalizeYear(year);
  if (normalized === 'rookie') return 'R';
  if (normalized === 'sophomore') return 'S';
  if (normalized === 'vet') return 'V';
  return '';
};

// Get year full name
export const getYearFullName = (year: string | null | undefined): string => {
  const normalized = normalizeYear(year);
  if (normalized === 'rookie') return 'Rookie';
  if (normalized === 'sophomore') return 'Sophomore';
  if (normalized === 'vet') return 'Vet';
  return year || '';
};

interface UseParticipantPoolOptions {
  dateRange?: { start: Date; end: Date };
  includeCurrentUser?: boolean;
}

interface UseParticipantPoolResult {
  // All reps with enrichment
  allReps: ParticipantRep[];
  
  // Filtered by scope
  myRecruits: ParticipantRep[];
  myTeam: ParticipantRep[];
  myMgmt: ParticipantRep[];
  allOffice: ParticipantRep[];
  
  // Working status
  workingUserIds: Set<string>;
  
  // Access level determines which scopes are available
  accessLevel: import("@/utils/roleHierarchy").AccessLevel;
  
  // Available scope options based on access level
  availableScopes: ScopeFilter[];
  
  // Loading states
  isLoading: boolean;
  
  // Current user ID
  currentUserId: string | null;
}

export const useParticipantPool = (options: UseParticipantPoolOptions = {}): UseParticipantPoolResult => {
  const { dateRange, includeCurrentUser = true } = options;
  
  // Get current user ID
  const { data: currentUserData } = useQuery({
    queryKey: ['current-user-id-for-pool'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.id ?? null;
    },
    staleTime: Infinity,
  });
  
  const currentUserId = currentUserData ?? null;
  
  // Get team access data (includes downline, recruiter tree, and access level)
  const { data: teamAccess, isLoading: isLoadingTeamAccess } = useTeamAccess();
  
  // Get all office reps for "All Office" scope
  const { data: allOfficeReps, isLoading: isLoadingAllOffice } = useAllOfficeReps();
  
  // Fetch planned work days within date range
  const { data: plannedWorkDays, isLoading: isLoadingPlanned } = useQuery({
    queryKey: ['participant-pool-planned-days', dateRange ? format(dateRange.start, 'yyyy-MM-dd') : null, dateRange ? format(dateRange.end, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!dateRange) return new Set<string>();
      
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('planned_work_days')
        .select('user_id')
        .gte('planned_date', startStr)
        .lte('planned_date', endStr);
      
      if (error) {
        console.error('Error fetching planned work days:', error);
        return new Set<string>();
      }
      
      return new Set(data?.map(row => row.user_id).filter(Boolean) || []);
    },
    enabled: !!dateRange,
    staleTime: 60 * 1000,
  });
  
  // Fetch active daily entries within date range
  const { data: activeEntries, isLoading: isLoadingEntries } = useQuery({
    queryKey: ['participant-pool-active-entries', dateRange ? format(dateRange.start, 'yyyy-MM-dd') : null, dateRange ? format(dateRange.end, 'yyyy-MM-dd') : null],
    queryFn: async () => {
      if (!dateRange) return new Set<string>();
      
      const startStr = format(dateRange.start, 'yyyy-MM-dd');
      const endStr = format(dateRange.end, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, doors_knocked, pitches, decision_makers, transitions, presentations, closes, work_start_time')
        .gte('entry_date', startStr)
        .lte('entry_date', endStr);
      
      if (error) {
        console.error('Error fetching active entries:', error);
        return new Set<string>();
      }
      
      const activeUserIds = new Set<string>();
      data?.forEach(row => {
        if (row.user_id) {
          const hasActivity = 
            (row.doors_knocked && row.doors_knocked > 0) ||
            (row.pitches && row.pitches > 0) ||
            (row.decision_makers && row.decision_makers > 0) ||
            (row.transitions && row.transitions > 0) ||
            (row.presentations && row.presentations > 0) ||
            (row.closes && row.closes > 0) ||
            row.work_start_time;
          
          if (hasActivity) {
            activeUserIds.add(row.user_id);
          }
        }
      });
      
      return activeUserIds;
    },
    enabled: !!dateRange,
    staleTime: 30 * 1000,
  });
  
  // Compute working user IDs
  const workingUserIds = useMemo(() => {
    const working = new Set<string>();
    if (plannedWorkDays instanceof Set) {
      plannedWorkDays.forEach(id => working.add(id));
    }
    if (activeEntries instanceof Set) {
      activeEntries.forEach(id => working.add(id));
    }
    return working;
  }, [plannedWorkDays, activeEntries]);
  
  // Build user ID sets for filtering
  const { myRecruitIds, directRecruitIds, myTeamIds, myMgmtIds, allOfficeIds } = useMemo(() => {
    const myRecruitIds = new Set<string>(); // Full downline
    const directRecruitIds = new Set<string>(); // Direct recruits only
    const myTeamIds = new Set<string>();
    const myMgmtIds = new Set<string>();
    const allOfficeIds = new Set<string>();
    
    // All office from useAllOfficeReps
    allOfficeReps?.forEach(rep => {
      if (rep.userId) allOfficeIds.add(rep.userId);
    });
    
    // From team access data - this now includes the current user
    if (teamAccess) {
      const accessLevel = teamAccess.accessLevel;
      
      // My Recruits = FULL DOWNLINE (everyone in accessibleReps except self)
      // This includes direct recruits and their recruits recursively
      teamAccess.accessibleReps.forEach(rep => {
        if (!rep.userId) return;
        
        // Mark as "my recruit" if they're in the downline (not self)
        if (rep.userId !== currentUserId) {
          myRecruitIds.add(rep.userId);
        }
        
        // Track direct recruits separately using the new isDirectRecruit flag
        if ((rep as any).isDirectRecruit) {
          directRecruitIds.add(rep.userId);
        }
        
        // My Team logic:
        // - For Team Leads: formal team members
        // - For others: their recruit tree (people they recruited + their recruits)
        if (accessLevel === 'team_lead' || accessLevel === 'mgmt_group_lead' || accessLevel === 'area_director') {
          // Leaders have formal team structure available
          const leaderTeamIds = new Set(teamAccess.teams.map(t => t.id));
          if (rep.teamId && leaderTeamIds.has(rep.teamId)) {
            myTeamIds.add(rep.userId);
          }
        }
        
        // For MGMT level access
        if (accessLevel === 'mgmt_group_lead' || accessLevel === 'area_director') {
          const leaderMgmtIds = new Set(teamAccess.mgmtGroups.map(g => g.id));
          if (rep.mgmtGroupId && leaderMgmtIds.has(rep.mgmtGroupId)) {
            myMgmtIds.add(rep.userId);
          }
        }
        
        // For Area Directors - everyone in accessibleReps is in their scope
        if (accessLevel === 'area_director') {
          myMgmtIds.add(rep.userId);
        }
      });
      
      // All accessible user IDs are part of "My Team" for recruiters
      // This is the organic downline (people you recruited + their recruits)
      if (accessLevel === 'recruiter') {
        teamAccess.accessibleReps.forEach(rep => {
          if (rep.userId) myTeamIds.add(rep.userId);
        });
      }
    }
    
    return { myRecruitIds, directRecruitIds, myTeamIds, myMgmtIds, allOfficeIds };
  }, [teamAccess, allOfficeReps, currentUserId]);
  
  // Build enriched rep list from all office reps + downline reps from teamAccess
  // This ensures the user's full downline is always visible even if some reps
  // don't pass the active-stage filter in useAllOfficeReps
  const allReps = useMemo((): ParticipantRep[] => {
    const seenUserIds = new Set<string>();
    const result: ParticipantRep[] = [];
    
    const addRep = (rep: { id: string; userId: string; name: string; phone?: string | null; year?: string | null; stage?: string | null; teamId?: string | null; teamName?: string | null; mgmtGroupId?: string | null; mgmtGroupName?: string | null }) => {
      if (!rep.userId) return;
      if (seenUserIds.has(rep.userId)) return;
      if (!includeCurrentUser && rep.userId === currentUserId) return;
      
      seenUserIds.add(rep.userId);
      result.push({
        id: rep.id,
        userId: rep.userId,
        name: rep.name,
        phone: rep.phone,
        year: rep.year,
        stage: rep.stage,
        teamId: rep.teamId ?? null,
        teamName: rep.teamName ?? null,
        mgmtGroupId: rep.mgmtGroupId ?? null,
        mgmtGroupName: rep.mgmtGroupName ?? null,
        isMyRecruit: myRecruitIds.has(rep.userId),
        isDirectRecruit: directRecruitIds.has(rep.userId),
        isInMyTeam: myTeamIds.has(rep.userId),
        isInMyMgmt: myMgmtIds.has(rep.userId),
        isWorking: workingUserIds.has(rep.userId),
        isSelf: rep.userId === currentUserId,
      });
    };
    
    // 1. Add all office reps (active-stage filtered, broadest pool)
    allOfficeReps?.forEach(rep => addRep(rep));
    
    // 2. Add downline reps from teamAccess that weren't in allOfficeReps
    // This catches reps in non-active stages that are still in the user's downline
    teamAccess?.accessibleReps?.forEach(rep => {
      if (rep.userId) {
        addRep({
          id: rep.id,
          userId: rep.userId,
          name: rep.name,
          phone: rep.phone,
          year: rep.year,
          stage: rep.stage,
          teamId: rep.teamId,
          teamName: rep.teamName,
          mgmtGroupId: rep.mgmtGroupId,
          mgmtGroupName: rep.mgmtGroupName,
        });
      }
    });
    
    return result;
  }, [allOfficeReps, teamAccess, myRecruitIds, directRecruitIds, myTeamIds, myMgmtIds, workingUserIds, includeCurrentUser, currentUserId]);
  
  // Filter by scope
  const myRecruits = useMemo(() => allReps.filter(r => r.isMyRecruit), [allReps]);
  const myTeam = useMemo(() => allReps.filter(r => r.isInMyTeam), [allReps]);
  const myMgmt = useMemo(() => allReps.filter(r => r.isInMyMgmt), [allReps]);
  const allOffice = allReps;
  
  // Determine available scopes based on access level
  const accessLevel = teamAccess?.accessLevel ?? 'none';
  
  const availableScopes = useMemo((): ScopeFilter[] => {
    switch (accessLevel) {
      case 'area_director':
        return ['my_recruits', 'my_team', 'my_mgmt', 'all_office'];
      case 'mgmt_group_lead':
        return ['my_recruits', 'my_team', 'my_mgmt', 'all_office'];
      case 'team_lead':
        return ['my_recruits', 'my_team', 'all_office'];
      case 'recruiter':
        return ['my_recruits', 'all_office'];
      default:
        return ['all_office'];
    }
  }, [accessLevel]);
  
  // Only block on the essential data — working-status is decorative and can load async
  // Add a safety timeout: after 6 seconds, stop showing the loading spinner regardless
  const [loadingTimedOut, setLoadingTimedOut] = useState(false);
  
  useEffect(() => {
    if (!isLoadingTeamAccess && !isLoadingAllOffice) {
      setLoadingTimedOut(false);
      return;
    }
    
    const timer = setTimeout(() => {
      console.warn('[useParticipantPool] Loading safety timeout reached');
      setLoadingTimedOut(true);
    }, 6000);
    
    return () => clearTimeout(timer);
  }, [isLoadingTeamAccess, isLoadingAllOffice]);
  
  const isLoading = (isLoadingTeamAccess || isLoadingAllOffice) && !loadingTimedOut;
  
  return {
    allReps,
    myRecruits,
    myTeam,
    myMgmt,
    allOffice,
    workingUserIds,
    accessLevel,
    availableScopes,
    isLoading,
    currentUserId,
  };
};

// Helper to filter and sort reps
export const filterAndSortReps = (
  reps: ParticipantRep[],
  {
    scope,
    yearFilters,
    workingOnly,
    searchQuery,
    currentUserId,
  }: {
    scope: ScopeFilter;
    yearFilters: Set<YearFilter>;
    workingOnly: boolean;
    searchQuery: string;
    currentUserId: string | null;
  }
): { grouped: Map<string, ParticipantRep[]>; total: number } => {
  // Apply filters
  let filtered = reps.filter(rep => {
    // Scope filter — always include self regardless of scope
    if (rep.isSelf) { /* always pass scope filter */ }
    else if (scope === 'my_recruits' && !rep.isMyRecruit) return false;
    else if (scope === 'my_team' && !rep.isInMyTeam) return false;
    else if (scope === 'my_mgmt' && !rep.isInMyMgmt) return false;
    // all_office shows everyone
    
    // Year filter (if any are selected)
    if (yearFilters.size > 0) {
      const repYear = normalizeYear(rep.year);
      if (!repYear || !yearFilters.has(repYear)) return false;
    }
    
    // Working only filter
    if (workingOnly && !rep.isWorking) return false;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matches = 
        rep.name.toLowerCase().includes(query) ||
        rep.teamName?.toLowerCase().includes(query) ||
        rep.mgmtGroupName?.toLowerCase().includes(query);
      if (!matches) return false;
    }
    
    return true;
  });
  
  // Sort: My Recruits first, then working, then by team, then by name
  filtered.sort((a, b) => {
    // Current user first
    if (a.userId === currentUserId) return -1;
    if (b.userId === currentUserId) return 1;
    
    // My recruits first
    if (a.isMyRecruit && !b.isMyRecruit) return -1;
    if (!a.isMyRecruit && b.isMyRecruit) return 1;
    
    // Working first
    if (a.isWorking && !b.isWorking) return -1;
    if (!a.isWorking && b.isWorking) return 1;
    
    // Then by team name
    const teamA = a.teamName || 'zzz';
    const teamB = b.teamName || 'zzz';
    if (teamA !== teamB) return teamA.localeCompare(teamB);
    
    // Finally by name
    return a.name.localeCompare(b.name);
  });
  
  // Group by category
  const grouped = new Map<string, ParticipantRep[]>();
  
  filtered.forEach(rep => {
    let groupKey: string;
    
    // Current user gets their own group at top
    if (rep.isSelf) {
      groupKey = '📅 ' + (rep.teamName || rep.name);
    } else if (rep.isMyRecruit && scope !== 'my_recruits') {
      // Show "My Recruits" group when not already in that scope
      groupKey = '🌟 My Recruits';
    } else {
      groupKey = rep.teamName || 'Other';
    }
    
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey)!.push(rep);
  });
  
  return { grouped, total: filtered.length };
};
