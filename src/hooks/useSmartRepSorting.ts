import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Rep {
  id: string;
  userId: string | null;
  name: string;
  phone?: string | null;
  year?: string | null;
  stage?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  mgmtGroupId?: string | null;
  mgmtGroupName?: string | null;
}

// Normalize stage for filtering - maps display stages to canonical forms
const normalizeStage = (stage: string | null | undefined): string | null => {
  if (!stage) return null;
  const lower = stage.toLowerCase().trim();
  
  // Map various stage formats to canonical forms
  if (lower.includes('signed')) return 'signed';
  if (lower.includes('shadow') && lower.includes('✅')) return 'shadow_complete';
  if (lower.includes('shadow')) return 'shadow_complete';
  if (lower.includes('sold') && (lower.includes('5+') || lower.includes('💰'))) return 'sold_5_plus';
  if (lower.includes('sold')) return 'sold';
  if (lower.includes('evaluating')) return 'evaluating';
  if (lower.includes('reached')) return 'reached_out';
  if (lower.includes('100')) return '100_list';
  
  return lower;
};

// Active stages that should appear in the list
const ACTIVE_STAGES = ['signed', 'shadow_complete', 'sold', 'sold_5_plus'];

export interface SortedReps {
  workingReps: Rep[];
  notWorkingReps: Rep[];
  allSortedReps: Rep[]; // Combined list with working first
}

export const useSmartRepSorting = (
  allReps: Rep[],
  dateRange?: { start: Date; end: Date },
  currentUserId?: string | null,
  excludeCurrentUser: boolean = true
) => {
  // Fetch planned work days within date range
  const { data: plannedWorkDays, isLoading: loadingPlannedDays } = useQuery({
    queryKey: ['planned-work-days-for-sorting', dateRange?.start?.toISOString(), dateRange?.end?.toISOString()],
    queryFn: async () => {
      if (!dateRange) return {};
      
      const startStr = dateRange.start.toISOString().split('T')[0];
      const endStr = dateRange.end.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .gte('planned_date', startStr)
        .lte('planned_date', endStr);
      
      if (error) {
        console.error('Error fetching planned work days:', error);
        return {};
      }
      
      // Group by user_id - just need to know if they have ANY planned day in range
      const userPlannedDays: Record<string, boolean> = {};
      data?.forEach(row => {
        if (row.user_id) {
          userPlannedDays[row.user_id] = true;
        }
      });
      
      return userPlannedDays;
    },
    enabled: !!dateRange,
    staleTime: 60 * 1000, // 1 minute
  });

  // Filter and sort reps
  const sortedReps = useMemo((): SortedReps => {
    // First, filter to only active stages and those with userId
    const eligibleReps = allReps.filter(rep => {
      if (!rep.userId) return false;
      
      // Optionally exclude current user
      if (excludeCurrentUser && currentUserId && rep.userId === currentUserId) {
        return false;
      }
      
      const normalizedStage = normalizeStage(rep.stage);
      return normalizedStage && ACTIVE_STAGES.includes(normalizedStage);
    });

    // Sort function: by team name, then by name alphabetically
    const sortReps = (reps: Rep[]) => {
      return [...reps].sort((a, b) => {
        // First by team name
        const teamA = a.teamName || '';
        const teamB = b.teamName || '';
        if (teamA !== teamB) return teamA.localeCompare(teamB);
        
        // Then alphabetically by name
        return a.name.localeCompare(b.name);
      });
    };

    // If no date range, just return sorted reps
    if (!dateRange || !plannedWorkDays) {
      const sorted = sortReps(eligibleReps);
      return {
        workingReps: sorted,
        notWorkingReps: [],
        allSortedReps: sorted,
      };
    }

    // Split into working/not working based on planned days
    const working: Rep[] = [];
    const notWorking: Rep[] = [];
    
    eligibleReps.forEach(rep => {
      if (!rep.userId) return;
      
      // Check if they have planned work days in range
      const hasPlannedDays = plannedWorkDays[rep.userId] ?? false;
      
      if (hasPlannedDays) {
        working.push(rep);
      } else {
        notWorking.push(rep);
      }
    });

    const sortedWorking = sortReps(working);
    const sortedNotWorking = sortReps(notWorking);

    return {
      workingReps: sortedWorking,
      notWorkingReps: sortedNotWorking,
      allSortedReps: [...sortedWorking, ...sortedNotWorking],
    };
  }, [allReps, plannedWorkDays, currentUserId, excludeCurrentUser, dateRange]);

  return {
    ...sortedReps,
    isLoading: loadingPlannedDays,
  };
};
