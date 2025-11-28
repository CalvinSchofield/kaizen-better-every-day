import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const GLOBAL_SUMMER_START = new Date('2026-04-12');
const GLOBAL_SUMMER_END = new Date('2026-09-27');

interface SeasonConfig {
  id: string;
  user_id: string;
  knocking_mode_enabled: boolean | null;
  personal_summer_start: string | null;
  personal_summer_end: string | null;
}

export const useAppMode = () => {
  const queryClient = useQueryClient();

  // Fetch season config
  const { data: seasonConfig, isLoading } = useQuery({
    queryKey: ['season-config'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('season_config')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data as SeasonConfig | null;
    },
  });

  // Calculate if knocking mode should be active
  const isKnockingMode = useMemo(() => {
    // Manual override takes precedence
    if (seasonConfig?.knocking_mode_enabled !== null && seasonConfig?.knocking_mode_enabled !== undefined) {
      return seasonConfig.knocking_mode_enabled;
    }

    // Auto-detect based on dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const effectiveStart = seasonConfig?.personal_summer_start
      ? new Date(seasonConfig.personal_summer_start)
      : GLOBAL_SUMMER_START;

    const effectiveEnd = seasonConfig?.personal_summer_end
      ? new Date(seasonConfig.personal_summer_end)
      : GLOBAL_SUMMER_END;

    return today >= effectiveStart && today <= effectiveEnd;
  }, [seasonConfig]);

  // Toggle knocking mode
  const toggleModeMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('season_config')
        .upsert({
          user_id: user.id,
          knocking_mode_enabled: enabled,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['season-config'] });
    },
  });

  return {
    isKnockingMode,
    seasonConfig,
    isLoading,
    toggleMode: toggleModeMutation.mutate,
    isToggling: toggleModeMutation.isPending,
  };
};