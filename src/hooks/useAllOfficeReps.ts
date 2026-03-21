import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Normalize stage for filtering - maps display stages to canonical forms
const normalizeStage = (stage: string | null | undefined): string | null => {
  if (!stage) return null;
  const lower = stage.toLowerCase().trim();
  
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
        // Fetch all data in parallel instead of sequentially
        const [repsResult, teamsResult, teamMgmtResult, mgmtResult] = await Promise.all([
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
        ]);

        if (repsResult.error) throw repsResult.error;
        if (teamsResult.error) throw teamsResult.error;
        if (teamMgmtResult.error) throw teamMgmtResult.error;
        if (mgmtResult.error) throw mgmtResult.error;

        const reps = repsResult.data || [];
        const teams = teamsResult.data || [];
        const teamMgmtGroups = teamMgmtResult.data || [];
        const mgmtGroups = mgmtResult.data || [];

        // Build team lead -> team map
        const teamByLeadUserId = new Map(
          teams.map(t => [t.lead_user_id, { id: t.id, name: t.name }])
        );

        // Build team -> mgmt group map
        const teamToMgmt = new Map(
          teamMgmtGroups.map(tmg => [tmg.team_id, tmg.mgmt_group_id])
        );

        // Build mgmt group map by id
        const mgmtById = new Map(
          mgmtGroups.map(mg => [mg.id, { id: mg.id, name: mg.name }])
        );

        // For each rep, try to find their team
        const findTeamForRep = (userId: string): { teamId: string; teamName: string } | null => {
          const team = teamByLeadUserId.get(userId);
          return team ? { teamId: team.id, teamName: team.name } : null;
        };

        // Filter to active stages and map to standard format
        const officeReps: OfficeRep[] = reps
          .filter(rep => {
            if (!rep.user_id) return false;
            const normalizedStage = normalizeStage(rep.stage);
            return normalizedStage && ACTIVE_STAGES.includes(normalizedStage);
          })
          .map(rep => {
            const teamInfo = findTeamForRep(rep.user_id!);
            
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
