import { useState, useMemo, useCallback } from 'react';
import { DollarSign, TrendingUp, ChevronDown, Receipt, Home, Gift, PiggyBank, Pencil, Check, X, Target, Calendar } from 'lucide-react';
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
import { usePlannedDays } from '@/hooks/usePlannedDays';
import { getTier, getRentCost } from '@/utils/payscaleCalculator';
import { calculateUpfrontPay, calculateTotalPay } from '@/utils/roiCalculations';
import { cn } from '@/lib/utils';
import { differenceInDays, parseISO, isAfter, isBefore } from 'date-fns';

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
const SUMMER_START = '2026-04-12';
const EXTENSION_START = '2026-08-30';
const SEASON_END = '2026-09-27';

export const EarningsBreakdownCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingSpendingRate, setIsEditingSpendingRate] = useState(false);
  const [customRateInput, setCustomRateInput] = useState('');
  const [showProjected, setShowProjected] = useState(true);
  const [isEditingPace, setIsEditingPace] = useState(false);
  const [customPaceInput, setCustomPaceInput] = useState('');
  
  const { goals, updateGoals } = useRepGoals();
  const { repData } = useRepData();
  const { totalFP, fundedPRMR, knockingDays: preseasonKnockingDays } = usePreseasonFP();
  const { plannedDays } = usePlannedDays();
  
  // Check if user has EFP mode enabled
  const efpModeEnabled = repData?.efp_mode_enabled ?? false;
  
  // Fetch user's season config for personal summer dates
  const { data: seasonConfig } = useQuery({
    queryKey: ['earnings-season-config', repData?.user_id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('season_config')
        .select('personal_summer_start, personal_summer_end')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error) return null;
      return data;
    },
    enabled: !!repData?.user_id,
    staleTime: 30 * 60 * 1000,
  });
  
  // Fetch all sales with spending data for the entire season
  const { data: salesData, isLoading } = useQuery({
    queryKey: ['earnings-breakdown-data', repData?.user_id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('sales_log, prmr, entry_date, is_finalized, doors_knocked, work_start_time, work_end_time')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .gte('entry_date', PRESEASON_START)
        .lte('entry_date', SEASON_END);
      
      if (error) return null;
      
      let totalSpent = 0;
      let totalPrmr = 0;
      let preseasonPrmr = 0;
      let summerMainPrmr = 0; // Summer before extension
      let extensionPrmr = 0;
      let dealsCount = 0;
      let dealsWithSpending = 0;
      let totalKnockingDays = 0;
      let summerKnockingDays = 0;
      
      entries?.forEach(entry => {
        const salesLog = entry.sales_log as Sale[] | null;
        const entryDate = entry.entry_date;
        
        // Count knocking days (doors >= 4, has start/end time)
        const isKnockingDay = (entry.doors_knocked || 0) >= 4 && entry.work_start_time && entry.work_end_time;
        if (isKnockingDay) {
          totalKnockingDays++;
          if (entryDate >= SUMMER_START) {
            summerKnockingDays++;
          }
        }
        
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
            } else if (entryDate >= SUMMER_START) {
              summerMainPrmr += prmr;
            } else {
              preseasonPrmr += prmr;
            }
          });
        }
      });
      
      return {
        totalSpent,
        totalPrmr,
        preseasonPrmr,
        summerMainPrmr,
        extensionPrmr,
        preseasonSummerPrmr: preseasonPrmr + summerMainPrmr, // Non-extension PRMR
        dealsCount,
        dealsWithSpending,
        totalKnockingDays,
        summerKnockingDays,
      };
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate all earnings metrics including projections
  const metrics = useMemo(() => {
    const totalPrmr = salesData?.totalPrmr || fundedPRMR || 0;
    const preseasonSummerPrmr = salesData?.preseasonSummerPrmr || totalPrmr;
    const extensionPrmr = salesData?.extensionPrmr || 0;
    const totalSpent = salesData?.totalSpent || 0;
    const dealsCount = salesData?.dealsCount || 0;
    const dealsWithSpending = salesData?.dealsWithSpending || 0;
    const totalKnockingDays = salesData?.totalKnockingDays || preseasonKnockingDays || 0;
    
    if (totalPrmr === 0 && totalKnockingDays === 0) return null;
    
    // Get tier rate based on FP+
    const customPayLevel = goals?.custom_payscale_fp ?? null;
    const targetFpPlus = customPayLevel ?? totalFP;
    const tier = getTier(targetFpPlus);
    const payRate = tier.rate;
    const rentBonus = tier.rentBonus || 0;
    
    // Current earnings calculations
    const upfrontPay = calculateUpfrontPay(totalPrmr);
    const totalGrossPay = calculateTotalPay(totalPrmr, payRate);
    const totalBackend = totalGrossPay - upfrontPay;
    
    // Backend split calculations for current earnings
    const preseasonSummerPay = preseasonSummerPrmr * payRate;
    const preseasonSummerUpfront = preseasonSummerPrmr * 4;
    const preseasonSummerBackend = Math.max(0, preseasonSummerPay - preseasonSummerUpfront);
    
    const extensionPay = extensionPrmr * payRate;
    const extensionUpfront = extensionPrmr * 4;
    const extensionBackend = Math.max(0, extensionPay - extensionUpfront);
    
    const backend1 = preseasonSummerBackend * 0.70;
    const backend2 = (preseasonSummerBackend * 0.30) + extensionBackend;
    
    // === PROJECTION CALCULATIONS ===
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Use personal summer dates if available
    const personalSummerStart = seasonConfig?.personal_summer_start || SUMMER_START;
    const personalSummerEnd = seasonConfig?.personal_summer_end || SEASON_END;
    
    // Calculate current pace (FP+ per knocking day)
    const calculatedFpPerDay = totalKnockingDays > 0 ? totalFP / totalKnockingDays : 0;
    const prmrPerDay = totalKnockingDays > 0 ? totalPrmr / totalKnockingDays : 0;
    
    // Use custom pace if set, otherwise use calculated
    const customFpPace = goals?.custom_fp_pace ?? null;
    const fpPerDay = customFpPace ?? calculatedFpPerDay;
    
    // Calculate remaining planned days
    const futurePlannedDays = plannedDays?.filter(d => d.planned_date > todayStr && d.planned_date <= personalSummerEnd) || [];
    const remainingDays = futurePlannedDays.length;
    
    // Also count extension days from planned days
    const extensionPlannedDays = futurePlannedDays.filter(d => d.planned_date >= EXTENSION_START).length;
    const preExtensionPlannedDays = remainingDays - extensionPlannedDays;
    
    // Calculate PRMR per FP+ ratio to derive PRMR projections from FP+ pace
    const prmrPerFp = totalFP > 0 ? totalPrmr / totalFP : 85; // Default to average PRMR if no data
    const effectivePrmrPerDay = fpPerDay * prmrPerFp;
    
    // Project future using FP+ pace
    const projectedAdditionalPrmr = effectivePrmrPerDay * remainingDays;
    const projectedPreExtensionPrmr = effectivePrmrPerDay * preExtensionPlannedDays;
    const projectedExtensionPrmr = effectivePrmrPerDay * extensionPlannedDays;
    
    // Project future FP+ for tier calculation
    const projectedTotalFp = totalFP + (fpPerDay * remainingDays);
    const projectedTier = getTier(projectedTotalFp);
    const projectedPayRate = projectedTier.rate;
    const projectedRentBonus = projectedTier.rentBonus || 0;
    
    // Project total PRMR
    const projectedTotalPrmr = totalPrmr + projectedAdditionalPrmr;
    
    // Projected pay calculations
    const projectedUpfrontPay = calculateUpfrontPay(projectedTotalPrmr);
    const projectedTotalGrossPay = calculateTotalPay(projectedTotalPrmr, projectedPayRate);
    
    // Projected backend splits
    const projectedPreseasonSummerPrmr = preseasonSummerPrmr + projectedPreExtensionPrmr;
    const projectedExtensionPrmrTotal = extensionPrmr + projectedExtensionPrmr;
    
    const projectedPreseasonSummerPay = projectedPreseasonSummerPrmr * projectedPayRate;
    const projectedPreseasonSummerUpfront = projectedPreseasonSummerPrmr * 4;
    const projectedPreseasonSummerBackend = Math.max(0, projectedPreseasonSummerPay - projectedPreseasonSummerUpfront);
    
    const projectedExtensionPay = projectedExtensionPrmrTotal * projectedPayRate;
    const projectedExtensionUpfront = projectedExtensionPrmrTotal * 4;
    const projectedExtensionBackend = Math.max(0, projectedExtensionPay - projectedExtensionUpfront);
    
    const projectedBackend1 = projectedPreseasonSummerBackend * 0.70;
    const projectedBackend2 = (projectedPreseasonSummerBackend * 0.30) + projectedExtensionBackend;
    
    // Deductions
    const rentType = goals?.rent_type || 'No Rent';
    const weeksWorking = goals?.weeks_working || 18;
    const rentCost = getRentCost(rentType, weeksWorking);
    
    // Spending rate calculation
    const fpCount = totalFP;
    const calculatedSpendingRate = fpCount > 0 && totalSpent > 0 
      ? totalSpent / fpCount 
      : 0;
    
    const customRate = goals?.custom_spending_rate;
    const spendingRate = customRate ?? calculatedSpendingRate;
    const dataAccuracy = dealsCount > 0 ? (dealsWithSpending / dealsCount) * 100 : 0;
    
    // Anticipated spending (current + projected)
    const projectedFp = totalFP + (fpPerDay * remainingDays);
    const projectedSpending = spendingRate * projectedFp;
    
    // Net calculations
    const netPay = totalGrossPay - rentCost + rentBonus - totalSpent;
    const projectedNetPay = projectedTotalGrossPay - rentCost + projectedRentBonus - projectedSpending;
    
    return {
      // Current pay breakdown
      upfrontPay,
      backend1,
      backend2,
      totalBackend,
      totalGrossPay,
      
      // Projected pay breakdown
      projectedUpfrontPay,
      projectedBackend1,
      projectedBackend2,
      projectedTotalGrossPay,
      projectedNetPay,
      projectedTotalPrmr,
      projectedPayRate,
      projectedTotalFp,
      
      // Pace info
      prmrPerDay,
      fpPerDay,
      calculatedFpPerDay,
      hasCustomPace: customFpPace !== null && customFpPace !== undefined,
      remainingDays,
      totalKnockingDays,
      
      // Deductions
      rentCost,
      rentBonus,
      projectedRentBonus,
      rentType,
      weeksWorking,
      anticipatedSpending: totalSpent,
      projectedSpending,
      
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
  }, [salesData, fundedPRMR, totalFP, goals, efpModeEnabled, seasonConfig, plannedDays, preseasonKnockingDays]);
  
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
  
  // Custom pace handlers
  const handleSaveCustomPace = useCallback(() => {
    const pace = parseFloat(customPaceInput);
    if (!isNaN(pace) && pace >= 0) {
      updateGoals({ custom_fp_pace: pace });
    }
    setIsEditingPace(false);
    setCustomPaceInput('');
  }, [customPaceInput, updateGoals]);
  
  const handleClearCustomPace = useCallback(() => {
    updateGoals({ custom_fp_pace: null });
    setIsEditingPace(false);
  }, [updateGoals]);
  
  const handleStartPaceEdit = useCallback(() => {
    setCustomPaceInput(metrics?.fpPerDay?.toFixed(2) || '');
    setIsEditingPace(true);
  }, [metrics?.fpPerDay]);
  
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
                    {showProjected ? 'Projected' : 'Current'}: <span className="text-foreground font-bold">{formatCurrency(showProjected ? metrics.projectedNetPay : metrics.netPay)}</span>
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
                    {/* View Toggle */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowProjected(false); }}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                          !showProjected 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        Current
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowProjected(true); }}
                        className={cn(
                          "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all",
                          showProjected 
                            ? "bg-primary text-primary-foreground" 
                            : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        Projected
                      </button>
                    </div>
                    
                    {/* Pace Banner (shown in projected mode) */}
                    {showProjected && metrics.remainingDays > 0 && (
                      <div className="rounded-xl bg-primary/10 p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">
                              {metrics.hasCustomPace ? 'Custom projection' : 'Based on current pace'}
                            </span>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            {isEditingPace ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  type="number"
                                  step="0.1"
                                  value={customPaceInput}
                                  onChange={(e) => setCustomPaceInput(e.target.value)}
                                  className="h-7 w-16 text-right text-sm px-2"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCustomPace();
                                    if (e.key === 'Escape') setIsEditingPace(false);
                                  }}
                                />
                                <span className="text-sm text-muted-foreground">{efpModeEnabled ? 'EFP' : 'FP+'}/day</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={handleSaveCustomPace}
                                >
                                  <Check className="w-3 h-3 text-success" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={() => setIsEditingPace(false)}
                                >
                                  <X className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <div>
                                  <div className="text-sm font-bold">
                                    {metrics.fpPerDay.toFixed(2)} {efpModeEnabled ? 'EFP' : 'FP+'}/day
                                  </div>
                                  <div className="text-[10px] text-muted-foreground">{metrics.remainingDays} days left</div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6"
                                  onClick={(e) => { e.stopPropagation(); handleStartPaceEdit(); }}
                                >
                                  <Pencil className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                        {metrics.hasCustomPace && !isEditingPace && (
                          <div className="mt-2 flex items-center justify-between text-[10px]">
                            <span className="text-muted-foreground">
                              Actual pace: {metrics.calculatedFpPerDay.toFixed(2)} {efpModeEnabled ? 'EFP' : 'FP+'}/day
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 text-[10px] px-2"
                              onClick={(e) => { e.stopPropagation(); handleClearCustomPace(); }}
                            >
                              Reset to actual
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Pay Timeline Section */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Pay Timeline {showProjected && '(Projected)'}
                      </div>
                      <div className="rounded-xl bg-muted/30 p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">💰</span>
                            <span className="text-sm">Upfront Pay (×4)</span>
                          </div>
                          <span className="font-semibold">
                            {formatCurrency(showProjected ? metrics.projectedUpfrontPay : metrics.upfrontPay)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="text-sm">Backend 1 (70%)</span>
                          </div>
                          <span className="font-semibold">
                            {formatCurrency(showProjected ? metrics.projectedBackend1 : metrics.backend1)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">📅</span>
                            <span className="text-sm">Backend 2 (30% + Ext)</span>
                          </div>
                          <span className="font-semibold">
                            {formatCurrency(showProjected ? metrics.projectedBackend2 : metrics.backend2)}
                          </span>
                        </div>
                        <div className="border-t border-border/50 pt-2 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-success" />
                            <span className="text-sm font-medium">Gross Total</span>
                          </div>
                          <span className="font-bold text-success">
                            {formatCurrency(showProjected ? metrics.projectedTotalGrossPay : metrics.totalGrossPay)}
                          </span>
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
                        {(showProjected ? metrics.projectedRentBonus : metrics.rentBonus) > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Gift className="w-4 h-4 text-success" />
                              <span className="text-sm">Rent Bonus</span>
                            </div>
                            <span className="font-semibold text-success">
                              +{formatCurrency(showProjected ? metrics.projectedRentBonus : metrics.rentBonus)}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="text-sm">Spending {showProjected && '(Est.)'}</span>
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
                          <span className="font-semibold text-destructive">
                            -{formatCurrency(showProjected ? metrics.projectedSpending : metrics.anticipatedSpending)}
                          </span>
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
                          <span className="font-bold text-success">
                            {formatCurrency(showProjected ? metrics.projectedNetPay : metrics.netPay)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Summary Stats */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">${showProjected ? metrics.projectedPayRate : metrics.payRate}</div>
                        <div className="text-[10px] text-muted-foreground">/PRMR Rate</div>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">{metrics.totalKnockingDays}</div>
                        <div className="text-[10px] text-muted-foreground">Days Worked</div>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50 text-center">
                        <div className="text-lg font-bold">
                          ${(showProjected ? metrics.projectedTotalPrmr : metrics.totalPrmr).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted-foreground">Total PRMR</div>
                      </div>
                    </div>
                    
                    {/* Tier Upgrade Indicator (projected mode) */}
                    {showProjected && metrics.projectedPayRate > metrics.payRate && (
                      <div className="rounded-xl bg-success/10 p-3 flex items-center gap-3">
                        <TrendingUp className="w-5 h-5 text-success" />
                        <div>
                          <div className="text-sm font-medium text-success">Tier Upgrade Projected!</div>
                          <div className="text-xs text-muted-foreground">
                            ${metrics.payRate} → ${metrics.projectedPayRate}/PRMR at {Math.round(metrics.projectedTotalFp)} FP+
                          </div>
                        </div>
                      </div>
                    )}
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
