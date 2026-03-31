import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSessionSafe } from "@/utils/authSession";

/**
 * Prefetches critical data on app load for a snappy experience.
 * Runs once when the user is authenticated.
 * Uses React Query's persistence layer - data survives app restarts.
 * 
 * PERF FIX: Staggers prefetches to avoid saturating mobile connections on cold launch.
 * Phase 1 (immediate): Only the 3 most critical queries for initial render.
 * Phase 2 (500ms delay): Background data that's nice to have cached.
 * Phase 3 (1.5s delay): Edge function calls that are slower and can wait.
 */
export const usePrefetchData = (userId: string | undefined) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;

    const prefetchAll = async () => {
      // PERF FIX: Use getSession() (local cache) instead of getSession() network call.
      // Auth is already verified by HydrationGate, so we just need the token.
      const { session } = await getSessionSafe();
      if (!session) return;

      // PHASE 1: Critical data for initial render (immediate)
      // Includes team-access because it gates leader UI elements
      await Promise.allSettled([
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

        // Rep goals for Goals page instant load
        queryClient.prefetchQuery({
          queryKey: ['rep-goals', userId],
          queryFn: async () => {
            const { data } = await supabase
              .from('rep_goals')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();
            return data;
          },
          staleTime: 15 * 60 * 1000,
        }),

        // Team access (gates leader UI — moved from Phase 3 for native perf)
        queryClient.prefetchQuery({
          queryKey: ['team-access'],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-team-access');
            return data;
          },
          staleTime: 15 * 60 * 1000,
        }),
      ]);

      console.log('[Prefetch] Phase 1 complete (critical data + team access)');

      // PHASE 2: Secondary data (500ms delay to let UI render first)
      setTimeout(async () => {
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
            staleTime: 30 * 60 * 1000,
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
        ]);

        console.log('[Prefetch] Phase 2 complete (secondary data)');
      }, 500);

      // PHASE 3: Remaining edge function calls (1.5s delay - these are slower and shouldn't block)
      setTimeout(() => {
        // Blitzes data
        queryClient.prefetchQuery({
          queryKey: ['blitzes'],
          queryFn: async () => {
            const { data } = await supabase.functions.invoke('fetch-blitzes');
            return data?.blitzes || [];
          },
          staleTime: 15 * 60 * 1000,
        });

        // Blitz attendance for team scope
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

        console.log('[Prefetch] Phase 3 initiated (blitzes)');
      }, 1500);
    };

    prefetchAll();
  }, [userId, queryClient]);
};
