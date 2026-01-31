import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "./useCurrentUserId";
import { hapticLight, hapticWarning } from "@/utils/haptics";
import { toast } from "sonner";

export interface PlannedDay {
  id: string;
  user_id: string;
  planned_date: string;
  created_at: string;
}

// Get cached planned days for instant loading - with extended cache window for reliability
const getCachedPlannedDays = (userId: string): PlannedDay[] | undefined => {
  try {
    const cached = localStorage.getItem(`planned-days-cache-${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Extended to 30 minutes for reliability - stale-while-revalidate pattern
      if (parsed.timestamp && Date.now() - parsed.timestamp < 30 * 60 * 1000) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return undefined;
};

export const usePlannedDays = () => {
  const queryClient = useQueryClient();
  // Use useCurrentUserId for faster auth access - this hydrates from localStorage instantly
  const { userId, isReady } = useCurrentUserId();

  const { data: plannedDays, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['planned-days', userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from('planned_work_days')
        .select('*')
        .eq('user_id', userId)
        .order('planned_date', { ascending: true });

      if (error) throw error;
      
      // Update cache
      localStorage.setItem(`planned-days-cache-${userId}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      return data as PlannedDay[];
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes - faster revalidation
    gcTime: 30 * 60 * 1000, // Keep in memory for 30 min
    initialData: userId ? getCachedPlannedDays(userId) : undefined,
    retry: 3, // Retry failed fetches up to 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Exponential backoff
  });

  const addPlannedDayMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!userId) throw new Error('No user ID');

      const { data, error } = await supabase
        .from('planned_work_days')
        .insert({
          user_id: userId,
          planned_date: date,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    // OPTIMISTIC UPDATE - Instant UI feedback
    onMutate: async (date) => {
      // Haptic feedback immediately
      hapticLight();
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['planned-days', userId] });

      // Snapshot current data for rollback
      const previousDays = queryClient.getQueryData(['planned-days', userId]);

      // Optimistically add the day
      queryClient.setQueryData(['planned-days', userId], (old: PlannedDay[] | undefined) => {
        const optimisticDay: PlannedDay = {
          id: `optimistic-${date}-${Date.now()}`,
          user_id: userId!,
          planned_date: date,
          created_at: new Date().toISOString(),
        };
        return [...(old || []), optimisticDay].sort((a, b) => 
          a.planned_date.localeCompare(b.planned_date)
        );
      });

      return { previousDays };
    },
    onError: (error, date, context) => {
      console.error('Error adding planned day:', error);
      
      // Rollback on error
      if (context?.previousDays) {
        queryClient.setQueryData(['planned-days', userId], context.previousDays);
      }
      
      hapticWarning();
      toast.error('Failed to add day', {
        action: {
          label: 'Retry',
          onClick: () => addPlannedDayMutation.mutate(date),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    },
  });

  const removePlannedDayMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!userId) throw new Error('No user ID');

      const { error } = await supabase
        .from('planned_work_days')
        .delete()
        .eq('user_id', userId)
        .eq('planned_date', date);

      if (error) throw error;
    },
    // OPTIMISTIC UPDATE - Instant UI feedback
    onMutate: async (date) => {
      // Haptic feedback immediately
      hapticLight();
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['planned-days', userId] });

      // Snapshot current data for rollback
      const previousDays = queryClient.getQueryData(['planned-days', userId]);

      // Optimistically remove the day
      queryClient.setQueryData(['planned-days', userId], (old: PlannedDay[] | undefined) => {
        return (old || []).filter(d => d.planned_date !== date);
      });

      return { previousDays };
    },
    onError: (error, date, context) => {
      console.error('Error removing planned day:', error);
      
      // Rollback on error
      if (context?.previousDays) {
        queryClient.setQueryData(['planned-days', userId], context.previousDays);
      }
      
      hapticWarning();
      toast.error('Failed to remove day', {
        action: {
          label: 'Retry',
          onClick: () => removePlannedDayMutation.mutate(date),
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    },
  });

  const togglePlannedDay = async (date: string) => {
    const isPlanned = plannedDays?.some(d => d.planned_date === date);
    if (isPlanned) {
      await removePlannedDayMutation.mutateAsync(date);
    } else {
      await addPlannedDayMutation.mutateAsync(date);
    }
  };

  const addMultipleDays = async (dates: string[]) => {
    if (!userId) return;
    
    // Filter out already planned dates
    const newDates = dates.filter(d => !plannedDays?.some(p => p.planned_date === d));
    if (newDates.length === 0) return;

    // Optimistic update for multiple days
    const previousDays = queryClient.getQueryData(['planned-days', userId]);
    
    queryClient.setQueryData(['planned-days', userId], (old: PlannedDay[] | undefined) => {
      const optimisticDays = newDates.map(date => ({
        id: `optimistic-${date}-${Date.now()}`,
        user_id: userId!,
        planned_date: date,
        created_at: new Date().toISOString(),
      }));
      return [...(old || []), ...optimisticDays].sort((a, b) => 
        a.planned_date.localeCompare(b.planned_date)
      );
    });

    try {
      const { error } = await supabase
        .from('planned_work_days')
        .insert(newDates.map(date => ({
          user_id: userId,
          planned_date: date,
        })));

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['planned-days', userId], previousDays);
      hapticWarning();
      toast.error('Failed to add days');
      throw error;
    }
  };

  const removeMultipleDays = async (dates: string[]) => {
    if (!userId || dates.length === 0) return;

    // Optimistic update
    const previousDays = queryClient.getQueryData(['planned-days', userId]);
    
    queryClient.setQueryData(['planned-days', userId], (old: PlannedDay[] | undefined) => {
      return (old || []).filter(d => !dates.includes(d.planned_date));
    });

    try {
      const { error } = await supabase
        .from('planned_work_days')
        .delete()
        .eq('user_id', userId)
        .in('planned_date', dates);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['planned-days', userId], previousDays);
      hapticWarning();
      toast.error('Failed to remove days');
      throw error;
    }
  };

  const clearAllPlannedDays = async () => {
    if (!userId) return;

    // Optimistic update
    const previousDays = queryClient.getQueryData(['planned-days', userId]);
    queryClient.setQueryData(['planned-days', userId], []);

    try {
      const { error } = await supabase
        .from('planned_work_days')
        .delete()
        .eq('user_id', userId);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['planned-days', userId], previousDays);
      hapticWarning();
      toast.error('Failed to clear days');
      throw error;
    }
  };

  const isDatePlanned = (date: string): boolean => {
    return plannedDays?.some(d => d.planned_date === date) || false;
  };

  const getPlannedDaysCount = (): number => {
    return plannedDays?.length || 0;
  };

  // Get planned days within a date range
  const getPlannedDaysInRange = (startDate: string, endDate: string): PlannedDay[] => {
    if (!plannedDays) return [];
    return plannedDays.filter(d => d.planned_date >= startDate && d.planned_date <= endDate);
  };

  return {
    plannedDays,
    isLoading,
    isFetching, // Expose for loading indicator when refetching
    error,
    refetch,
    togglePlannedDay,
    addMultipleDays,
    removeMultipleDays,
    clearAllPlannedDays,
    isDatePlanned,
    getPlannedDaysCount,
    getPlannedDaysInRange,
    isToggling: addPlannedDayMutation.isPending || removePlannedDayMutation.isPending,
  };
};
