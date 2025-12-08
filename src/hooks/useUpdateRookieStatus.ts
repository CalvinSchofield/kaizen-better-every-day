import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpdateRookieStatusParams {
  rookieNotionPageId: string;
  onboardingStatus?: string;
  ipadAssigned?: boolean;
  rampPhase1Complete?: boolean;
  rampPhase2Complete?: boolean;
  rampPhase3Complete?: boolean;
  rampPhase4Complete?: boolean;
}

export const useUpdateRookieStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      rookieNotionPageId, 
      onboardingStatus, 
      ipadAssigned,
      rampPhase1Complete,
      rampPhase2Complete,
      rampPhase3Complete,
      rampPhase4Complete
    }: UpdateRookieStatusParams) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('update-rookie-status', {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { 
          rookieNotionPageId, 
          onboardingStatus, 
          ipadAssigned,
          rampPhase1Complete,
          rampPhase2Complete,
          rampPhase3Complete,
          rampPhase4Complete
        },
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
