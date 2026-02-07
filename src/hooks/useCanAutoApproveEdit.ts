import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Check if the current user can auto-approve edits for a challenge
 * (i.e., they have leadership access and all participants are in their downline)
 */
export const useCanAutoApproveEdit = (challengeId: string | null, participantUserIds: string[]) => {
  return useQuery({
    queryKey: ['can-auto-approve-edit', challengeId, participantUserIds],
    queryFn: async () => {
      if (!challengeId || participantUserIds.length === 0) return false;

      try {
        const { data: accessData } = await supabase.functions.invoke('fetch-team-access');
        
        if (!accessData?.accessLevel || accessData.accessLevel === 'none') {
          return false;
        }

        const downlineUserIds = new Set<string>(accessData?.accessibleUserIds || []);
        return participantUserIds.every(id => downlineUserIds.has(id));
      } catch (e) {
        console.error('[useCanAutoApproveEdit] Error:', e);
        return false;
      }
    },
    enabled: !!challengeId && participantUserIds.length > 0,
    staleTime: 60 * 1000, // 1 minute
  });
};
