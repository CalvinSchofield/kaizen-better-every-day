import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Centralized realtime subscription for sales data changes.
 * Subscribes to daily_entries changes and invalidates all sales-dependent queries.
 * Use this hook on pages that display sales data (Home, Insights, Compete).
 */
export const useSalesRealtime = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('sales-realtime-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'daily_entries',
        },
        () => {
          // CRITICAL: Invalidate ALL sales-dependent queries with refetchType: 'all'
          // This ensures even unmounted queries get invalidated
          // MUST match the keys in useSaleUpdate.ts for consistency
          const salesKeys = [
            'daily-entry', // CRITICAL for multi-device Track sync
            'all-daily-entries',
            'daily-entries',
            'activity-summary',
            'cumulative-fp',
            'insights-data',
            'customer-sales', // For Customers page
            // Competitions - CRITICAL: Challenge/incentive progress must sync with sales changes
            'my-active-incentives',
            'incentive-progress',
            'my-active-challenges',
            'challenge-progress', // CRITICAL: Must match leaderboard updates
            // Goals
            'rep-goals',
            // Leaderboards - ALL variants
            'today-leaderboard',
            'yesterday-leaderboard',
            'weekly-leaderboard',
            'monthly-leaderboard',
            'season-leaderboard',
            'ytd-leaderboard',
            'expanded-leaderboard',
          ];

          salesKeys.forEach((key) => {
            queryClient.invalidateQueries({ queryKey: [key], refetchType: 'all' });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
