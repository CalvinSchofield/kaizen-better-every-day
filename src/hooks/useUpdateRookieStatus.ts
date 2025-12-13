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

// Map onboarding status to boolean flags for optimistic updates
function parseOnboardingStatus(status: string | undefined) {
  if (!status) return {};
  
  const statusOrder = [
    'Not started',
    'Onboarding ✅',
    'Required Trainings ✅',
    'Slack ✅',
    'Phase 1 ✅',
    'Phase 2 ✅',
    'Phase 3 ✅',
    'Phase 4 ✅'
  ];
  
  const index = statusOrder.indexOf(status);
  
  return {
    onboarding_complete: index >= 1,
    trainings_complete: index >= 2,
    slack_joined: index >= 3,
    ramp_phase_1_complete: index >= 4,
    ramp_phase_2_complete: index >= 5,
    ramp_phase_3_complete: index >= 6,
    ramp_phase_4_complete: index >= 7,
    ramp_to_blitz_phase: status,
  };
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
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['recruits-rep-data'] });
      await queryClient.cancelQueries({ queryKey: ['group-recruits'] });

      // Build the optimistic update
      const optimisticUpdate: Record<string, any> = {};
      
      if (variables.onboardingStatus !== undefined) {
        Object.assign(optimisticUpdate, parseOnboardingStatus(variables.onboardingStatus));
      }
      if (variables.ipadAssigned !== undefined) {
        optimisticUpdate.ipad_assigned = variables.ipadAssigned;
      }
      if (variables.rampPhase1Complete !== undefined) {
        optimisticUpdate.ramp_phase_1_complete = variables.rampPhase1Complete;
      }
      if (variables.rampPhase2Complete !== undefined) {
        optimisticUpdate.ramp_phase_2_complete = variables.rampPhase2Complete;
      }
      if (variables.rampPhase3Complete !== undefined) {
        optimisticUpdate.ramp_phase_3_complete = variables.rampPhase3Complete;
      }
      if (variables.rampPhase4Complete !== undefined) {
        optimisticUpdate.ramp_phase_4_complete = variables.rampPhase4Complete;
      }

      // Optimistically update recruits-rep-data cache (uses partial key matching)
      queryClient.setQueriesData(
        { queryKey: ['recruits-rep-data'], exact: false }, 
        (old: any) => {
          if (!old || !Array.isArray(old)) return old;
          return old.map((rep: any) => 
            rep.notion_page_id === variables.rookieNotionPageId
              ? { ...rep, ...optimisticUpdate }
              : rep
          );
        }
      );

      // Return context for rollback
      return { variables, optimisticUpdate };
    },
    onSuccess: () => {
      // Invalidate relevant queries to refresh from server (partial key matching)
      queryClient.invalidateQueries({ queryKey: ['group-recruits'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruit-rep-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['leader-preseason-prep-leaderboard-weekly'], exact: false });
    },
    onError: (error, variables) => {
      console.error('Failed to update rookie status:', error);
      toast.error('Failed to update status');
      
      // Invalidate to refetch correct data after error
      queryClient.invalidateQueries({ queryKey: ['recruits-rep-data'], exact: false });
      queryClient.invalidateQueries({ queryKey: ['group-recruits'], exact: false });
    },
  });
};
