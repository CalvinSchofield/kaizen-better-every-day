import { useMemo } from 'react';
import { Receipt, TrendingUp, DollarSign, PiggyBank } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRepGoals } from '@/hooks/useRepGoals';
import { useRepData } from '@/hooks/useRepData';
import { getTier } from '@/utils/payscaleCalculator';
import { usePreseasonFP } from '@/hooks/usePreseasonFP';
import { calculateRoiMetrics } from '@/utils/roiCalculations';

interface Sale {
  prmr?: number;
  money_spent?: number;
  type?: string;
  install_status?: string;
}

const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';

export const SpendingROICard = () => {
  const { goals } = useRepGoals();
  const { repData } = useRepData();
  const { totalFP } = usePreseasonFP();
  
  // Fetch all sales with spending data for the preseason
  const { data: spendingData, isLoading } = useQuery({
    queryKey: ['goals-spending-data', repData?.user_id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('sales_log, prmr')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', PRESEASON_START)
        .lte('entry_date', PRESEASON_END);
      
      if (error) return null;
      
      let totalSpent = 0;
      let totalPrmr = 0;
      let dealsWithSpending = 0;
      let totalDeals = 0;
      
      entries?.forEach(entry => {
        const salesLog = entry.sales_log as Sale[] | null;
        if (salesLog && Array.isArray(salesLog)) {
          salesLog.forEach(sale => {
            // Skip never_installed
            if (sale.install_status === 'never_installed') return;
            
            totalDeals++;
            const prmr = sale.prmr || 0;
            const spent = sale.money_spent || 0;
            
            totalPrmr += prmr;
            totalSpent += spent;
            if (spent > 0) dealsWithSpending++;
          });
        }
      });
      
      return {
        totalSpent,
        totalPrmr,
        dealsWithSpending,
        totalDeals,
      };
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate metrics
  const metrics = useMemo(() => {
    if (!spendingData || spendingData.totalDeals === 0) return null;
    
    const { totalSpent, totalPrmr, dealsWithSpending, totalDeals } = spendingData;
    
    // Calculate ROI metrics using unified utility
    const customPayLevel = goals?.custom_payscale_fp ?? null;
    const targetFpPlus = customPayLevel ?? totalFP;
    const roiMetrics = calculateRoiMetrics(totalPrmr, totalSpent, targetFpPlus, customPayLevel);
    
    const { upfrontPay, netUpfront, totalPay, netTotal, upfrontRoi, totalRoi, payRate } = roiMetrics;
    
    // Avg cost per deal
    const avgCostPerDeal = totalDeals > 0 ? totalSpent / totalDeals : 0;
    
    // Percentage of deals with spending
    const spendingRate = totalDeals > 0 ? (dealsWithSpending / totalDeals) * 100 : 0;
    
    return {
      totalSpent,
      totalPrmr,
      upfrontPay,
      netUpfront,
      totalPay,
      netTotal,
      upfrontRoi,
      totalRoi,
      avgCostPerDeal,
      spendingRate,
      tierRate: payRate,
      totalDeals,
      dealsWithSpending,
    };
  }, [spendingData, goals?.custom_payscale_fp, totalFP]);
  
  // Don't show if no spending data
  if (isLoading || !metrics || metrics.totalSpent === 0) {
    return null;
  }
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <Card className="border-border/50 overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-destructive" />
            <span className="font-semibold">Spending & ROI</span>
            <span className="text-xs text-muted-foreground ml-auto">Preseason</span>
          </div>
          
          {/* Total Spent Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-destructive/10 text-center">
              <div className="text-xl font-bold text-destructive">${metrics.totalSpent.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Spent</div>
            </div>
            <div className="p-3 rounded-xl bg-success/10 text-center">
              <div className="text-xl font-bold text-success">${metrics.netUpfront.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Net Upfront</div>
            </div>
          </div>
          
          {/* ROI and Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <div className={`text-lg font-bold ${metrics.upfrontRoi >= 1 ? 'text-success' : 'text-destructive'}`}>
                {metrics.upfrontRoi.toFixed(1)}x
              </div>
              <div className="text-[10px] text-muted-foreground">Upfront ROI</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <div className={`text-lg font-bold ${metrics.totalRoi >= 1 ? 'text-success' : 'text-destructive'}`}>
                {metrics.totalRoi.toFixed(1)}x
              </div>
              <div className="text-[10px] text-muted-foreground">Total ROI</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <div className="text-lg font-bold">${metrics.avgCostPerDeal.toFixed(0)}</div>
              <div className="text-[10px] text-muted-foreground">Avg/Deal</div>
            </div>
          </div>
          
          {/* Spending Distribution */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Deals with spending</span>
              <span className="font-medium">{metrics.dealsWithSpending} of {metrics.totalDeals} ({Math.round(metrics.spendingRate)}%)</span>
            </div>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-destructive/60 rounded-full"
                style={{ width: `${metrics.spendingRate}%` }}
              />
            </div>
          </div>
          
          {/* Pay Impact Summary */}
          <div className="pt-2 border-t border-border/50 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                Gross Upfront Pay
              </span>
              <span className="font-medium">${metrics.upfrontPay.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Gross Total Pay (${metrics.tierRate}/PRMR)
              </span>
              <span className="font-medium">${metrics.totalPay.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-success">
              <span className="flex items-center gap-1">
                <PiggyBank className="w-3 h-3" />
                Net Total Pay
              </span>
              <span className="font-bold">${metrics.netTotal.toLocaleString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
