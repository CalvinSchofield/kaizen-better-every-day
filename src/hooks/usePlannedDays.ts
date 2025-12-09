import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRepData } from "./useRepData";

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

    const { error } = await supabase
      .from('planned_work_days')
      .insert(newDates.map(date => ({
        user_id: repData.user_id,
        planned_date: date,
      })));

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['planned-days'] });
  };

  const removeMultipleDays = async (dates: string[]) => {
    if (!repData?.user_id || dates.length === 0) return;

    const { error } = await supabase
      .from('planned_work_days')
      .delete()
      .eq('user_id', repData.user_id)
      .in('planned_date', dates);

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['planned-days'] });
  };

  const clearAllPlannedDays = async () => {
    if (!repData?.user_id) return;

    const { error } = await supabase
      .from('planned_work_days')
      .delete()
      .eq('user_id', repData.user_id);

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['planned-days'] });
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
