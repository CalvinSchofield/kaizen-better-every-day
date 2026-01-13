import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Normalize stage for filtering - maps display stages to canonical forms
const normalizeStage = (stage: string | null | undefined): string | null => {
  if (!stage) return null;
  const lower = stage.toLowerCase().trim();
  
  // Map various stage formats to canonical forms
  if (lower.includes('signed')) return 'signed';
  if (lower.includes('shadow')) return 'shadow_complete'; // Matches "Shadow ✅", "Shadow Complete ✅", etc.
  if (lower.includes('sold') && (lower.includes('5+') || lower.includes('5)') || lower.includes('💰'))) return 'sold_5_plus';
  if (lower.includes('sold')) return 'sold';
  if (lower.includes('evaluating')) return 'evaluating';
  if (lower.includes('reached')) return 'reached_out';
  if (lower.includes('100')) return '100_list';
  
  return lower;
};

// Active stages that can participate in competitions
const ACTIVE_STAGES = ['signed', 'shadow_complete', 'sold', 'sold_5_plus'];

interface OfficeRep {
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
}

/**
 * Fetches all office reps that can participate in competitions.
 * Unlike useTeamAccess which scopes to downline, this returns everyone
 * so any rep can challenge anyone else in the office.
 */
export const useAllOfficeReps = () => {
  return useQuery({
    queryKey: ['all-office-reps'],
    queryFn: async () => {
      // Fetch all reps with their team info
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('id, user_id, name, phone, year, stage')
        .not('user_id', 'is', null);

      if (repsError) throw repsError;

      // Debug logging for rep filtering
      console.log('[useAllOfficeReps] Total reps fetched:', reps?.length || 0);
      
      // Log stages for debugging
      const stageCounts: Record<string, number> = {};
      reps?.forEach(rep => {
        const stage = rep.stage || 'null';
        stageCounts[stage] = (stageCounts[stage] || 0) + 1;
      });
      console.log('[useAllOfficeReps] Stage distribution:', stageCounts);

      // Fetch teams for names
      const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('id, name, lead_user_id');

      if (teamsError) throw teamsError;

      // Fetch team_mgmt_groups for mapping
      const { data: teamMgmtGroups, error: tmgError } = await supabase
        .from('team_mgmt_groups')
        .select('team_id, mgmt_group_id');

      if (tmgError) throw tmgError;

      // Fetch mgmt_groups for names
      const { data: mgmtGroups, error: mgError } = await supabase
        .from('mgmt_groups')
        .select('id, name, lead_user_id');

      if (mgError) throw mgError;

      // Build team lead -> team map
      const teamByLeadUserId = new Map(
        teams?.map(t => [t.lead_user_id, { id: t.id, name: t.name }]) || []
      );

      // Build team -> mgmt group map
      const teamToMgmt = new Map(
        teamMgmtGroups?.map(tmg => [tmg.team_id, tmg.mgmt_group_id]) || []
      );

      // Build mgmt group map by id
      const mgmtById = new Map(
        mgmtGroups?.map(mg => [mg.id, { id: mg.id, name: mg.name }]) || []
      );

      // Build rep -> team mapping by tracing through team_leader
      const repByUserId = new Map(reps?.map(r => [r.user_id, r]) || []);
      
      // For each rep, try to find their team
      const findTeamForRep = (userId: string, visited = new Set<string>()): { teamId: string; teamName: string } | null => {
        if (visited.has(userId)) return null;
        visited.add(userId);
        
        // Check if this user is a team lead
        const team = teamByLeadUserId.get(userId);
        if (team) {
          return { teamId: team.id, teamName: team.name };
        }
        
        // Otherwise, look at their team_leader field - but we don't have it here
        // We'll rely on RLS/team_access for proper team assignment
        return null;
      };

      // Filter to active stages using proper normalization and map to standard format
      const filteredOutReps: Array<{ name: string; stage: string | null; normalized: string | null }> = [];
      
      const officeReps: OfficeRep[] = (reps || [])
        .filter(rep => {
          if (!rep.user_id) return false;
          const normalizedStage = normalizeStage(rep.stage);
          const isActive = normalizedStage && ACTIVE_STAGES.includes(normalizedStage);
          
          // Track filtered out reps for debugging
          if (!isActive) {
            filteredOutReps.push({ name: rep.name, stage: rep.stage, normalized: normalizedStage });
          }
          
          return isActive;
        })
        .map(rep => {
          // Try to determine team from lead status
          const teamInfo = findTeamForRep(rep.user_id!);
          
          // Determine mgmt group
          let mgmtGroupInfo: { id: string; name: string } | null = null;
          if (teamInfo) {
            const mgmtGroupId = teamToMgmt.get(teamInfo.teamId);
            if (mgmtGroupId) {
              mgmtGroupInfo = mgmtById.get(mgmtGroupId) || null;
            }
          }

          return {
            id: rep.id,
            userId: rep.user_id!,
            name: rep.name,
            phone: rep.phone,
            year: rep.year,
            stage: rep.stage,
            teamId: teamInfo?.teamId || null,
            teamName: teamInfo?.teamName || null,
            mgmtGroupId: mgmtGroupInfo?.id || null,
            mgmtGroupName: mgmtGroupInfo?.name || null,
          };
        });

      // Log debugging info
      console.log('[useAllOfficeReps] Active reps after filtering:', officeReps.length);
      if (filteredOutReps.length > 0) {
        console.log('[useAllOfficeReps] Filtered out reps:', filteredOutReps);
      }

      return officeReps;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

