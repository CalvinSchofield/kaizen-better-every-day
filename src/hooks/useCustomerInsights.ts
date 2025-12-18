import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from '@/components/LogSaleSheet';
import { isWithinInterval, parseISO, differenceInDays } from 'date-fns';

interface SaleWithDate extends Sale {
  entry_date: string;
}

export interface CustomerInsightsData {
  // Economics
  avgPrmrPerFp: number;
  avgPrmrPerUpgrade: number;
  avgMoneySpent: number;
  prmrToCostRatio: number;
  totalPrmr: number;
  totalMoneySpent: number;
  
  // Economics by Deal Type (Fresh, Takeover, DIY)
  spendByDealType: { fresh: number; takeover: number; diy: number };
  prmrTotalByDealType: { fresh: number; takeover: number; diy: number };
  
  // Economics by Sale Type (FP vs Upgrade)
  spendBySaleType: { fp: number; upgrade: number };
  prmrTotalBySaleType: { fp: number; upgrade: number };
  
  // Time to Sell
  avgTimeToSell: number;
  avgTimeByDealType: { fresh: number; takeover: number; diy: number };
  avgTimeByDifficulty: { easy: number; medium: number; hard: number };
  fastestSale: { name: string; minutes: number; prmr: number } | null;
  slowestSale: { name: string; minutes: number; prmr: number } | null;
  
  // Deal Type Distribution
  dealTypeDistribution: { fresh: number; takeover: number; diy: number };
  prmrByDealType: { fresh: number; takeover: number; diy: number };
  difficultyDistribution: { easy: number; medium: number; hard: number };
  
  // Install Performance
  sameDayInstallRate: number;
  cancelRate: number;
  avgDaysToInstall: number;
  
  // Counts
  totalDeals: number;
  totalFpDeals: number;
  totalUpgradeDeals: number;
  dealsWithTimeData: number;
  salesWithLocationCount: number;
  dealsWithCrmData: number;
  
  // Has data flags
  hasTimeData: boolean;
  hasDealTypeData: boolean;
  hasMoneySpentData: boolean;
  hasInstallData: boolean;
}

export const useCustomerInsights = (dateRange: { start: Date; end: Date }) => {
  // Fetch ALL sales (not just CRM-enriched ones) for complete metrics
  const { data: allSales = [], isLoading } = useQuery({
    queryKey: ['all-sales-for-insights', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, sales_log')
        .eq('user_id', user.id)
        .not('sales_log', 'is', null)
        .order('entry_date', { ascending: false });

      if (error) throw error;

      // Flatten ALL sales from all entries
      const sales: SaleWithDate[] = [];
      for (const entry of data || []) {
        const salesLog = entry.sales_log as unknown as Sale[] | null;
        if (salesLog && Array.isArray(salesLog)) {
          for (const sale of salesLog) {
            // Include ALL sales, not just CRM-enriched ones
            if (sale.prmr !== undefined) {
              sales.push({
                ...sale,
                entry_date: entry.entry_date,
              });
            }
          }
        }
      }

      return sales;
    },
    staleTime: 2 * 60 * 1000,
  });

  const insights = useMemo<CustomerInsightsData | null>(() => {
    if (!allSales || allSales.length === 0) return null;

    // Filter sales by date range
    const filteredSales = allSales.filter(sale => {
      const saleDate = parseISO(sale.entry_date);
      return isWithinInterval(saleDate, { start: dateRange.start, end: dateRange.end });
    });

    if (filteredSales.length === 0) return null;

    // Separate by type
    const fpSales = filteredSales.filter(s => s.type === 'fp');
    const upgradeSales = filteredSales.filter(s => s.type === 'upgrade');

    // Economics - based on ALL sales
    const totalPrmr = filteredSales.reduce((sum, s) => sum + (s.prmr || 0), 0);
    const totalMoneySpent = filteredSales.reduce((sum, s) => sum + (s.money_spent || 0), 0);
    const salesWithMoney = filteredSales.filter(s => s.money_spent && s.money_spent > 0);
    
    const avgPrmrPerFp = fpSales.length > 0 
      ? fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0) / fpSales.length 
      : 0;
    const avgPrmrPerUpgrade = upgradeSales.length > 0 
      ? upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0) / upgradeSales.length 
      : 0;
    const avgMoneySpent = salesWithMoney.length > 0 
      ? totalMoneySpent / salesWithMoney.length 
      : 0;
    const prmrToCostRatio = totalMoneySpent > 0 ? totalPrmr / totalMoneySpent : 0;

    // Time to Sell - only for sales that have time data
    const salesWithTime = filteredSales.filter(s => s.time_to_sell_minutes && s.time_to_sell_minutes > 0);
    const avgTimeToSell = salesWithTime.length > 0 
      ? salesWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / salesWithTime.length 
      : 0;

    // Time by deal type
    const freshWithTime = salesWithTime.filter(s => s.deal_type === 'fresh');
    const takeoverWithTime = salesWithTime.filter(s => s.deal_type === 'takeover');
    const diyWithTime = salesWithTime.filter(s => s.deal_type === 'diy');

    const avgTimeByDealType = {
      fresh: freshWithTime.length > 0 
        ? freshWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / freshWithTime.length 
        : 0,
      takeover: takeoverWithTime.length > 0 
        ? takeoverWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / takeoverWithTime.length 
        : 0,
      diy: diyWithTime.length > 0 
        ? diyWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / diyWithTime.length 
        : 0,
    };

    // Time by difficulty
    const easyWithTime = salesWithTime.filter(s => s.difficulty === 'easy');
    const mediumWithTime = salesWithTime.filter(s => s.difficulty === 'medium');
    const hardWithTime = salesWithTime.filter(s => s.difficulty === 'hard');

    const avgTimeByDifficulty = {
      easy: easyWithTime.length > 0 
        ? easyWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / easyWithTime.length 
        : 0,
      medium: mediumWithTime.length > 0 
        ? mediumWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / mediumWithTime.length 
        : 0,
      hard: hardWithTime.length > 0 
        ? hardWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / hardWithTime.length 
        : 0,
    };

    // Fastest/Slowest sale
    let fastestSale: CustomerInsightsData['fastestSale'] = null;
    let slowestSale: CustomerInsightsData['slowestSale'] = null;
    
    if (salesWithTime.length > 0) {
      const sorted = [...salesWithTime].sort((a, b) => (a.time_to_sell_minutes || 0) - (b.time_to_sell_minutes || 0));
      const fastest = sorted[0];
      const slowest = sorted[sorted.length - 1];
      
      fastestSale = {
        name: fastest.customer_name || 'Sale',
        minutes: fastest.time_to_sell_minutes || 0,
        prmr: fastest.prmr || 0,
      };
      slowestSale = {
        name: slowest.customer_name || 'Sale',
        minutes: slowest.time_to_sell_minutes || 0,
        prmr: slowest.prmr || 0,
      };
    }

    // Deal Type Distribution - only for sales with deal_type set
    const salesWithDealType = filteredSales.filter(s => s.deal_type);
    const dealTypeDistribution = {
      fresh: salesWithDealType.filter(s => s.deal_type === 'fresh').length,
      takeover: salesWithDealType.filter(s => s.deal_type === 'takeover').length,
      diy: salesWithDealType.filter(s => s.deal_type === 'diy').length,
    };

    // PRMR by deal type (average)
    const prmrByDealType = {
      fresh: dealTypeDistribution.fresh > 0 
        ? salesWithDealType.filter(s => s.deal_type === 'fresh').reduce((sum, s) => sum + (s.prmr || 0), 0) / dealTypeDistribution.fresh
        : 0,
      takeover: dealTypeDistribution.takeover > 0
        ? salesWithDealType.filter(s => s.deal_type === 'takeover').reduce((sum, s) => sum + (s.prmr || 0), 0) / dealTypeDistribution.takeover
        : 0,
      diy: dealTypeDistribution.diy > 0
        ? salesWithDealType.filter(s => s.deal_type === 'diy').reduce((sum, s) => sum + (s.prmr || 0), 0) / dealTypeDistribution.diy
        : 0,
    };

    // Spend and PRMR totals by deal type (for ROI calculation)
    const spendByDealType = {
      fresh: salesWithDealType.filter(s => s.deal_type === 'fresh').reduce((sum, s) => sum + (s.money_spent || 0), 0),
      takeover: salesWithDealType.filter(s => s.deal_type === 'takeover').reduce((sum, s) => sum + (s.money_spent || 0), 0),
      diy: salesWithDealType.filter(s => s.deal_type === 'diy').reduce((sum, s) => sum + (s.money_spent || 0), 0),
    };

    const prmrTotalByDealType = {
      fresh: salesWithDealType.filter(s => s.deal_type === 'fresh').reduce((sum, s) => sum + (s.prmr || 0), 0),
      takeover: salesWithDealType.filter(s => s.deal_type === 'takeover').reduce((sum, s) => sum + (s.prmr || 0), 0),
      diy: salesWithDealType.filter(s => s.deal_type === 'diy').reduce((sum, s) => sum + (s.prmr || 0), 0),
    };

    // Spend and PRMR totals by sale type (FP vs Upgrade)
    const spendBySaleType = {
      fp: fpSales.reduce((sum, s) => sum + (s.money_spent || 0), 0),
      upgrade: upgradeSales.reduce((sum, s) => sum + (s.money_spent || 0), 0),
    };

    const prmrTotalBySaleType = {
      fp: fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0),
      upgrade: upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0),
    };

    // Difficulty Distribution
    const salesWithDifficulty = filteredSales.filter(s => s.difficulty);
    const difficultyDistribution = {
      easy: salesWithDifficulty.filter(s => s.difficulty === 'easy').length,
      medium: salesWithDifficulty.filter(s => s.difficulty === 'medium').length,
      hard: salesWithDifficulty.filter(s => s.difficulty === 'hard').length,
    };

    // Install Performance
    const salesWithInstallInfo = filteredSales.filter(s => s.install_status !== undefined || s.installed_same_day !== undefined);
    const installedSameDayCount = filteredSales.filter(s => s.installed_same_day === true).length;
    const cancelledCount = filteredSales.filter(s => s.install_status === 'cancelled').length;
    
    const salesWithScheduledInstall = filteredSales.filter(s => s.scheduled_install_date && s.entry_date);
    let avgDaysToInstall = 0;
    if (salesWithScheduledInstall.length > 0) {
      const totalDays = salesWithScheduledInstall.reduce((sum, s) => {
        const saleDate = parseISO(s.entry_date);
        const installDate = parseISO(s.scheduled_install_date!);
        return sum + Math.max(0, differenceInDays(installDate, saleDate));
      }, 0);
      avgDaysToInstall = totalDays / salesWithScheduledInstall.length;
    }

    const sameDayInstallRate = salesWithInstallInfo.length > 0 
      ? (installedSameDayCount / salesWithInstallInfo.length) * 100 
      : 0;
    const cancelRate = filteredSales.length > 0 
      ? (cancelledCount / filteredSales.length) * 100 
      : 0;

    // Location
    const salesWithLocationCount = filteredSales.filter(s => s.customer_lat && s.customer_lng).length;
    
    // CRM data count
    const dealsWithCrmData = filteredSales.filter(s => s.customer_name || s.account_number || s.customer_phone).length;

    return {
      avgPrmrPerFp,
      avgPrmrPerUpgrade,
      avgMoneySpent,
      prmrToCostRatio,
      totalPrmr,
      totalMoneySpent,
      spendByDealType,
      prmrTotalByDealType,
      spendBySaleType,
      prmrTotalBySaleType,
      avgTimeToSell,
      avgTimeByDealType,
      avgTimeByDifficulty,
      fastestSale,
      slowestSale,
      dealTypeDistribution,
      prmrByDealType,
      difficultyDistribution,
      sameDayInstallRate,
      cancelRate,
      avgDaysToInstall,
      totalDeals: filteredSales.length,
      totalFpDeals: fpSales.length,
      totalUpgradeDeals: upgradeSales.length,
      dealsWithTimeData: salesWithTime.length,
      salesWithLocationCount,
      dealsWithCrmData,
      hasTimeData: salesWithTime.length > 0,
      hasDealTypeData: salesWithDealType.length > 0,
      hasMoneySpentData: salesWithMoney.length > 0,
      hasInstallData: salesWithInstallInfo.length > 0,
    };
  }, [allSales, dateRange]);

  return { insights, isLoading };
};
