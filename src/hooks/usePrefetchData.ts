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

        // Group recruits - needed for My Group
        queryClient.prefetchQuery({
          queryKey: ['group-recruits'],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-group-recruits');
            return data;
          },
          staleTime: 2 * 60 * 1000, // 2 minutes
        }),

        // Assignable users for current user's context
        queryClient.prefetchQuery({
          queryKey: ['assignable-users', undefined, undefined],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-assignable-users', {
              body: {}
            });
            return data?.assignableUsers || [];
          },
          staleTime: 5 * 60 * 1000, // 5 minutes
        }),

        // Calendar events
        queryClient.prefetchQuery({
          queryKey: ['calendar-events'],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-calendar');
            return data;
          },
          staleTime: 5 * 60 * 1000,
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

        // Daily entries (last 90 days)
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
      ]);

      console.log('[Prefetch] All critical data prefetched');
    };

    prefetchAll();
  }, [userId, queryClient]);
};
