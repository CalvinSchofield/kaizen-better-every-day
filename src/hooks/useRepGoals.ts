import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "./useRepData";

export interface TrainingWeekHistory {
  week_start: string; // ISO date string (Sunday)
  minutes: number;
}

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
  // Weekly training tracking
  training_week_start: string | null;
  training_hours_history: TrainingWeekHistory[];
  // Cancel rate for adjusting goals (decimal, e.g., 0.10 = 10%)
  cancel_rate: number;
  setup_complete: boolean;
  created_at: string;
  updated_at: string;
}

// Get the start of the current week (Sunday) in user's local timezone
const getCurrentWeekStart = (): string => {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = Sunday
  const diff = now.getDate() - dayOfWeek;
  const sunday = new Date(now.setDate(diff));
  sunday.setHours(0, 0, 0, 0);
  return sunday.toISOString().split('T')[0];
};

// Get cached goals data for instant loading
const getCachedGoals = (userId: string): RepGoals | null => {
  try {
    const cached = localStorage.getItem(`rep-goals-cache-${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Use cache if less than 5 minutes old
      if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
        return {
          ...parsed.data,
          training_hours_history: Array.isArray(parsed.data.training_hours_history)
            ? parsed.data.training_hours_history
            : [],
        };
      }
    }
  } catch {
    // Ignore cache errors
  }
  return null;
};

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
      
      // Update cache
      if (data) {
        localStorage.setItem(`rep-goals-cache-${repData.user_id}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
      }
      
      // Parse training_hours_history from JSON if it exists
      const parsedData = data ? {
        ...data,
        training_hours_history: (Array.isArray(data.training_hours_history) 
          ? data.training_hours_history as unknown as TrainingWeekHistory[]
          : []),
      } : null;
      
      return parsedData as RepGoals | null;
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
    initialData: repData?.user_id ? getCachedGoals(repData.user_id) : undefined,
  });

  // Check if we need to reset training progress for new week
  const checkAndResetWeeklyProgress = async () => {
    if (!goals || !repData?.user_id) return;
    
    const currentWeekStart = getCurrentWeekStart();
    const storedWeekStart = goals.training_week_start;
    
    // If week has changed, archive current progress and reset
    if (storedWeekStart && storedWeekStart !== currentWeekStart) {
      const currentProgress = goals.training_hours_progress || 0;
      
      // Only archive if there was actual progress
      const newHistory: TrainingWeekHistory[] = currentProgress > 0 
        ? [...(goals.training_hours_history || []), { 
            week_start: storedWeekStart, 
            minutes: currentProgress 
          }]
        : (goals.training_hours_history || []);
      
      // Keep only last 12 weeks of history
      const trimmedHistory = newHistory.slice(-12);
      
      await supabase
        .from('rep_goals')
        .update({
          training_hours_progress: 0,
          training_week_start: currentWeekStart,
          training_hours_history: JSON.parse(JSON.stringify(trimmedHistory)),
        })
        .eq('user_id', repData.user_id);
      
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
    } else if (!storedWeekStart) {
      // Initialize week start if not set
      await supabase
        .from('rep_goals')
        .update({ training_week_start: currentWeekStart })
        .eq('user_id', repData.user_id);
    }
  };

  // Check for weekly reset when goals are loaded
  const needsWeeklyCheck = goals && goals.training_week_start !== getCurrentWeekStart();

  const upsertGoalsMutation = useMutation({
    mutationFn: async (updates: Partial<RepGoals>) => {
      if (!repData?.user_id) throw new Error('No user ID');
      
      // Ensure week start is set when updating training progress
      const currentWeekStart = getCurrentWeekStart();
      
      // Remove training_hours_history from updates if present (handle separately)
      const { training_hours_history, ...restUpdates } = updates;
      
      const finalUpdates: Record<string, unknown> = {
        ...restUpdates,
        training_week_start: updates.training_hours_progress !== undefined 
          ? currentWeekStart 
          : undefined,
      };

      const { data, error } = await supabase
        .from('rep_goals')
        .upsert({
          user_id: repData.user_id,
          ...finalUpdates,
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
    checkAndResetWeeklyProgress,
    needsWeeklyCheck,
    currentWeekStart: getCurrentWeekStart(),
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
      return (data || []).map(d => ({
        ...d,
        training_hours_history: (Array.isArray(d.training_hours_history) 
          ? d.training_hours_history as unknown as TrainingWeekHistory[]
          : []),
      })) as RepGoals[];
    },
    staleTime: 5 * 60 * 1000,
  });
};
