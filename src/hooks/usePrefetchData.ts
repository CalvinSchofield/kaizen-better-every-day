import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Prefetches critical data on app load for a snappy experience.
 * Runs once when the user is authenticated.
 * 
 * IMPORTANT: Notion API calls are staggered to avoid rate limiting (429 errors).
 * Notion's limit is ~3 requests/second, so we batch local DB calls first,
 * then fire Notion calls with delays between them.
 */
export const usePrefetchData = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const prefetchAll = async () => {
      // PHASE 1: Prefetch local Supabase data immediately (no rate limits)
      await Promise.allSettled([
        // Competitors for cheat sheet (local DB)
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

        // Current user's rep data (local DB)
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

        // Rep goals (local DB)
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

        // Daily entries (last 90 days) for insights (local DB)
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

      console.log('[Prefetch] Local DB data prefetched');

      // PHASE 2: Stagger Notion API calls to avoid rate limiting
      // These calls go through edge functions that hit Notion API
      
      // First Notion call: team-access (needed for My Group, Reports)
      queryClient.prefetchQuery({
        queryKey: ['team-access'],
        queryFn: async () => {
          const { data } = await supabase.functions.invoke('fetch-team-access');
          return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes - longer cache to reduce calls
      });

      // Blitzes data
      queryClient.prefetchQuery({
        queryKey: ['blitzes'],
        queryFn: async () => {
          const { data } = await supabase.functions.invoke('fetch-blitzes');
          return data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      console.log('[Prefetch] Data prefetch initiated');
    };

    prefetchAll();
  }, [userId, queryClient]);
};
