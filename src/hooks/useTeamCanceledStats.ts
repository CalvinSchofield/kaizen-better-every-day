import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Sale {
  id: string;
  type: 'fp' | 'upgrade';
  prmr: number;
  install_status?: 'pending' | 'installed' | 'cancelled';
}

interface RepCanceledStats {
  userId: string;
  name: string;
  year: string;
  teamName: string;
  mgmtGroupName: string;
  canceledFpCount: number;
  canceledUpgradeCount: number;
  canceledPrmr: number;
  canceledEfp: number;
  totalFpCount: number;
  totalUpgradeCount: number;
  totalPrmr: number;
  cancelRate: number; // percentage of sales that were cancelled
}

interface TeamCanceledStats {
  reps: RepCanceledStats[];
  totals: {
    canceledFpCount: number;
    canceledUpgradeCount: number;
    canceledPrmr: number;
    canceledEfp: number;
    totalFpCount: number;
    totalUpgradeCount: number;
    totalPrmr: number;
    cancelRate: number;
  };
}

interface UseTeamCanceledStatsParams {
  userIds: string[];
  excludeUserIds?: string[];
  startDate?: string;
  endDate?: string;
}

export const useTeamCanceledStats = ({ 
  userIds, 
  excludeUserIds = [],
  startDate,
  endDate 
}: UseTeamCanceledStatsParams) => {
  return useQuery({
    queryKey: ['team-canceled-stats', userIds, excludeUserIds, startDate, endDate],
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: userIds.length > 0,
    queryFn: async (): Promise<TeamCanceledStats> => {
      const filteredUserIds = userIds.filter(id => !excludeUserIds.includes(id));
      
      if (filteredUserIds.length === 0) {
        return {
          reps: [],
          totals: {
            canceledFpCount: 0,
            canceledUpgradeCount: 0,
            canceledPrmr: 0,
            canceledEfp: 0,
            totalFpCount: 0,
            totalUpgradeCount: 0,
            totalPrmr: 0,
            cancelRate: 0,
          },
        };
      }

      // Fetch daily entries with sales_log
      let query = supabase
        .from('daily_entries')
        .select('user_id, sales_log, entry_date')
        .in('user_id', filteredUserIds)
        .not('sales_log', 'is', null);

      if (startDate) {
        query = query.gte('entry_date', startDate);
      }
      if (endDate) {
        query = query.lte('entry_date', endDate);
      }

      const { data: entries, error: entriesError } = await query;
      if (entriesError) throw entriesError;

      // Fetch rep info
      const { data: repsData, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name, year')
        .in('user_id', filteredUserIds);

      if (repsError) throw repsError;

      // Create rep lookup map
      const repMap = new Map(repsData?.map(r => [r.user_id, r]) || []);

      // Calculate stats per rep
      const repStatsMap = new Map<string, {
        canceledFpCount: number;
        canceledUpgradeCount: number;
        canceledPrmr: number;
        totalFpCount: number;
        totalUpgradeCount: number;
        totalPrmr: number;
      }>();

      entries?.forEach(entry => {
        const salesLog = entry.sales_log as unknown as Sale[] | null;
        if (!salesLog || !Array.isArray(salesLog)) return;

        const existing = repStatsMap.get(entry.user_id) || {
          canceledFpCount: 0,
          canceledUpgradeCount: 0,
          canceledPrmr: 0,
          totalFpCount: 0,
          totalUpgradeCount: 0,
          totalPrmr: 0,
        };

        salesLog.forEach(sale => {
          const prmr = sale.prmr || 0;
          
          if (sale.type === 'fp') {
            existing.totalFpCount += 1;
            existing.totalPrmr += prmr;
            if (sale.install_status === 'cancelled') {
              existing.canceledFpCount += 1;
              existing.canceledPrmr += prmr;
            }
          } else if (sale.type === 'upgrade') {
            existing.totalUpgradeCount += 1;
            existing.totalPrmr += prmr;
            if (sale.install_status === 'cancelled') {
              existing.canceledUpgradeCount += 1;
              existing.canceledPrmr += prmr;
            }
          }
        });

        repStatsMap.set(entry.user_id, existing);
      });

      // Build rep stats array
      const reps: RepCanceledStats[] = [];
      repStatsMap.forEach((stats, userId) => {
        const repInfo = repMap.get(userId);
        if (!repInfo) return;

        const totalSales = stats.totalFpCount + stats.totalUpgradeCount;
        const canceledSales = stats.canceledFpCount + stats.canceledUpgradeCount;
        const cancelRate = totalSales > 0 ? (canceledSales / totalSales) * 100 : 0;

        reps.push({
          userId,
          name: repInfo.name || 'Unknown',
          year: repInfo.year || 'unknown',
          teamName: '', // Would need Notion fetch for this
          mgmtGroupName: '',
          canceledFpCount: stats.canceledFpCount,
          canceledUpgradeCount: stats.canceledUpgradeCount,
          canceledPrmr: stats.canceledPrmr,
          canceledEfp: Math.round((stats.canceledPrmr / 85) * 100) / 100,
          totalFpCount: stats.totalFpCount,
          totalUpgradeCount: stats.totalUpgradeCount,
          totalPrmr: stats.totalPrmr,
          cancelRate: Math.round(cancelRate * 10) / 10,
        });
      });

      // Sort by cancel rate descending (highest cancel rate first)
      reps.sort((a, b) => b.cancelRate - a.cancelRate);

      // Calculate totals
      const totals = reps.reduce((acc, rep) => {
        acc.canceledFpCount += rep.canceledFpCount;
        acc.canceledUpgradeCount += rep.canceledUpgradeCount;
        acc.canceledPrmr += rep.canceledPrmr;
        acc.totalFpCount += rep.totalFpCount;
        acc.totalUpgradeCount += rep.totalUpgradeCount;
        acc.totalPrmr += rep.totalPrmr;
        return acc;
      }, {
        canceledFpCount: 0,
        canceledUpgradeCount: 0,
        canceledPrmr: 0,
        canceledEfp: 0,
        totalFpCount: 0,
        totalUpgradeCount: 0,
        totalPrmr: 0,
        cancelRate: 0,
      });

      const totalSales = totals.totalFpCount + totals.totalUpgradeCount;
      const canceledSales = totals.canceledFpCount + totals.canceledUpgradeCount;
      totals.cancelRate = totalSales > 0 ? Math.round((canceledSales / totalSales) * 1000) / 10 : 0;
      totals.canceledEfp = Math.round((totals.canceledPrmr / 85) * 100) / 100;

      return { reps, totals };
    },
  });
};
