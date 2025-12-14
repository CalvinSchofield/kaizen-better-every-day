import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRepData } from './useRepData';

export const useMeVsMe = () => {
  const { repData, loading: repLoading } = useRepData();
  const queryClient = useQueryClient();

  // Check if Me vs Me is enabled for this user
  // @ts-ignore - me_vs_me_enabled is added via migration but not in types yet
  const isEnabled = (repData as any)?.me_vs_me_enabled ?? false;

  // Toggle Me vs Me enabled status
  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('reps')
        .update({ me_vs_me_enabled: enabled })
        .eq('user_id', user.id);

      if (error) throw error;
      return enabled;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rep-data'] });
    },
  });

  // Get historical data summary
  const { data: dataSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['historical-data-summary'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get count by year and season type
      const { data, error } = await supabase
        .from('historical_entries')
        .select('season_year, season_type, original_date')
        .eq('user_id', user.id)
        .order('original_date', { ascending: true });

      if (error) {
        console.error('Error fetching historical data summary:', error);
        return null;
      }

      if (!data || data.length === 0) return null;

      // Group by year
      const byYear: Record<number, { count: number; seasons: Set<string>; earliest: string; latest: string }> = {};
      
      data.forEach(entry => {
        if (!byYear[entry.season_year]) {
          byYear[entry.season_year] = {
            count: 0,
            seasons: new Set(),
            earliest: entry.original_date,
            latest: entry.original_date,
          };
        }
        byYear[entry.season_year].count++;
        byYear[entry.season_year].seasons.add(entry.season_type);
        if (entry.original_date < byYear[entry.season_year].earliest) {
          byYear[entry.season_year].earliest = entry.original_date;
        }
        if (entry.original_date > byYear[entry.season_year].latest) {
          byYear[entry.season_year].latest = entry.original_date;
        }
      });

      return {
        totalDays: data.length,
        years: Object.entries(byYear).map(([year, info]) => ({
          year: parseInt(year),
          days: info.count,
          seasons: Array.from(info.seasons),
          dateRange: `${info.earliest} to ${info.latest}`,
        })),
      };
    },
    enabled: !repLoading,
    staleTime: 5 * 60 * 1000,
  });

  // Delete all historical data
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('historical_entries')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historical-data-summary'] });
      queryClient.invalidateQueries({ queryKey: ['historical-entries'] });
      queryClient.invalidateQueries({ queryKey: ['historical-cumulative'] });
      queryClient.invalidateQueries({ queryKey: ['has-historical-data'] });
    },
  });

  return {
    isEnabled,
    isLoading: repLoading || summaryLoading,
    dataSummary,
    toggleEnabled: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
    deleteAllData: deleteAllMutation.mutate,
    isDeleting: deleteAllMutation.isPending,
  };
};
