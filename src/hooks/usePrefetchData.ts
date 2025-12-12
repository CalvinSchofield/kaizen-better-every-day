import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Prefetches critical data on app load for a snappy experience.
 * Runs once when the user is authenticated.
 */
export const usePrefetchData = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const prefetchAll = async () => {
      // Prefetch all data in parallel for maximum speed
      await Promise.allSettled([
        // Team access - needed for My Group, Reports
        queryClient.prefetchQuery({
          queryKey: ['team-access'],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-team-access');
            return data;
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
        }),

        // Competitors for cheat sheet
        queryClient.prefetchQuery({
          queryKey: ['competitors'],
          queryFn: async () => {
            const { data } = await supabase
              .from('competitors')
              .select('*')
              .order('name');
            return data || [];
          },
          staleTime: 10 * 60 * 1000, // 10 minutes
        }),

        // Current user's rep data
        queryClient.prefetchQuery({
          queryKey: ['rep-data', userId],
          queryFn: async () => {
            const { data } = await supabase
              .from('reps')
              .select('*')
              .eq('user_id', userId)
              .single();
            return data;
          },
          staleTime: 2 * 60 * 1000,
        }),

        // Rep goals
        queryClient.prefetchQuery({
          queryKey: ['rep-goals', userId],
          queryFn: async () => {
            const { data } = await supabase
              .from('rep_goals')
              .select('*')
              .eq('user_id', userId)
              .single();
            return data;
          },
          staleTime: 2 * 60 * 1000,
        }),

        // Blitzes for preseason
        queryClient.prefetchQuery({
          queryKey: ['preseason-blitzes'],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-preseason-blitzes');
            return data;
          },
          staleTime: 5 * 60 * 1000,
        }),

        // Daily entries (last 90 days) for insights
        queryClient.prefetchQuery({
          queryKey: ['daily-entries-recent', userId],
          queryFn: async () => {
            const ninetyDaysAgo = new Date();
            ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
            const { data } = await supabase
              .from('daily_entries')
              .select('*')
              .eq('user_id', userId)
              .gte('entry_date', ninetyDaysAgo.toISOString().split('T')[0])
              .order('entry_date', { ascending: false });
            return data || [];
          },
          staleTime: 2 * 60 * 1000,
        }),

        // Team members for reports
        queryClient.prefetchQuery({
          queryKey: ['team-members'],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-team-members');
            return data;
          },
          staleTime: 5 * 60 * 1000,
        }),
      ]);

      console.log('[Prefetch] All critical data prefetched');
    };

    prefetchAll();
  }, [userId, queryClient]);
};
