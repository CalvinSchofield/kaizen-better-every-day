import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignableUser {
  userId: string;
  name: string;
  role: string;
  notionPageId: string;
}

interface UseAssignableUsersOptions {
  recruitNotionPageId?: string;
}

export const useAssignableUsers = (options?: UseAssignableUsersOptions) => {
  const { recruitNotionPageId } = options || {};
  
  return useQuery({
    queryKey: ['assignable-users', recruitNotionPageId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-assignable-users', {
        body: { recruitNotionPageId }
      });
      
      if (error) {
        console.error('Error fetching assignable users:', error);
        return [];
      }
      
      return (data?.assignableUsers || []) as AssignableUser[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!recruitNotionPageId, // Only fetch when we have a recruit
  });
};
