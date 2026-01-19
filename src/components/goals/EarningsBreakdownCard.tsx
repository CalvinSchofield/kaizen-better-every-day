import { useState, useMemo, useCallback } from 'react';
import { DollarSign, TrendingUp, ChevronDown, Receipt, Home, Gift, PiggyBank, Pencil, Check, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRepGoals } from '@/hooks/useRepGoals';
import { useRepData } from '@/hooks/useRepData';
import { usePreseasonFP } from '@/hooks/usePreseasonFP';
import { getTier, getRentCost } from '@/utils/payscaleCalculator';
import { calculateUpfrontPay, calculateTotalPay } from '@/utils/roiCalculations';
import { cn } from '@/lib/utils';

interface Sale {
  prmr?: number;
  money_spent?: number;
  type?: string;
  install_status?: string;
  sale_time?: string;
}

// Season date constants
const PRESEASON_START = '2025-09-28';
const PRESEASON_END = '2026-04-11';
const EXTENSION_START = '2026-08-30';
const SEASON_END = '2026-09-27';

export const EarningsBreakdownCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingSpendingRate, setIsEditingSpendingRate] = useState(false);
  const [customRateInput, setCustomRateInput] = useState('');
  
  const { goals, updateGoals } = useRepGoals();
  const { repData } = useRepData();
  const { totalFP, fundedPRMR } = usePreseasonFP();
  
  // Check if user has EFP mode enabled
  const efpModeEnabled = repData?.efp_mode_enabled ?? false;
  
  // Fetch all sales with spending data for the entire season
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['earnings-breakdown-data', repData?.user_id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('sales_log, prmr, entry_date, is_finalized')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', PRESEASON_START)
        .lte('entry_date', SEASON_END);
      
      if (error) return null;
      
      let totalSpent = 0;
      let totalPrmr = 0;
      let preseasonSummerPrmr = 0; // Preseason + Summer main (before extension)
      let extensionPrmr = 0;
      let dealsCount = 0;
      let dealsWithSpending = 0;
      
      entries?.forEach(entry => {
        const salesLog = entry.sales_log as Sale[] | null;
        const entryDate = entry.entry_date;
        
        if (salesLog && Array.isArray(salesLog)) {
          salesLog.forEach(sale => {
            // Skip never_installed
            if (sale.install_status === 'never_installed') return;
            
            dealsCount++;
            const prmr = sale.prmr || 0;
            const spent = sale.money_spent || 0;
            
            totalPrmr += prmr;
            totalSpent += spent;
            if (spent > 0) dealsWithSpending++;
            
            // Categorize by period
            if (entryDate >= EXTENSION_START) {
              extensionPrmr += prmr;
            } else {
              preseasonSummerPrmr += prmr;
            }
          });
        }
      });
      
      return {
        totalSpent,
        totalPrmr,
        preseasonSummerPrmr,
        extensionPrmr,
        dealsCount,
        dealsWithSpending,
      };
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate all earnings metrics
  const metrics = useMemo(() => {
    const totalPrmr = salesData?.totalPrmr || fundedPRMR || 0;
    const preseasonSummerPrmr = salesData?.preseasonSummerPrmr || totalPrmr;
    const extensionPrmr = salesData?.extensionPrmr || 0;
    const totalSpent = salesData?.totalSpent || 0;
    const dealsCount = salesData?.dealsCount || 0;
    const dealsWithSpending = salesData?.dealsWithSpending || 0;
    
    if (totalPrmr === 0) return null;
    
    // Get tier rate based on FP+
    const customPayLevel = goals?.custom_payscale_fp ?? null;
    const targetFpPlus = customPayLevel ?? totalFP;
    const tier = getTier(targetFpPlus);
    const payRate = tier.rate;
    const rentBonus = tier.rentBonus || 0;
    
    // Pay calculations
    const upfrontPay = calculateUpfrontPay(totalPrmr);
    const totalGrossPay = calculateTotalPay(totalPrmr, payRate);
    const totalBackend = totalGrossPay - upfrontPay;
    
    // Backend split calculations
    // Preseason + Summer Main backend (everything before extension)
    const preseasonSummerPay = preseasonSummerPrmr * payRate;
    const preseasonSummerUpfront = preseasonSummerPrmr * 4;
    const preseasonSummerBackend = Math.max(0, preseasonSummerPay - preseasonSummerUpfront);
    
    // Extension backend (100% of extension period)
    const extensionPay = extensionPrmr * payRate;
    const extensionUpfront = extensionPrmr * 4;
    const extensionBackend = Math.max(0, extensionPay - extensionUpfront);
    
    // Backend 1 = 70% of preseason + summer main backend
    const backend1 = preseasonSummerBackend * 0.70;
    
    // Backend 2 = 30% of preseason + summer main backend + 100% of extension backend
    const backend2 = (preseasonSummerBackend * 0.30) + extensionBackend;
    
    // Deductions
    const rentType = goals?.rent_type || 'No Rent';
    const weeksWorking = goals?.weeks_working || 18;
    const rentCost = getRentCost(rentType, weeksWorking);
    
    // Spending rate calculation
    // Calculate spending per FP+ (or EFP based on mode)
    const fpCount = efpModeEnabled ? totalFP : totalFP; // Both use same FP+ for now
    const calculatedSpendingRate = fpCount > 0 && totalSpent > 0 
      ? totalSpent / fpCount 
      : 0;
    
    // Use custom rate if set, otherwise calculated rate
    const customRate = goals?.custom_spending_rate;
    const spendingRate = customRate ?? calculatedSpendingRate;
    
    // Data accuracy (what % of deals have spending tracked)
    const dataAccuracy = dealsCount > 0 ? (dealsWithSpending / dealsCount) * 100 : 0;
    
    // Anticipated total spending (current spent + projected based on rate)
    const anticipatedSpending = totalSpent;
    
    // Net calculations
    const netPay = totalGrossPay - rentCost + rentBonus - anticipatedSpending;
    
    return {
      // Pay breakdown
      upfrontPay,
      backend1,
      backend2,
      totalBackend,
      totalGrossPay,
      
      // Deductions
      rentCost,
      rentBonus,
      rentType,
      weeksWorking,
      anticipatedSpending,
      
      // Spending rate
      spendingRate,
      calculatedSpendingRate,
      hasCustomRate: customRate !== null && customRate !== undefined,
      dataAccuracy,
      
      // Net
      netPay,
      
      // Tier info
      payRate,
      tierName: `${payRate}/PRMR`,
      
      // Raw data
      totalPrmr,
      fpCount,
      dealsCount,
    };
  }, [salesData, fundedPRMR, totalFP, goals, efpModeEnabled]);
  
  const handleSaveCustomRate = useCallback(() => {
    const rate = parseFloat(customRateInput);
    if (!isNaN(rate) && rate >= 0) {
      updateGoals({ custom_spending_rate: rate });
    }
    setIsEditingSpendingRate(false);
    setCustomRateInput('');
  }, [customRateInput, updateGoals]);
  
  const handleClearCustomRate = useCallback(() => {
    updateGoals({ custom_spending_rate: null });
    setIsEditingSpendingRate(false);
  }, [updateGoals]);
  
  const handleStartEdit = useCallback(() => {
    setCustomRateInput(metrics?.spendingRate?.toFixed(0) || '');
    setIsEditingSpendingRate(true);
  }, [metrics?.spendingRate]);
  
  // Don't show if no data
  if (isLoading || !metrics) {
    return null;
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      <Card className="border-border/50 overflow-hidden">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="w-full">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-success" />
                  <span className="font-semibold">Earnings Breakdown</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    Net: <span className="text-foreground font-bold">{formatCurrency(metrics.netPay)}</span>
                  </span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )} />
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          
          <AnimatePresence>
            {isOpen && (
              <CollapsibleContent forceMount>
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <CardContent className="pt-0 px-4 pb-4 space-y-4">
                    {/* Pay Timeline Section */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Pay Timeline
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💰</span>
                            <span className="text-sm">Upfront Pay (×4)</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(metrics.upfrontPay)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="text-sm">Backend 1 (70%)</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(metrics.backend1)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="text-sm">Backend 2 (30% + Ext)</span>
                          </div>
                          <span className="font-semibold">{formatCurrency(metrics.backend2)}</span>
                        </div>
                        <div className="border-t border-border/50 pt-2 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-success" />
                            <span className="text-sm font-medium">Gross Total</span>
                          </div>
                          <span className="font-bold text-success">{formatCurrency(metrics.totalGrossPay)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Deductions Section */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Deductions & Bonuses
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3 space-y-2">
                        {metrics.rentCost > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Home className="w-4 h-4 text-muted-foreground" />
                              <span className="text-sm">
                                Rent ({metrics.weeksWorking}wks × {metrics.rentType})
                              </span>
                            </div>
                            <span className="font-semibold text-destructive">-{formatCurrency(metrics.rentCost)}</span>
                          </div>
                        )}
                        {metrics.rentBonus > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Gift className="w-4 h-4 text-success" />
                              <span className="text-sm">Rent Bonus</span>
                            </div>
                            <span className="font-semibold text-success">+{formatCurrency(metrics.rentBonus)}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="text-sm">Spending</span>
                              {!isEditingSpendingRate && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleStartEdit(); }}
                                  className="text-[10px] text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                                >
                                  {metrics.hasCustomRate ? (
                                    <>Custom: ${metrics.spendingRate.toFixed(0)}/{efpModeEnabled ? 'EFP' : 'FP+'}</>
                                  ) : (
                                    <>{Math.round(metrics.dataAccuracy)}% tracked</>
                                  )}
                                  <Pencil className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <span className="font-semibold text-destructive">-{formatCurrency(metrics.anticipatedSpending)}</span>
                        </div>
                        
                        {/* Custom rate editor */}
                        {isEditingSpendingRate && (
                          <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs text-muted-foreground">$</span>
                            <Input
                              type="number"
                              value={customRateInput}
                              onChange={(e) => setCustomRateInput(e.target.value)}
                              placeholder="Rate"
                              className="h-7 w-20 text-sm"
                              autoFocus
                            />
                            <span className="text-xs text-muted-foreground">/{efpModeEnabled ? 'EFP' : 'FP+'}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleSaveCustomRate}>
                              <Check className="w-3 h-3 text-success" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsEditingSpendingRate(false)}>
                              <X className="w-3 h-3" />
                            </Button>
                            {metrics.hasCustomRate && (
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={handleClearCustomRate}>
                                Reset
                              </Button>
                            )}
                          </div>
                        )}
                        
                        <div className="border-t border-border/50 pt-2 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <PiggyBank className="w-4 h-4 text-success" />
                            <span className="text-sm font-medium">Net Total Pay</span>
                          </div>
                          <span className="font-bold text-success">{formatCurrency(metrics.netPay)}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">${metrics.payRate}</div>
                        <div className="text-[10px] text-muted-foreground">/PRMR Rate</div>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">{metrics.dealsCount}</div>
                        <div className="text-[10px] text-muted-foreground">Deals</div>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">${metrics.totalPrmr.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">Total PRMR</div>
                      </div>
                    </div>
                  </CardContent>
                </motion.div>
              </CollapsibleContent>
            )}
          </AnimatePresence>
        </Collapsible>
      </Card>
    </motion.div>
  );
};
