import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignableUser {
  userId: string;
  name: string;
  role: string;
  repId: string;
}

interface UseAssignableUsersOptions {
  recruitId?: string;
  recruitTeamLeader?: string | null; // Fallback for recruits not in reps table
}

export const useAssignableUsers = (options?: UseAssignableUsersOptions) => {
  const { recruitId, recruitTeamLeader } = options || {};
  
  return useQuery({
    queryKey: ['assignable-users', recruitId, recruitTeamLeader],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-assignable-users', {
        body: { recruitId, recruitTeamLeader }
      });
      
      if (error) {
        console.error('Error fetching assignable users:', error);
        return [];
      }
      
      return (data?.assignableUsers || []) as AssignableUser[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!recruitId, // Only fetch when we have a recruit
  });
};
