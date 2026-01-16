import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TeamAccessResponse {
  accessLevel: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'recruiter' | 'none';
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

      const CACHE_KEY = `team-access-cache:v4:${session.user.id}`;

      // Try to load from cache first (scoped per user)
      const cachedData = localStorage.getItem(CACHE_KEY);
      let cachedResult: TeamAccessResponse | null = null;
      
      if (cachedData) {
        try {
          const { data, timestamp } = JSON.parse(cachedData);
          // Use cache if less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            return data as TeamAccessResponse;
          }
          // Keep stale cache as fallback
          cachedResult = data as TeamAccessResponse;
        } catch (e) {
          console.error('Failed to parse team access cache:', e);
        }
      }

      try {
        // Add timeout for mobile networks - 20 second timeout with Promise.race
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 20000);
        });

        const fetchPromise = supabase.functions.invoke('fetch-team-access', {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

        if (error) {
          console.error('[useTeamAccess] Edge function error:', error);
          // If we have cached data, return it instead of throwing
          if (cachedResult) {
            console.log('[useTeamAccess] Returning stale cache due to error');
            return cachedResult;
          }
          throw error;
        }

        // Update cache (best-effort - don't fail the request if caching fails)
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify({
            data,
            timestamp: Date.now()
          }));
        } catch (cacheError) {
          console.warn('[useTeamAccess] Failed to cache result (storage full?):', cacheError);
        }

        return data as TeamAccessResponse;
      } catch (fetchError: any) {
        console.error('[useTeamAccess] Fetch failed:', fetchError?.message || fetchError);
        // Return cached data if available (stale is better than nothing)
        if (cachedResult) {
          console.log('[useTeamAccess] Returning stale cache due to fetch failure');
          return cachedResult;
        }
        throw fetchError;
      }
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in memory for 30 minutes
    retry: 3, // Retry 3 times for mobile network flakiness
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000), // Exponential backoff
  });
};
