import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from './useDailyEntry';

// Global summer start date - April 12, 2026
const GLOBAL_SUMMER_START = '2026-04-12';

export const usePreseasonFP = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['preseason-fp-total'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { totalFP: 0, totalPRMR: 0 };

      // Query all finalized entries before summer start date
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('fp_plus, prmr, sales_log')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .lt('entry_date', GLOBAL_SUMMER_START);

      if (error) {
        console.error('Error fetching preseason FP:', error);
        return { totalFP: 0, totalPRMR: 0 };
      }

      // Calculate totals, excluding cancelled sales
      let totalFP = 0;
      let totalPRMR = 0;

      entries?.forEach(entry => {
        const salesLog = entry.sales_log as unknown as Sale[] | null;
        
        // If entry has sales_log, calculate from funded sales only
        if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
          const fundedSales = salesLog.filter(s => s.install_status !== 'cancelled');
          const fpSales = fundedSales.filter(s => s.type === 'fp');
          const upgradeSales = fundedSales.filter(s => s.type === 'upgrade');
          
          const fpCount = fpSales.length;
          const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          const totalSalesPrmr = fundedSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          
          totalFP += fpCount + (upgradePrmrTotal / 85);
          totalPRMR += totalSalesPrmr;
        } else {
          // Fallback to entry-level values for legacy entries without sales_log
          totalFP += entry.fp_plus || 0;
          totalPRMR += entry.prmr || 0;
        }
      });
      
      return {
        totalFP: Math.round(totalFP * 10) / 10,
        totalPRMR: Math.round(totalPRMR * 100) / 100,
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return { 
    totalFP: data?.totalFP ?? 0, 
    totalPRMR: data?.totalPRMR ?? 0,
    isLoading 
  };
};
