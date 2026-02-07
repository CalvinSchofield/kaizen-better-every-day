import { useMemo } from "react";
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
  isMyRecruit?: boolean; // Direct recruit of the current user
  isInMyTeam?: boolean; // Part of user's formal team or recruit tree
  isInMyMgmt?: boolean; // Part of user's management group
  isWorking?: boolean; // Has planned day or activity in date range
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
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'recruiter' | 'none';
  
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
  const { myRecruitIds, myTeamIds, myMgmtIds, allOfficeIds } = useMemo(() => {
    const myRecruitIds = new Set<string>();
    const myTeamIds = new Set<string>();
    const myMgmtIds = new Set<string>();
    const allOfficeIds = new Set<string>();
    
    // All office from useAllOfficeReps
    allOfficeReps?.forEach(rep => {
      if (rep.userId) allOfficeIds.add(rep.userId);
    });
    
    // From team access data
    if (teamAccess) {
      const accessLevel = teamAccess.accessLevel;
      
      // Accessible reps are the user's downline (formal + organic)
      teamAccess.accessibleReps.forEach(rep => {
        if (!rep.userId) return;
        
        // My Recruits = direct recruits (first level only)
        // We need to detect this - accessibleReps includes the full tree
        // For now, we'll use mgmtGroup matching for team identification
        
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
      
      // My Recruits = immediate accessible reps (all for recruiters)
      // For simplicity, we consider all accessible reps as "my recruits" territory
      teamAccess.accessibleReps.forEach(rep => {
        if (rep.userId) myRecruitIds.add(rep.userId);
      });
    }
    
    return { myRecruitIds, myTeamIds, myMgmtIds, allOfficeIds };
  }, [teamAccess, allOfficeReps]);
  
  // Build enriched rep list from all office reps
  const allReps = useMemo((): ParticipantRep[] => {
    if (!allOfficeReps) return [];
    
    return allOfficeReps
      .filter(rep => {
        if (!rep.userId) return false;
        // Optionally exclude current user
        if (!includeCurrentUser && rep.userId === currentUserId) return false;
        return true;
      })
      .map(rep => ({
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
        isMyRecruit: myRecruitIds.has(rep.userId),
        isInMyTeam: myTeamIds.has(rep.userId),
        isInMyMgmt: myMgmtIds.has(rep.userId),
        isWorking: workingUserIds.has(rep.userId),
      }));
  }, [allOfficeReps, myRecruitIds, myTeamIds, myMgmtIds, workingUserIds, includeCurrentUser, currentUserId]);
  
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
  
  const isLoading = isLoadingTeamAccess || isLoadingAllOffice || isLoadingPlanned || isLoadingEntries;
  
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
    // Scope filter
    if (scope === 'my_recruits' && !rep.isMyRecruit) return false;
    if (scope === 'my_team' && !rep.isInMyTeam) return false;
    if (scope === 'my_mgmt' && !rep.isInMyMgmt) return false;
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
    let groupKey = rep.teamName || 'Other';
    
    // Special grouping for "My Recruits" at top
    if (rep.isMyRecruit && scope !== 'my_recruits') {
      groupKey = '🌟 My Recruits';
    } else if (rep.isWorking) {
      groupKey = `📅 ${groupKey}`;
    }
    
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, []);
    }
    grouped.get(groupKey)!.push(rep);
  });
  
  return { grouped, total: filtered.length };
};
