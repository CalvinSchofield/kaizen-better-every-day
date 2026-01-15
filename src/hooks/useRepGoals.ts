import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "./useRepData";
import { hapticSuccess, hapticWarning } from "@/utils/haptics";
import { toast } from "sonner";

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
  // Training streak tracking
  training_streak: number;
  last_training_date: string | null;
  // Cancel rate for adjusting goals (decimal, e.g., 0.10 = 10%)
  cancel_rate: number;
  setup_complete: boolean;
  created_at: string;
  updated_at: string;
  // Multi-device synced book data
  books_committed: string[] | null;
  books_read: string[] | null;
  other_books_committed: string[] | null;
  other_books_read: string[] | null;
  // Multi-device synced weekly activity logs
  weekly_mnl_logs: Record<string, number> | null;
  weekly_roleplay_logs: Record<string, number> | null;
  // Custom payscale FP level for ROI calculations
  custom_payscale_fp: number | null;
  // Focus tier for summer goals (mustDo, willDo, couldDo)
  focus_tier: string | null;
  // Purpose statement - the "why" behind their goals
  purpose_statement: string | null;
  purpose_answers: Record<string, string> | null;
  purpose_updated_at: string | null;
  // Preferred ROI display mode (upfront or total)
  preferred_roi_mode: 'upfront' | 'total' | null;
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
// Cache is valid for 24 hours to prevent re-showing wizard on app restart
const getCachedGoals = (userId: string): RepGoals | null => {
  try {
    const cached = localStorage.getItem(`rep-goals-cache-${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Use cache if less than 24 hours old to prevent wizard flashing on app restart
      if (parsed.timestamp && Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
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

      // Handle streak logic when training is logged
      if (updates.training_hours_progress !== undefined && goals) {
        // Use local timezone for date comparison
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const lastDate = goals.last_training_date;
        
        if (lastDate === today) {
          // Same day - no streak change
        } else if (lastDate) {
          const lastDateObj = new Date(lastDate);
          const todayObj = new Date(today);
          const diffDays = Math.floor((todayObj.getTime() - lastDateObj.getTime()) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            // Consecutive day - increment streak
            finalUpdates.training_streak = (goals.training_streak || 0) + 1;
          } else {
            // Missed a day - reset streak to 1
            finalUpdates.training_streak = 1;
          }
        } else {
          // First training ever - start streak at 1
          finalUpdates.training_streak = 1;
        }
        finalUpdates.last_training_date = today;
      }

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
    // OPTIMISTIC UPDATE - Instant UI feedback
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['rep-goals', repData?.user_id] });

      // Snapshot current data for rollback
      const previousGoals = queryClient.getQueryData(['rep-goals', repData?.user_id]);

      // Optimistically update the cache
      queryClient.setQueryData(['rep-goals', repData?.user_id], (old: RepGoals | null | undefined) => {
        if (!old) return old;
        return { ...old, ...updates };
      });

      return { previousGoals };
    },
    onError: (error, updates, context) => {
      console.error('Error updating goals:', error);
      
      // Rollback on error
      if (context?.previousGoals) {
        queryClient.setQueryData(['rep-goals', repData?.user_id], context.previousGoals);
      }
      
      hapticWarning();
      toast.error('Failed to save goals', {
        action: {
          label: 'Retry',
          onClick: () => upsertGoalsMutation.mutate(updates),
        },
      });
    },
    onSuccess: () => {
      hapticSuccess();
      queryClient.invalidateQueries({ queryKey: ['rep-goals'] });
      // Also invalidate leaderboard so it updates immediately
      queryClient.invalidateQueries({ queryKey: ['preseason-prep-leaderboard-weekly'] });
    },
  });

  const updateGoals = async (updates: Partial<RepGoals>) => {
    return upsertGoalsMutation.mutateAsync(updates);
  };

  // Check if user has access to Goals page (Slack joined or Phase 1+ complete for rookies)
  const hasGoalsAccess = (): boolean => {
    if (!repData) return false;
    
    // Vets and Sophomores always have access
    if (repData.year === 'Vet' || repData.year === 'Sophomore') return true;
    
    // Rookies need to have Slack joined OR have completed Phase 1+ (which implies prerequisites done)
    if (repData.slack_joined === true) return true;
    
    // Check if any ramp phase is complete (phase 1+ implies all prerequisites including slack)
    const phase = repData.ramp_to_blitz_phase?.toLowerCase() || '';
    const hasCompletedPhase = phase.includes('phase 1') && phase.includes('✅') ||
                              phase.includes('phase 2') && phase.includes('✅') ||
                              phase.includes('phase 3') && phase.includes('✅') ||
                              phase.includes('phase 4') && phase.includes('✅') ||
                              repData.ramp_phase_1_complete === true;
    
    return hasCompletedPhase;
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
