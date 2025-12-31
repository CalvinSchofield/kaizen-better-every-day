import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Prefetches critical data on app load for a snappy experience.
 * Runs once when the user is authenticated.
 * Uses React Query's persistence layer - data survives app restarts.
 */
export const usePrefetchData = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const prefetchAll = async () => {
      // Get session for authenticated calls
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // PHASE 1: Prefetch local Supabase data (fast, no rate limits)
      await Promise.allSettled([
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
          staleTime: 30 * 60 * 1000, // 30 minutes
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
          staleTime: 15 * 60 * 1000,
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
          staleTime: 15 * 60 * 1000,
        }),

        // Daily entries (last 90 days) for insights and calendar
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
          staleTime: 15 * 60 * 1000,
        }),

        // All daily entries for calendar
        queryClient.prefetchQuery({
          queryKey: ['all-daily-entries'],
          queryFn: async () => {
            const { data } = await supabase
              .from('daily_entries')
              .select('*')
              .eq('user_id', userId)
              .order('entry_date', { ascending: true });
            return data || [];
          },
          staleTime: 15 * 60 * 1000,
        }),

        // Season config for knocking mode
        queryClient.prefetchQuery({
          queryKey: ['season-config'],
          queryFn: async () => {
            const { data } = await supabase
              .from('season_config')
              .select('*')
              .eq('user_id', userId)
              .single();
            return data;
          },
          staleTime: 15 * 60 * 1000,
        }),
      ]);

      console.log('[Prefetch] Local DB data prefetched');

      // PHASE 2: Prefetch edge function data (may have rate limits)
      // These are fired without await so they run in parallel background
      
      // Team access (needed for My Group, Reports)
      queryClient.prefetchQuery({
        queryKey: ['team-access'],
        queryFn: async () => {
          const { data } = await supabase.functions.invoke('fetch-team-access');
          return data;
        },
        staleTime: 15 * 60 * 1000,
      });

      // Blitzes data
      queryClient.prefetchQuery({
        queryKey: ['blitzes'],
        queryFn: async () => {
          const { data } = await supabase.functions.invoke('fetch-blitzes');
          return data?.blitzes || [];
        },
        staleTime: 15 * 60 * 1000,
      });

      // Blitz attendance for different scopes (prefetch team scope as most common)
      queryClient.prefetchQuery({
        queryKey: ['blitz-attendance', 'team'],
        queryFn: async () => {
          const { data } = await supabase.functions.invoke('fetch-blitz-attendance', {
            body: { scope: 'team' },
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          return data;
        },
        staleTime: 15 * 60 * 1000,
      });

      console.log('[Prefetch] Data prefetch initiated');
    };

    prefetchAll();
  }, [userId, queryClient]);
};
