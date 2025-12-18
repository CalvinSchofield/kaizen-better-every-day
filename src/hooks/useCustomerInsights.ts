import { useMemo } from 'react';
import { useCustomerData, CustomerSale } from './useCustomerData';
import { isWithinInterval, parseISO, differenceInDays } from 'date-fns';

export interface CustomerInsightsData {
  // Economics
  avgPrmrPerFp: number;
  avgPrmrPerUpgrade: number;
  avgMoneySpent: number;
  prmrToCostRatio: number;
  totalPrmr: number;
  totalMoneySpent: number;
  
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
  dealsWithTimeData: number;
  salesWithLocationCount: number;
  
  // Has data flags
  hasTimeData: boolean;
  hasDealTypeData: boolean;
  hasMoneySpentData: boolean;
  hasInstallData: boolean;
}

export const useCustomerInsights = (dateRange: { start: Date; end: Date }) => {
  const { sales, isLoading } = useCustomerData();

  const insights = useMemo<CustomerInsightsData | null>(() => {
    if (!sales || sales.length === 0) return null;

    // Filter sales by date range
    const filteredSales = sales.filter(sale => {
      const saleDate = parseISO(sale.entry_date);
      return isWithinInterval(saleDate, { start: dateRange.start, end: dateRange.end });
    });

    if (filteredSales.length === 0) return null;

    // Separate by type
    const fpSales = filteredSales.filter(s => s.type === 'fp');
    const upgradeSales = filteredSales.filter(s => s.type === 'upgrade');

    // Economics
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

    // Time to Sell
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
        name: fastest.customer_name || 'Unknown',
        minutes: fastest.time_to_sell_minutes || 0,
        prmr: fastest.prmr || 0,
      };
      slowestSale = {
        name: slowest.customer_name || 'Unknown',
        minutes: slowest.time_to_sell_minutes || 0,
        prmr: slowest.prmr || 0,
      };
    }

    // Deal Type Distribution
    const salesWithDealType = filteredSales.filter(s => s.deal_type);
    const dealTypeDistribution = {
      fresh: salesWithDealType.filter(s => s.deal_type === 'fresh').length,
      takeover: salesWithDealType.filter(s => s.deal_type === 'takeover').length,
      diy: salesWithDealType.filter(s => s.deal_type === 'diy').length,
    };

    // PRMR by deal type
    const prmrByDealType = {
      fresh: salesWithDealType.filter(s => s.deal_type === 'fresh').reduce((sum, s) => sum + (s.prmr || 0), 0) / Math.max(dealTypeDistribution.fresh, 1),
      takeover: salesWithDealType.filter(s => s.deal_type === 'takeover').reduce((sum, s) => sum + (s.prmr || 0), 0) / Math.max(dealTypeDistribution.takeover, 1),
      diy: salesWithDealType.filter(s => s.deal_type === 'diy').reduce((sum, s) => sum + (s.prmr || 0), 0) / Math.max(dealTypeDistribution.diy, 1),
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

    return {
      avgPrmrPerFp,
      avgPrmrPerUpgrade,
      avgMoneySpent,
      prmrToCostRatio,
      totalPrmr,
      totalMoneySpent,
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
      dealsWithTimeData: salesWithTime.length,
      salesWithLocationCount,
      hasTimeData: salesWithTime.length > 0,
      hasDealTypeData: salesWithDealType.length > 0,
      hasMoneySpentData: salesWithMoney.length > 0,
      hasInstallData: salesWithInstallInfo.length > 0,
    };
  }, [sales, dateRange]);

  return { insights, isLoading };
};
