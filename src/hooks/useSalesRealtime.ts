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
          const salesKeys = [
            'activity-summary',
            'cumulative-fp',
            'insights-data',
            'all-daily-entries',
            'daily-entries',
            'my-active-incentives',
            'incentive-progress',
            'my-active-challenges',
            'challenge-progress',
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
