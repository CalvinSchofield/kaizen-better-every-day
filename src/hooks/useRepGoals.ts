import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "./useRepData";

export interface RepGoals {
  id: string;
  user_id: string;
  monthly_expenses: number;
  months_off: number;
  rent_type: string;
  avg_prmr_per_fp: number;
  upgrade_fp_goal: number;
  weeks_working: number;
  must_do_fp_goal: number;
  will_do_fp_goal: number;
  could_do_fp_goal: number;
  training_hours_goal: number;
  books_goal: number;
  monday_night_lights_goal: number;
  role_plays_goal: number;
  blitzes_goal: number;
  preseason_fp_goal: number;
  recruits_with_sale_goal: number;
  // Progress tracking fields
  training_hours_progress: number;
  books_progress: number;
  monday_night_lights_progress: number;
  role_plays_progress: number;
  blitzes_progress: number;
  recruits_with_sale_progress: number;
  // Cancel rate for adjusting goals (decimal, e.g., 0.10 = 10%)
  cancel_rate: number;
  setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

export const useRepGoals = () => {
  const queryClient = useQueryClient();
  const { repData } = useRepData();

  const { data: goals, isLoading, error, refetch } = useQuery({
    queryKey: ['rep-goals', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return null;

      const { data, error } = await supabase
        .from('rep_goals')
        .select('*')
        .eq('user_id', repData.user_id)
        .maybeSingle();

      if (error) throw error;
      return data as RepGoals | null;
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });

  const upsertGoalsMutation = useMutation({
    mutationFn: async (updates: Partial<RepGoals>) => {
      if (!repData?.user_id) throw new Error('No user ID');

      const { data, error } = await supabase
        .from('rep_goals')
        .upsert({
          user_id: repData.user_id,
          ...updates,
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
    },
  });

  const updateGoals = async (updates: Partial<RepGoals>) => {
    return upsertGoalsMutation.mutateAsync(updates);
  };

  // Check if user has access to Goals page (Phase 1+ in Ramp to Blitz)
  const hasGoalsAccess = (): boolean => {
    if (!repData) return false;
    
    // Vets and Sophomores always have access
    if (repData.year === 'Vet' || repData.year === 'Sophomore') return true;
    
    // Rookies need to be in Phase 1+ of Ramp to Blitz
    const phase = repData.ramp_to_blitz_phase;
    if (!phase || phase === 'Not started') return false;
    
    return true;
  };

  return {
    goals,
    isLoading,
    error,
    refetch,
    updateGoals,
    isUpdating: upsertGoalsMutation.isPending,
    hasGoalsAccess: hasGoalsAccess(),
    isRookie: repData?.year === 'Rookie',
  };
};

// Hook to fetch all rep goals for leader view
export const useAllRepGoals = () => {
  return useQuery({
    queryKey: ['all-rep-goals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rep_goals')
        .select('*');

      if (error) throw error;
      return data as RepGoals[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
