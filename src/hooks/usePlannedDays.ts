import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "./useRepData";
import { hapticLight, hapticWarning } from "@/utils/haptics";
import { toast } from "sonner";

export interface PlannedDay {
  id: string;
  user_id: string;
  planned_date: string;
  created_at: string;
}

// Get cached planned days for instant loading
const getCachedPlannedDays = (userId: string): PlannedDay[] | undefined => {
  try {
    const cached = localStorage.getItem(`planned-days-cache-${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.timestamp && Date.now() - parsed.timestamp < 5 * 60 * 1000) {
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
  const { repData } = useRepData();

  const { data: plannedDays, isLoading, error, refetch } = useQuery({
    queryKey: ['planned-days', repData?.user_id],
    queryFn: async () => {
      if (!repData?.user_id) return [];

      const { data, error } = await supabase
        .from('planned_work_days')
        .select('*')
        .eq('user_id', repData.user_id)
        .order('planned_date', { ascending: true });

      if (error) throw error;
      
      // Update cache
      localStorage.setItem(`planned-days-cache-${repData.user_id}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      
      return data as PlannedDay[];
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
    initialData: repData?.user_id ? getCachedPlannedDays(repData.user_id) : undefined,
  });

  const addPlannedDayMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!repData?.user_id) throw new Error('No user ID');

      const { data, error } = await supabase
        .from('planned_work_days')
        .insert({
          user_id: repData.user_id,
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
      await queryClient.cancelQueries({ queryKey: ['planned-days', repData?.user_id] });

      // Snapshot current data for rollback
      const previousDays = queryClient.getQueryData(['planned-days', repData?.user_id]);

      // Optimistically add the day
      queryClient.setQueryData(['planned-days', repData?.user_id], (old: PlannedDay[] | undefined) => {
        const optimisticDay: PlannedDay = {
          id: `optimistic-${date}-${Date.now()}`,
          user_id: repData?.user_id!,
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
        queryClient.setQueryData(['planned-days', repData?.user_id], context.previousDays);
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
      if (!repData?.user_id) throw new Error('No user ID');

      const { error } = await supabase
        .from('planned_work_days')
        .delete()
        .eq('user_id', repData.user_id)
        .eq('planned_date', date);

      if (error) throw error;
    },
    // OPTIMISTIC UPDATE - Instant UI feedback
    onMutate: async (date) => {
      // Haptic feedback immediately
      hapticLight();
      
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['planned-days', repData?.user_id] });

      // Snapshot current data for rollback
      const previousDays = queryClient.getQueryData(['planned-days', repData?.user_id]);

      // Optimistically remove the day
      queryClient.setQueryData(['planned-days', repData?.user_id], (old: PlannedDay[] | undefined) => {
        return (old || []).filter(d => d.planned_date !== date);
      });

      return { previousDays };
    },
    onError: (error, date, context) => {
      console.error('Error removing planned day:', error);
      
      // Rollback on error
      if (context?.previousDays) {
        queryClient.setQueryData(['planned-days', repData?.user_id], context.previousDays);
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
    if (!repData?.user_id) return;
    
    // Filter out already planned dates
    const newDates = dates.filter(d => !plannedDays?.some(p => p.planned_date === d));
    if (newDates.length === 0) return;

    // Optimistic update for multiple days
    const previousDays = queryClient.getQueryData(['planned-days', repData?.user_id]);
    
    queryClient.setQueryData(['planned-days', repData?.user_id], (old: PlannedDay[] | undefined) => {
      const optimisticDays = newDates.map(date => ({
        id: `optimistic-${date}-${Date.now()}`,
        user_id: repData?.user_id!,
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
          user_id: repData.user_id,
          planned_date: date,
        })));

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['planned-days', repData?.user_id], previousDays);
      hapticWarning();
      toast.error('Failed to add days');
      throw error;
    }
  };

  const removeMultipleDays = async (dates: string[]) => {
    if (!repData?.user_id || dates.length === 0) return;

    // Optimistic update
    const previousDays = queryClient.getQueryData(['planned-days', repData?.user_id]);
    
    queryClient.setQueryData(['planned-days', repData?.user_id], (old: PlannedDay[] | undefined) => {
      return (old || []).filter(d => !dates.includes(d.planned_date));
    });

    try {
      const { error } = await supabase
        .from('planned_work_days')
        .delete()
        .eq('user_id', repData.user_id)
        .in('planned_date', dates);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['planned-days', repData?.user_id], previousDays);
      hapticWarning();
      toast.error('Failed to remove days');
      throw error;
    }
  };

  const clearAllPlannedDays = async () => {
    if (!repData?.user_id) return;

    // Optimistic update
    const previousDays = queryClient.getQueryData(['planned-days', repData?.user_id]);
    queryClient.setQueryData(['planned-days', repData?.user_id], []);

    try {
      const { error } = await supabase
        .from('planned_work_days')
        .delete()
        .eq('user_id', repData.user_id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['planned-days'] });
    } catch (error) {
      // Rollback on error
      queryClient.setQueryData(['planned-days', repData?.user_id], previousDays);
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
