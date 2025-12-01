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
    userId: string;
    name: string;
    notionPageId: string;
  }>;
}

export const useTeamAccess = () => {
  return useQuery({
    queryKey: ['team-access'],
    queryFn: async () => {
      // Try to load from cache first
      const cachedData = localStorage.getItem('team-access-cache');
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

      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('fetch-team-access', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      // Update cache
      localStorage.setItem('team-access-cache', JSON.stringify({
        data,
        timestamp: Date.now()
      }));

      return data as TeamAccessResponse;
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    gcTime: 1000 * 60 * 30, // Keep in memory for 30 minutes
  });
};
