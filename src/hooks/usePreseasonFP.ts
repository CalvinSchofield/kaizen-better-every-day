import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from './useDailyEntry';
import { useCurrentUserId } from './useCurrentUserId';

// Global summer start date - April 12, 2026
const GLOBAL_SUMMER_START = '2026-04-12';

interface PreseasonFPData {
  totalFP: number;
  totalPRMR: number;
  totalEFP: number;
  fundedFP: number;
  fundedPRMR: number;
  fundedEFP: number;
  knockingDays: number;
}

const CACHE_KEY_PREFIX = 'preseason-fp-cache-';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Get cached data for instant loading
const getCachedPreseasonFP = (userId: string): PreseasonFPData | undefined => {
  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      // Use cache if less than 24 hours old
      if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_DURATION_MS) {
        return parsed.data;
      }
    }
  } catch {
    // Ignore cache errors
  }
  return undefined;
};

// Save to cache for instant loading on next visit
const setCachedPreseasonFP = (userId: string, data: PreseasonFPData): void => {
  try {
    localStorage.setItem(`${CACHE_KEY_PREFIX}${userId}`, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch {
    // Ignore cache errors (e.g., storage full)
  }
};

export const usePreseasonFP = () => {
  // Get user ID reliably to prevent race conditions
  const { userId, isReady: authReady } = useCurrentUserId();

  // Get initial data from cache for instant display
  const initialData = userId ? getCachedPreseasonFP(userId) : undefined;

  const { data, isLoading } = useQuery({
    // Include userId in query key to prevent caching 0 values for wrong user
    queryKey: ['preseason-fp-total', userId],
    // Only run query when we have a valid user ID
    enabled: authReady && !!userId,
    queryFn: async () => {
      if (!userId) return { totalFP: 0, totalPRMR: 0, totalEFP: 0, knockingDays: 0, fundedFP: 0, fundedPRMR: 0, fundedEFP: 0 };

      // Query all finalized entries before summer start date
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('fp_plus, prmr, upgrade_prmr, sales_log, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', userId)
        .eq('is_finalized', true)
        .lt('entry_date', GLOBAL_SUMMER_START);

      if (error) {
        console.error('Error fetching preseason FP:', error);
        return { totalFP: 0, totalPRMR: 0, totalEFP: 0, knockingDays: 0, fundedFP: 0, fundedPRMR: 0, fundedEFP: 0 };
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
        
        // If entry has sales_log, calculate from all sales (excluding never_installed)
        if (salesLog && Array.isArray(salesLog) && salesLog.length > 0) {
          // ALL sales count toward goals EXCEPT never_installed (those never hit the books)
          const allSales = salesLog.filter(s => s.install_status !== 'never_installed');
          const fpSales = allSales.filter(s => s.type === 'fp');
          const upgradeSales = allSales.filter(s => s.type === 'upgrade');
          
          const fpCount = fpSales.length;
          const upgradePrmrTotal = upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          const totalSalesPrmr = allSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
          
          totalFP += fpCount + (upgradePrmrTotal / 85);
          totalPRMR += totalSalesPrmr;
          
          // Only FUNDED sales count toward actual income (exclude cancelled AND never_installed)
          const fundedSales = salesLog.filter(s => s.install_status !== 'cancelled' && s.install_status !== 'never_installed');
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
      
      const result: PreseasonFPData = {
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

      // Cache the result for instant loading on next visit
      setCachedPreseasonFP(userId, result);

      return result;
    },
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
    gcTime: 1000 * 60 * 10, // Keep in garbage collection for 10 minutes
    // Use cached data as initial data for instant display
    initialData,
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
    isLoading: isLoading || !authReady
  };
};
