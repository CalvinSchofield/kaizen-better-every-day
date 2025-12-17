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
      if (!user) return { totalFP: 0, totalPRMR: 0, totalEFP: 0 };

      // Query all finalized entries before summer start date
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('fp_plus, prmr, upgrade_prmr, sales_log, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .lt('entry_date', GLOBAL_SUMMER_START);

      if (error) {
        console.error('Error fetching preseason FP:', error);
        return { totalFP: 0, totalPRMR: 0, totalEFP: 0, knockingDays: 0 };
      }

      // Count knocking days (4+ doors with start and end time)
      const knockingDays = entries?.filter(entry => 
        (entry.doors_knocked || 0) >= 4 && 
        entry.work_start_time && 
        entry.work_end_time
      ).length || 0;

      // Calculate totals
      // IMPORTANT: Unfunded sales (installed but cancelled) still count toward GOAL PROGRESS
      // Only "never installed" sales should be deleted entirely (not in sales_log at all)
      let totalFP = 0;
      let totalPRMR = 0;
      let fundedFP = 0;
      let fundedPRMR = 0;

      entries?.forEach(entry => {
        const salesLog = entry.sales_log as unknown as Sale[] | null;
        
        // If entry has sales_log, calculate from all sales (including unfunded)
        if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
          // ALL sales count toward goals (including unfunded/cancelled after install)
          const allSales = salesLog;
          const fpSales = allSales.filter(s => s.type === 'fp');
          const upgradeSales = allSales.filter(s => s.type === 'upgrade');
          
          const fpCount = fpSales.length;
          const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          const totalSalesPrmr = allSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          
          totalFP += fpCount + (upgradePrmrTotal / 85);
          totalPRMR += totalSalesPrmr;
          
          // Only FUNDED sales count toward actual income
          const fundedSales = allSales.filter(s => s.install_status !== 'cancelled');
          const fundedFpSales = fundedSales.filter(s => s.type === 'fp');
          const fundedUpgradeSales = fundedSales.filter(s => s.type === 'upgrade');
          
          const fundedFpCount = fundedFpSales.length;
          const fundedUpgradePrmrTotal = fundedUpgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          const fundedTotalPrmr = fundedSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          
          fundedFP += fundedFpCount + (fundedUpgradePrmrTotal / 85);
          fundedPRMR += fundedTotalPrmr;
        } else {
          // Fallback to entry-level values for legacy entries without sales_log
          // fp_plus already includes upgrade calculation (FP+ = FP count + upgrade_prmr/85)
          totalFP += entry.fp_plus || 0;
          // IMPORTANT: prmr field IS total PRMR (already includes upgrade_prmr)
          // upgrade_prmr is tracked separately for breakdown purposes only, NOT additive
          totalPRMR += entry.prmr || 0;
          fundedFP += entry.fp_plus || 0;
          fundedPRMR += entry.prmr || 0;
        }
      });
      
      // EFP = Total PRMR / 85
      const totalEFP = totalPRMR / 85;
      const fundedEFP = fundedPRMR / 85;
      
      return {
        // Total = ALL sales (including unfunded) - used for GOAL PROGRESS
        totalFP: Math.round(totalFP * 10) / 10,
        totalPRMR: Math.round(totalPRMR * 100) / 100,
        totalEFP: Math.round(totalEFP * 100) / 100,
        // Funded = Only funded sales - used for INCOME calculations
        fundedFP: Math.round(fundedFP * 10) / 10,
        fundedPRMR: Math.round(fundedPRMR * 100) / 100,
        fundedEFP: Math.round(fundedEFP * 100) / 100,
        // Knocking days count for pace calculations
        knockingDays,
      };
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return { 
    // For goal progress - includes unfunded sales
    totalFP: data?.totalFP ?? 0, 
    totalPRMR: data?.totalPRMR ?? 0,
    totalEFP: data?.totalEFP ?? 0,
    // For income calculations - only funded sales
    fundedFP: data?.fundedFP ?? 0,
    fundedPRMR: data?.fundedPRMR ?? 0,
    fundedEFP: data?.fundedEFP ?? 0,
    // Knocking days for pace calculations
    knockingDays: data?.knockingDays ?? 0,
    isLoading 
  };
};
