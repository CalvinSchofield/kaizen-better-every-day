import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AssignableUser {
  userId: string;
  name: string;
  role: string;
  notionPageId: string;
}

export const useAssignableUsers = () => {
  return useQuery({
    queryKey: ['assignable-users'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-assignable-users');
      
      if (error) {
        console.error('Error fetching assignable users:', error);
        return [];
      }
      
      return (data?.assignableUsers || []) as AssignableUser[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
