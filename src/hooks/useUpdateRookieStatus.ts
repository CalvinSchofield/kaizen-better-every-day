import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpdateRookieStatusParams {
  rookieNotionPageId: string;
  onboardingStatus?: string;
  ipadAssigned?: boolean;
}

export const useUpdateRookieStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rookieNotionPageId, onboardingStatus, ipadAssigned }: UpdateRookieStatusParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { rookieNotionPageId, onboardingStatus, ipadAssigned },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['group-recruits'] });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'] });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'] });
    },
    onError: (error) => {
      console.error('Failed to update rookie status:', error);
      toast.error('Failed to update status');
    },
  });
};
