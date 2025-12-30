import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TeamAccessResponse {
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'none';
  mgmtGroups: Array<{
    id: string;
    name: string;
    teamIds: string[];
    groupLeadId: string;
  }>;
  teams: Array<{
    id: string;
    name: string;
    groupLeadId: string;
  }>;
  accessibleUserIds: string[];
  accessibleReps: Array<{
    id: string; // Supabase UUID for the rep record
    userId: string | null; // null for ghost reps (no app account)
    name: string;
    phone?: string | null;
    year?: string | null;
    stage?: string | null;
    teamId?: string | null;
    teamName?: string | null;
    mgmtGroupId?: string | null;
    mgmtGroupName?: string | null;
    isGhostRep?: boolean; // true if rep has no app account
    rampPhase1Complete?: boolean;
  }>;
}

export const useTeamAccess = () => {
  return useQuery({
    queryKey: ['team-access'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const CACHE_KEY = `team-access-cache:v3:${session.user.id}`;

      // Try to load from cache first (scoped per user)
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          // Use cache if less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            return data as TeamAccessResponse;
          }
        } catch (e) {
          console.error('Failed to parse team access cache:', e);
        }
      }

      const { data, error } = await supabase.functions.invoke('fetch-team-access', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Update cache
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));

      return data as TeamAccessResponse;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in memory for 30 minutes
  });
};
