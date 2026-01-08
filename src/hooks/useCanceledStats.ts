import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from './useDailyEntry';

interface CanceledStats {
  canceledFpCount: number;
  canceledUpgradeCount: number;
  canceledFpPlus: number;
  canceledPrmr: number;
  canceledEfp: number;
  totalCanceledCount: number;
}

export const useCanceledStats = (startDate?: string, endDate?: string) => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['canceled-stats', startDate, endDate],
    queryFn: async (): Promise<CanceledStats> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          canceledFpCount: 0,
          canceledUpgradeCount: 0,
          canceledFpPlus: 0,
          canceledPrmr: 0,
          canceledEfp: 0,
          totalCanceledCount: 0,
        };
      }

      // Build query for entries with sales_log
      let query = supabase
        .from('daily_entries')
        .select('sales_log, entry_date')
        .eq('user_id', user.id)
        .not('sales_log', 'is', null);

      // Apply date filters if provided
      if (startDate) {
        query = query.gte('entry_date', startDate);
      }
      if (endDate) {
        query = query.lte('entry_date', endDate);
      }

      const { data: entries, error } = await query;

      if (error) {
        console.error('Error fetching canceled stats:', error);
        return {
          canceledFpCount: 0,
          canceledUpgradeCount: 0,
          canceledFpPlus: 0,
          canceledPrmr: 0,
          canceledEfp: 0,
          totalCanceledCount: 0,
        };
      }

      // Calculate canceled stats from sales_log
      let canceledFpCount = 0;
      let canceledUpgradeCount = 0;
      let canceledPrmr = 0;

      entries?.forEach(entry => {
        const salesLog = entry.sales_log as unknown as Sale[] | null;
        if (salesLog && Array.isArray(salesLog)) {
          salesLog.forEach(sale => {
            if (sale.install_status === 'cancelled') {
              if (sale.type === 'fp') {
                canceledFpCount += 1;
              } else if (sale.type === 'upgrade') {
                canceledUpgradeCount += 1;
              }
              canceledPrmr += sale.prmr || 0;
            }
          });
        }
      });

      // Calculate derived values
      const canceledUpgradePrmr = entries?.reduce((sum, entry) => {
        const salesLog = entry.sales_log as unknown as Sale[] | null;
        if (!salesLog || !Array.isArray(salesLog)) return sum;
        return sum + salesLog
          .filter(s => s.install_status === 'cancelled' && s.type === 'upgrade')
          .reduce((s, sale) => s + (sale.prmr || 0), 0);
      }, 0) || 0;

      const canceledFpPlus = canceledFpCount + (canceledUpgradePrmr / 85);
      const canceledEfp = canceledPrmr / 85;

      return {
        canceledFpCount,
        canceledUpgradeCount,
        canceledFpPlus: Math.round(canceledFpPlus * 100) / 100,
        canceledPrmr: Math.round(canceledPrmr * 100) / 100,
        canceledEfp: Math.round(canceledEfp * 100) / 100,
        totalCanceledCount: canceledFpCount + canceledUpgradeCount,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    stats: data || {
      canceledFpCount: 0,
      canceledUpgradeCount: 0,
      canceledFpPlus: 0,
      canceledPrmr: 0,
      canceledEfp: 0,
      totalCanceledCount: 0,
    },
    isLoading,
    refetch,
  };
};

// Get YTD canceled stats (from start of 2026 Sales Season - Sept 28, 2025)
export const useYTDCanceledStats = () => {
  const seasonStart = '2025-09-28';
  return useCanceledStats(seasonStart);
};

// Get preseason canceled stats
export const usePreseasonCanceledStats = () => {
  // Preseason: Sept 28, 2025 - April 11, 2026
  return useCanceledStats('2025-09-28', '2026-04-11');
};
