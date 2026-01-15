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
          // Invalidate all sales-dependent queries with refetchType: 'all'
          // This ensures even unmounted queries get invalidated
          // CRITICAL: Include 'daily-entry' for multi-device Track sync
          // CRITICAL: Include ALL queries that depend on daily_entries data
          // Both leaderboard and challenge progress must stay in sync
          const salesKeys = [
            'daily-entry', // CRITICAL for multi-device Track sync
            'activity-summary',
            'cumulative-fp',
            'insights-data',
            'all-daily-entries',
            'daily-entries',
            'customer-sales', // For Customers page
            'my-active-incentives',
            'incentive-progress',
            'my-active-challenges',
            'challenge-progress', // CRITICAL: Must match leaderboard updates
            'rep-goals',
            'today-leaderboard',
            'yesterday-leaderboard',
            'weekly-leaderboard',
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
