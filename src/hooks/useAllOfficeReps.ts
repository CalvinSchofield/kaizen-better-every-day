import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRepActive } from "@/utils/repStatusUtils";

// Normalize stage for filtering - maps display stages to canonical forms
const normalizeStage = (stage: string | null | undefined): string | null => {
  if (!stage) return null;
  const lower = stage.toLowerCase().trim();

  // Exit / terminal stages must be checked FIRST so that
  // "Signed but Not Interested" is not mistakenly matched by the
  // `includes('signed')` rule below.
  if (lower.includes('not interested')) return 'not_interested';
  if (lower.includes('follow up')) return 'follow_up';

  if (lower.includes('signed')) return 'signed';
  if (lower.includes('shadow')) return 'shadow_complete';
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

const CACHE_KEY = 'all-office-reps-cache';

/** Load cached data for instant hydration */
const getCachedData = (): OfficeRep[] | undefined => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      // Use cache if less than 10 minutes old
      if (Date.now() - timestamp < 10 * 60 * 1000) {
        return data as OfficeRep[];
      }
    }
  } catch { /* ignore */ }
  return undefined;
};

/**
 * Fetches all office reps that can participate in competitions.
 * Unlike useTeamAccess which scopes to downline, this returns everyone
 * so any rep can challenge anyone else in the office.
 */
export const useAllOfficeReps = () => {
  return useQuery({
    queryKey: ['all-office-reps'],
    queryFn: async () => {
      // Race against a timeout to prevent infinite loading on slow networks
      const TIMEOUT_MS = 10000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('all-office-reps timeout')), TIMEOUT_MS);
      });

      const fetchPromise = (async () => {
        // Fetch all data in parallel including recruits for team assignment
        const [repsResult, teamsResult, teamMgmtResult, mgmtResult, recruitsResult] = await Promise.all([
          supabase
            .from('reps')
            .select('id, user_id, name, phone, year, stage')
            .not('user_id', 'is', null)
            .limit(5000),
          supabase
            .from('teams')
            .select('id, name, lead_user_id')
            .limit(500),
          supabase
            .from('team_mgmt_groups')
            .select('team_id, mgmt_group_id')
            .limit(500),
          supabase
            .from('mgmt_groups')
            .select('id, name, lead_user_id')
            .limit(500),
          supabase
            .from('recruits')
            .select('id, team_id, mgmt_group_id')
            .limit(5000),
        ]);

        if (repsResult.error) throw repsResult.error;
        if (teamsResult.error) throw teamsResult.error;
        if (teamMgmtResult.error) throw teamMgmtResult.error;
        if (mgmtResult.error) throw mgmtResult.error;
        if (recruitsResult.error) throw recruitsResult.error;

        const reps = repsResult.data || [];
        const teams = teamsResult.data || [];
        const teamMgmtGroups = teamMgmtResult.data || [];
        const mgmtGroups = mgmtResult.data || [];
        const recruits = recruitsResult.data || [];

        // Build team lead -> team map
        const teamByLeadUserId = new Map(
          teams.map(t => [t.lead_user_id, { id: t.id, name: t.name }])
        );

        // Build team by id map
        const teamById = new Map(
          teams.map(t => [t.id, { id: t.id, name: t.name }])
        );

        // Build recruit.id -> recruit map for formal team assignment
        const recruitById = new Map(
          recruits.map(r => [r.id, r])
        );

        // Build team -> mgmt group map
        const teamToMgmt = new Map(
          teamMgmtGroups.map(tmg => [tmg.team_id, tmg.mgmt_group_id])
        );

        // Build mgmt group map by id
        const mgmtById = new Map(
          mgmtGroups.map(mg => [mg.id, { id: mg.id, name: mg.name }])
        );

        // For each rep, find their team: first check if team lead, then check recruit record
        const findTeamForRep = (repId: string, userId: string): { teamId: string; teamName: string } | null => {
          // 1. Team lead?
          const leadTeam = teamByLeadUserId.get(userId);
          if (leadTeam) return { teamId: leadTeam.id, teamName: leadTeam.name };

          // 2. Formal recruit record (rep.id = recruit.id)
          const recruit = recruitById.get(repId);
          if (recruit?.team_id) {
            const team = teamById.get(recruit.team_id);
            if (team) return { teamId: team.id, teamName: team.name };
          }

          return null;
        };

        // Find mgmt group for rep
        const findMgmtForRep = (repId: string, teamId: string | null): { id: string; name: string } | null => {
          // Check recruit record for direct mgmt_group_id
          const recruit = recruitById.get(repId);
          if (recruit?.mgmt_group_id) {
            return mgmtById.get(recruit.mgmt_group_id) || null;
          }
          // Fall back to team -> mgmt group mapping
          if (teamId) {
            const mgmtGroupId = teamToMgmt.get(teamId);
            if (mgmtGroupId) return mgmtById.get(mgmtGroupId) || null;
          }
          return null;
        };

        // Filter to active stages and map to standard format
        const officeReps: OfficeRep[] = reps
          .filter(rep => {
            if (!rep.user_id) return false;
            const normalizedStage = normalizeStage(rep.stage);
            return normalizedStage && ACTIVE_STAGES.includes(normalizedStage);
          })
          .map(rep => {
            const teamInfo = findTeamForRep(rep.id, rep.user_id!);
            const mgmtGroupInfo = findMgmtForRep(rep.id, teamInfo?.teamId || null);

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

        // Cache the result
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data: officeReps,
            timestamp: Date.now(),
          }));
        } catch { /* storage full, ignore */ }

        return officeReps;
      })();

      try {
        return await Promise.race([fetchPromise, timeoutPromise]);
      } catch (error: any) {
        console.warn('[useAllOfficeReps] Fetch failed or timed out:', error?.message);
        // Fall back to cache on timeout/error
        const cached = getCachedData();
        if (cached) {
          console.log('[useAllOfficeReps] Returning cached data as fallback');
          return cached;
        }
        throw error;
      }
    },
    placeholderData: getCachedData(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
  });
};
