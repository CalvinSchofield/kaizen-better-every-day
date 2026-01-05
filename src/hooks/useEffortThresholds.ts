import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_EFFORT_THRESHOLDS, EffortThresholds } from "@/utils/effortScore";

export interface EffortThresholdsRecord {
  id: string;
  team_id: string | null;
  mgmt_group_id: string | null;
  created_by: string;
  doors_per_hour_rookie: number;
  doors_per_hour_vet: number;
  late_start_minutes: number;
  early_end_minutes: number;
  min_hours_worked: number;
  created_at: string;
  updated_at: string;
}

interface UseEffortThresholdsParams {
  teamId?: string;
  mgmtGroupId?: string;
}

export const useEffortThresholds = ({ teamId, mgmtGroupId }: UseEffortThresholdsParams = {}) => {
  const queryClient = useQueryClient();

  const { data: thresholdsRecord, isLoading } = useQuery({
    queryKey: ['effort-thresholds', teamId, mgmtGroupId],
    queryFn: async () => {
      // Try to find thresholds for this specific team or mgmt group
      let query = supabase
        .from('effort_thresholds')
        .select('*');
      
      if (teamId) {
        query = query.eq('team_id', teamId);
      } else if (mgmtGroupId) {
        query = query.eq('mgmt_group_id', mgmtGroupId);
      } else {
        return null;
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as EffortThresholdsRecord | null;
    },
    enabled: !!(teamId || mgmtGroupId),
    staleTime: 5 * 60 * 1000,
  });

  // Convert DB record to EffortThresholds format
  const thresholds: EffortThresholds = thresholdsRecord ? {
    doorsPerHourRookie: thresholdsRecord.doors_per_hour_rookie,
    doorsPerHourVet: thresholdsRecord.doors_per_hour_vet,
    lateStartMinutes: thresholdsRecord.late_start_minutes,
    earlyEndMinutes: thresholdsRecord.early_end_minutes,
    minHoursWorked: thresholdsRecord.min_hours_worked,
  } : DEFAULT_EFFORT_THRESHOLDS;

  const upsertMutation = useMutation({
    mutationFn: async (updates: Partial<EffortThresholds>) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const record = {
        team_id: teamId || null,
        mgmt_group_id: mgmtGroupId || null,
        created_by: userData.user.id,
        doors_per_hour_rookie: updates.doorsPerHourRookie ?? thresholds.doorsPerHourRookie,
        doors_per_hour_vet: updates.doorsPerHourVet ?? thresholds.doorsPerHourVet,
        late_start_minutes: updates.lateStartMinutes ?? thresholds.lateStartMinutes,
        early_end_minutes: updates.earlyEndMinutes ?? thresholds.earlyEndMinutes,
        min_hours_worked: updates.minHoursWorked ?? thresholds.minHoursWorked,
      };

      if (thresholdsRecord?.id) {
        // Update existing
        const { error } = await supabase
          .from('effort_thresholds')
          .update(record)
          .eq('id', thresholdsRecord.id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('effort_thresholds')
          .insert(record);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['effort-thresholds'] });
    },
  });

  const resetToDefaults = useMutation({
    mutationFn: async () => {
      if (thresholdsRecord?.id) {
        const { error } = await supabase
          .from('effort_thresholds')
          .delete()
          .eq('id', thresholdsRecord.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['effort-thresholds'] });
    },
  });

  return {
    thresholds,
    thresholdsRecord,
    isLoading,
    isCustomized: !!thresholdsRecord,
    updateThresholds: upsertMutation.mutateAsync,
    resetToDefaults: resetToDefaults.mutateAsync,
    isUpdating: upsertMutation.isPending || resetToDefaults.isPending,
  };
};
