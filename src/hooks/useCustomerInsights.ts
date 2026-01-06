import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sale } from '@/components/LogSaleSheet';
import { isWithinInterval, parseISO, differenceInDays, format, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns';

interface SaleWithDate extends Sale {
  entry_date: string;
}

export interface RoiTrendDataPoint {
  period: string;
  fresh?: number;
  takeover?: number;
  diy?: number;
  freshSpend?: number;
  takeoverSpend?: number;
  diySpend?: number;
}

// Deal highlight info
export interface DealHighlight {
  name: string;
  prmr: number;
  minutes?: number;
  moneySpent?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  date: string;
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
  avgCostByDealType: { fresh: number; takeover: number; diy: number };
  avgCostBySaleType: { fp: number; upgrade: number };
  avgCostPerEfp: number;
  avgCostPerFpPlus: number;
  
  // Economics by Sale Type (FP vs Upgrade)
  spendBySaleType: { fp: number; upgrade: number };
  prmrTotalBySaleType: { fp: number; upgrade: number };
  
  // ROI Trend Data (weekly aggregated)
  roiTrendData: RoiTrendDataPoint[];
  hasEnoughTrendData: boolean;
  
  // Time to Sell
  avgTimeToSell: number;
  avgTimeByDealType: { fresh: number; takeover: number; diy: number };
  avgTimeBySaleType: { fp: number; upgrade: number };
  avgTimeByDifficulty: { easy: number; medium: number; hard: number };
  fastestSale: DealHighlight | null;
  slowestSale: DealHighlight | null;
  
  // Earliest/Latest deals by category
  earliestFpDeal: DealHighlight | null;
  latestFpDeal: DealHighlight | null;
  earliestUpgradeDeal: DealHighlight | null;
  latestUpgradeDeal: DealHighlight | null;
  highestPrmrDeal: DealHighlight | null;
  lowestPrmrDeal: DealHighlight | null;
  mostExpensiveDeal: DealHighlight | null;
  cheapestDeal: DealHighlight | null;
  
  // Deal Type Distribution
  dealTypeDistribution: { fresh: number; takeover: number; diy: number };
  prmrByDealType: { fresh: number; takeover: number; diy: number };
  difficultyDistribution: { easy: number; medium: number; hard: number };
  difficultyBySaleType: { 
    fp: { easy: number; medium: number; hard: number }; 
    upgrade: { easy: number; medium: number; hard: number }; 
  };
  difficultyByDealType: {
    fresh: { easy: number; medium: number; hard: number };
    takeover: { easy: number; medium: number; hard: number };
    diy: { easy: number; medium: number; hard: number };
  };
  
  // Install Performance
  sameDayInstallRate: number;
  cancelRate: number;
  avgDaysToInstall: number;
  
  // Sales by Hour heatmap data (hour 0-23 -> counts by type)
  salesByHourAndType: {
    hour: number;
    fresh: number;
    takeover: number;
    diy: number;
    upgrade: number;
    total: number;
  }[];
  hasSaleTimeData: boolean;
  
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
    // Use startOfDay and endOfDay to ensure entire day is included for single-day ranges
    const filteredSales = allSales.filter(sale => {
      const saleDate = parseISO(sale.entry_date);
      return isWithinInterval(saleDate, { 
        start: startOfDay(dateRange.start), 
        end: endOfDay(dateRange.end) 
      });
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

    // Time by sale type (FP vs Upgrade)
    const fpWithTime = salesWithTime.filter(s => s.type === 'fp');
    const upgradeWithTime = salesWithTime.filter(s => s.type === 'upgrade');

    const avgTimeBySaleType = {
      fp: fpWithTime.length > 0 
        ? fpWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / fpWithTime.length 
        : 0,
      upgrade: upgradeWithTime.length > 0 
        ? upgradeWithTime.reduce((sum, s) => sum + (s.time_to_sell_minutes || 0), 0) / upgradeWithTime.length 
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
    let fastestSale: DealHighlight | null = null;
    let slowestSale: DealHighlight | null = null;
    
    if (salesWithTime.length > 0) {
      const sorted = [...salesWithTime].sort((a, b) => (a.time_to_sell_minutes || 0) - (b.time_to_sell_minutes || 0));
      const fastest = sorted[0];
      const slowest = sorted[sorted.length - 1];
      
      fastestSale = {
        name: fastest.customer_name || 'Sale',
        minutes: fastest.time_to_sell_minutes || 0,
        prmr: fastest.prmr || 0,
        date: fastest.entry_date,
        difficulty: fastest.difficulty as 'easy' | 'medium' | 'hard' | undefined,
        moneySpent: fastest.money_spent,
      };
      slowestSale = {
        name: slowest.customer_name || 'Sale',
        minutes: slowest.time_to_sell_minutes || 0,
        prmr: slowest.prmr || 0,
        date: slowest.entry_date,
        difficulty: slowest.difficulty as 'easy' | 'medium' | 'hard' | undefined,
        moneySpent: slowest.money_spent,
      };
    }

    // Earliest/Latest deals by category
    const sortedByDate = [...filteredSales].sort((a, b) => 
      parseISO(a.entry_date).getTime() - parseISO(b.entry_date).getTime()
    );
    
    const fpSalesSorted = sortedByDate.filter(s => s.type === 'fp');
    const upgradeSalesSorted = sortedByDate.filter(s => s.type === 'upgrade');
    
    const createHighlight = (s: SaleWithDate): DealHighlight => ({
      name: s.customer_name || 'Sale',
      prmr: s.prmr || 0,
      minutes: s.time_to_sell_minutes,
      moneySpent: s.money_spent,
      difficulty: s.difficulty as 'easy' | 'medium' | 'hard' | undefined,
      date: s.entry_date,
    });
    
    const earliestFpDeal = fpSalesSorted.length > 0 ? createHighlight(fpSalesSorted[0]) : null;
    const latestFpDeal = fpSalesSorted.length > 0 ? createHighlight(fpSalesSorted[fpSalesSorted.length - 1]) : null;
    const earliestUpgradeDeal = upgradeSalesSorted.length > 0 ? createHighlight(upgradeSalesSorted[0]) : null;
    const latestUpgradeDeal = upgradeSalesSorted.length > 0 ? createHighlight(upgradeSalesSorted[upgradeSalesSorted.length - 1]) : null;
    
    // Highest/Lowest PRMR deals
    const sortedByPrmr = [...filteredSales].sort((a, b) => (b.prmr || 0) - (a.prmr || 0));
    const highestPrmrDeal = sortedByPrmr.length > 0 ? createHighlight(sortedByPrmr[0]) : null;
    const lowestPrmrDeal = sortedByPrmr.length > 0 ? createHighlight(sortedByPrmr[sortedByPrmr.length - 1]) : null;
    
    // Most/Least expensive deals
    const salesWithSpend = filteredSales.filter(s => s.money_spent && s.money_spent > 0);
    const sortedBySpend = [...salesWithSpend].sort((a, b) => (b.money_spent || 0) - (a.money_spent || 0));
    const mostExpensiveDeal = sortedBySpend.length > 0 ? createHighlight(sortedBySpend[0]) : null;
    const cheapestDeal = sortedBySpend.length > 0 ? createHighlight(sortedBySpend[sortedBySpend.length - 1]) : null;

    // Deal Type Distribution - only for FP sales with deal_type set (not upgrades)
    const fpSalesWithDealType = fpSales.filter(s => s.deal_type);
    const dealTypeDistribution = {
      fresh: fpSalesWithDealType.filter(s => s.deal_type === 'fresh').length,
      takeover: fpSalesWithDealType.filter(s => s.deal_type === 'takeover').length,
      diy: fpSalesWithDealType.filter(s => s.deal_type === 'diy').length,
    };

    // PRMR by deal type (average) - only FP sales
    const prmrByDealType = {
      fresh: dealTypeDistribution.fresh > 0 
        ? fpSalesWithDealType.filter(s => s.deal_type === 'fresh').reduce((sum, s) => sum + (s.prmr || 0), 0) / dealTypeDistribution.fresh
        : 0,
      takeover: dealTypeDistribution.takeover > 0
        ? fpSalesWithDealType.filter(s => s.deal_type === 'takeover').reduce((sum, s) => sum + (s.prmr || 0), 0) / dealTypeDistribution.takeover
        : 0,
      diy: dealTypeDistribution.diy > 0
        ? fpSalesWithDealType.filter(s => s.deal_type === 'diy').reduce((sum, s) => sum + (s.prmr || 0), 0) / dealTypeDistribution.diy
        : 0,
    };

    // Spend and PRMR totals by deal type (for ROI calculation) - only FP sales
    const spendByDealType = {
      fresh: fpSalesWithDealType.filter(s => s.deal_type === 'fresh').reduce((sum, s) => sum + (s.money_spent || 0), 0),
      takeover: fpSalesWithDealType.filter(s => s.deal_type === 'takeover').reduce((sum, s) => sum + (s.money_spent || 0), 0),
      diy: fpSalesWithDealType.filter(s => s.deal_type === 'diy').reduce((sum, s) => sum + (s.money_spent || 0), 0),
    };
    
    // Average cost per deal by deal type (total spend / total deals, including $0 deals)
    const avgCostByDealType = {
      fresh: dealTypeDistribution.fresh > 0 ? spendByDealType.fresh / dealTypeDistribution.fresh : 0,
      takeover: dealTypeDistribution.takeover > 0 ? spendByDealType.takeover / dealTypeDistribution.takeover : 0,
      diy: dealTypeDistribution.diy > 0 ? spendByDealType.diy / dealTypeDistribution.diy : 0,
    };

    const prmrTotalByDealType = {
      fresh: fpSalesWithDealType.filter(s => s.deal_type === 'fresh').reduce((sum, s) => sum + (s.prmr || 0), 0),
      takeover: fpSalesWithDealType.filter(s => s.deal_type === 'takeover').reduce((sum, s) => sum + (s.prmr || 0), 0),
      diy: fpSalesWithDealType.filter(s => s.deal_type === 'diy').reduce((sum, s) => sum + (s.prmr || 0), 0),
    };

    // Spend and PRMR totals by sale type (FP vs Upgrade)
    const spendBySaleType = {
      fp: fpSales.reduce((sum, s) => sum + (s.money_spent || 0), 0),
      upgrade: upgradeSales.reduce((sum, s) => sum + (s.money_spent || 0), 0),
    };
    
    // Average cost per deal by sale type (total spend / total deals, including $0 deals)
    const avgCostBySaleType = {
      fp: fpSales.length > 0 ? spendBySaleType.fp / fpSales.length : 0,
      upgrade: upgradeSales.length > 0 ? spendBySaleType.upgrade / upgradeSales.length : 0,
    };
    
    // Average cost per unit (EFP or FP+)
    const totalEfp = totalPrmr / 85;
    const avgCostPerEfp = totalEfp > 0 ? totalMoneySpent / totalEfp : 0;
    const totalFpPlus = fpSales.length + (upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0) / 85);
    const avgCostPerFpPlus = totalFpPlus > 0 ? totalMoneySpent / totalFpPlus : 0;

    const prmrTotalBySaleType = {
      fp: fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0),
      upgrade: upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0),
    };

    // ROI Trend Data - aggregate by week for meaningful trends
    const salesWithDealTypeAndMoney = filteredSales.filter(s => s.deal_type && s.money_spent && s.money_spent > 0);
    const weeklyData = new Map<string, { 
      fresh: { prmr: number; spend: number };
      takeover: { prmr: number; spend: number };
      diy: { prmr: number; spend: number };
    }>();

    // Group sales by week
    for (const sale of salesWithDealTypeAndMoney) {
      const saleDate = parseISO(sale.entry_date);
      const weekStart = startOfWeek(saleDate, { weekStartsOn: 1 }); // Monday
      const weekKey = format(weekStart, 'MMM d');
      
      if (!weeklyData.has(weekKey)) {
        weeklyData.set(weekKey, {
          fresh: { prmr: 0, spend: 0 },
          takeover: { prmr: 0, spend: 0 },
          diy: { prmr: 0, spend: 0 },
        });
      }
      
      const week = weeklyData.get(weekKey)!;
      const dealType = sale.deal_type as 'fresh' | 'takeover' | 'diy';
      week[dealType].prmr += sale.prmr || 0;
      week[dealType].spend += sale.money_spent || 0;
    }

    // Convert to array sorted by date and calculate ROI
    const roiTrendData: RoiTrendDataPoint[] = Array.from(weeklyData.entries())
      .sort((a, b) => {
        // Parse the week key back to compare dates
        const dateA = new Date(a[0] + ', 2025');
        const dateB = new Date(b[0] + ', 2025');
        return dateA.getTime() - dateB.getTime();
      })
      .map(([period, data]) => ({
        period,
        fresh: data.fresh.spend > 0 ? data.fresh.prmr / data.fresh.spend : undefined,
        takeover: data.takeover.spend > 0 ? data.takeover.prmr / data.takeover.spend : undefined,
        diy: data.diy.spend > 0 ? data.diy.prmr / data.diy.spend : undefined,
        freshSpend: data.fresh.spend,
        takeoverSpend: data.takeover.spend,
        diySpend: data.diy.spend,
      }));

    // Only show trend if we have 2+ weeks with data
    const hasEnoughTrendData = roiTrendData.length >= 2;

    // Difficulty Distribution
    const salesWithDifficulty = filteredSales.filter(s => s.difficulty);
    const difficultyDistribution = {
      easy: salesWithDifficulty.filter(s => s.difficulty === 'easy').length,
      medium: salesWithDifficulty.filter(s => s.difficulty === 'medium').length,
      hard: salesWithDifficulty.filter(s => s.difficulty === 'hard').length,
    };

    // Difficulty by sale type (FP vs Upgrade)
    const fpWithDifficulty = fpSales.filter(s => s.difficulty);
    const upgradeWithDifficulty = upgradeSales.filter(s => s.difficulty);
    const difficultyBySaleType = {
      fp: {
        easy: fpWithDifficulty.filter(s => s.difficulty === 'easy').length,
        medium: fpWithDifficulty.filter(s => s.difficulty === 'medium').length,
        hard: fpWithDifficulty.filter(s => s.difficulty === 'hard').length,
      },
      upgrade: {
        easy: upgradeWithDifficulty.filter(s => s.difficulty === 'easy').length,
        medium: upgradeWithDifficulty.filter(s => s.difficulty === 'medium').length,
        hard: upgradeWithDifficulty.filter(s => s.difficulty === 'hard').length,
      },
    };
    
    // Difficulty by deal type (Fresh, Takeover, DIY) - only FP sales
    const freshWithDiff = fpSalesWithDealType.filter(s => s.deal_type === 'fresh' && s.difficulty);
    const takeoverWithDiff = fpSalesWithDealType.filter(s => s.deal_type === 'takeover' && s.difficulty);
    const diyWithDiff = fpSalesWithDealType.filter(s => s.deal_type === 'diy' && s.difficulty);
    
    const difficultyByDealType = {
      fresh: {
        easy: freshWithDiff.filter(s => s.difficulty === 'easy').length,
        medium: freshWithDiff.filter(s => s.difficulty === 'medium').length,
        hard: freshWithDiff.filter(s => s.difficulty === 'hard').length,
      },
      takeover: {
        easy: takeoverWithDiff.filter(s => s.difficulty === 'easy').length,
        medium: takeoverWithDiff.filter(s => s.difficulty === 'medium').length,
        hard: takeoverWithDiff.filter(s => s.difficulty === 'hard').length,
      },
      diy: {
        easy: diyWithDiff.filter(s => s.difficulty === 'easy').length,
        medium: diyWithDiff.filter(s => s.difficulty === 'medium').length,
        hard: diyWithDiff.filter(s => s.difficulty === 'hard').length,
      },
    };

    // Install Performance
    // A sale is considered same-day if:
    // 1. installed_same_day is explicitly true, OR
    // 2. No scheduled_install_date is set (meaning it wasn't scheduled out), OR
    // 3. scheduled_install_date equals the entry_date
    const installedSameDayCount = filteredSales.filter(s => {
      // If explicitly marked as same-day install
      if (s.installed_same_day === true) return true;
      // If explicitly marked as NOT same-day
      if (s.installed_same_day === false) return false;
      // If no scheduled install date, it's a same-day install
      if (!s.scheduled_install_date) return true;
      // If scheduled for the same day as the sale, it's same-day
      return s.scheduled_install_date === s.entry_date;
    }).length;
    
    const cancelledCount = filteredSales.filter(s => s.install_status === 'cancelled').length;
    
    // For average days to install, only count sales that were actually scheduled out
    const salesScheduledOut = filteredSales.filter(s => 
      s.scheduled_install_date && 
      s.entry_date && 
      s.scheduled_install_date !== s.entry_date
    );
    let avgDaysToInstall = 0;
    if (salesScheduledOut.length > 0) {
      const totalDays = salesScheduledOut.reduce((sum, s) => {
        const saleDate = parseISO(s.entry_date);
        const installDate = parseISO(s.scheduled_install_date!);
        return sum + Math.max(0, differenceInDays(installDate, saleDate));
      }, 0);
      avgDaysToInstall = totalDays / salesScheduledOut.length;
    }

    // Same-day rate is based on ALL deals (not just those with install_status set)
    const sameDayInstallRate = filteredSales.length > 0 
      ? (installedSameDayCount / filteredSales.length) * 100 
      : 0;
    const cancelRate = filteredSales.length > 0 
      ? (cancelledCount / filteredSales.length) * 100 
      : 0;

    // Location
    const salesWithLocationCount = filteredSales.filter(s => s.customer_lat && s.customer_lng).length;
    
    // CRM data count
    const dealsWithCrmData = filteredSales.filter(s => s.customer_name || s.account_number || s.customer_phone).length;

    // Sales by Hour heatmap - parse timestamp from each sale (stored in local time)
    const salesByHourMap: Record<number, { fresh: number; takeover: number; diy: number; upgrade: number }> = {};
    
    // Initialize all hours
    for (let h = 0; h < 24; h++) {
      salesByHourMap[h] = { fresh: 0, takeover: 0, diy: 0, upgrade: 0 };
    }
    
    // Count sales by hour and type
    let salesWithTimestampCount = 0;
    for (const sale of filteredSales) {
      if (sale.timestamp) {
        try {
          const saleTime = parseISO(sale.timestamp);
          const hour = saleTime.getHours();
          salesWithTimestampCount++;
          
          if (sale.type === 'upgrade') {
            salesByHourMap[hour].upgrade++;
          } else if (sale.deal_type === 'fresh') {
            salesByHourMap[hour].fresh++;
          } else if (sale.deal_type === 'takeover') {
            salesByHourMap[hour].takeover++;
          } else if (sale.deal_type === 'diy') {
            salesByHourMap[hour].diy++;
          } else {
            // FP without deal_type specified - count as fresh
            salesByHourMap[hour].fresh++;
          }
        } catch {
          // Skip invalid timestamps
        }
      }
    }
    
    const salesByHourAndType = Object.entries(salesByHourMap).map(([hour, counts]) => ({
      hour: parseInt(hour),
      ...counts,
      total: counts.fresh + counts.takeover + counts.diy + counts.upgrade,
    }));

    return {
      avgPrmrPerFp,
      avgPrmrPerUpgrade,
      avgMoneySpent,
      prmrToCostRatio,
      totalPrmr,
      totalMoneySpent,
      spendByDealType,
      prmrTotalByDealType,
      avgCostByDealType,
      avgCostBySaleType,
      spendBySaleType,
      prmrTotalBySaleType,
      roiTrendData,
      hasEnoughTrendData,
      avgTimeToSell,
      avgTimeByDealType,
      avgTimeBySaleType,
      avgTimeByDifficulty,
      fastestSale,
      slowestSale,
      earliestFpDeal,
      latestFpDeal,
      earliestUpgradeDeal,
      latestUpgradeDeal,
      highestPrmrDeal,
      lowestPrmrDeal,
      mostExpensiveDeal,
      cheapestDeal,
      dealTypeDistribution,
      prmrByDealType,
      difficultyDistribution,
      difficultyBySaleType,
      difficultyByDealType,
      sameDayInstallRate,
      cancelRate,
      avgDaysToInstall,
      avgCostPerEfp,
      avgCostPerFpPlus,
      totalDeals: filteredSales.length,
      totalFpDeals: fpSales.length,
      totalUpgradeDeals: upgradeSales.length,
      dealsWithTimeData: salesWithTime.length,
      salesWithLocationCount,
      dealsWithCrmData,
      salesByHourAndType,
      hasSaleTimeData: salesWithTimestampCount > 0,
      hasTimeData: salesWithTime.length > 0,
      hasDealTypeData: fpSalesWithDealType.length > 0,
      hasMoneySpentData: salesWithMoney.length > 0,
      hasInstallData: filteredSales.length > 0,
    };
  }, [allSales, dateRange]);

  return { insights, isLoading };
};
