import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invalidateAllSalesQueries } from '@/utils/invalidateSalesQueries';

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
          invalidateAllSalesQueries(queryClient);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
