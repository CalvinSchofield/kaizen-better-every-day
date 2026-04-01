import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignableUser {
  userId: string;
  name: string;
  role: string;
  repId: string;
  profilePhotoUrl: string | null;
  formalRole: string | null;
  year: string | null;
  location: string | null;
  sameLocation: boolean;
}

interface UseAssignableUsersOptions {
  recruitId?: string;
  recruitTeamLeader?: string | null;
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
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!recruitId,
  });
};
