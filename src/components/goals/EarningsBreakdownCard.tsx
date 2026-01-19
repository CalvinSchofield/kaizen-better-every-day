import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRepGoals } from '@/hooks/useRepGoals';
import { useRepData } from '@/hooks/useRepData';
import { usePreseasonFP } from '@/hooks/usePreseasonFP';
import { usePlannedDays } from '@/hooks/usePlannedDays';
import { getTier, getRentCost, formatCurrency } from '@/utils/payscaleCalculator';
import { hapticLight } from '@/utils/haptics';

// Modular components
import { EarningsHeroHeader, EarningsMode } from './earnings/EarningsHeroHeader';
import { PayTimelineChart } from './earnings/PayTimelineChart';
import { NetPayWaterfall } from './earnings/NetPayWaterfall';
import { SpendingRateSheet } from './earnings/SpendingRateSheet';
import { PaceProjectionSection } from './earnings/PaceProjectionSection';
import { TierUpgradeCard } from './earnings/TierUpgradeCard';
import { EarningsInsight } from './earnings/EarningsInsight';
import { EarningsSummaryStats } from './earnings/EarningsSummaryStats';
import { ModelModeContent } from './earnings/ModelModeContent';

interface Sale {
  prmr?: number;
  money_spent?: number;
  type?: string;
  install_status?: string;
  sale_time?: string;
}

// Season date constants
const PRESEASON_START = '2025-09-28';
const SUMMER_START = '2026-04-12';
const EXTENSION_START = '2026-08-30';
const SEASON_END = '2026-09-27';

export const EarningsBreakdownCard = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<EarningsMode>('current');
  const [modelFpGoal, setModelFpGoal] = useState<number | null>(null);
  const [isSpendingSheetOpen, setIsSpendingSheetOpen] = useState(false);
  
  const { goals, updateGoals } = useRepGoals();
  const { repData } = useRepData();
  const { totalFP, fundedPRMR, knockingDays: preseasonKnockingDays } = usePreseasonFP();
  const { plannedDays } = usePlannedDays();
  
  const efpModeEnabled = repData?.efp_mode_enabled ?? false;
  
  // Fetch user's season config
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
  
  // Fetch all sales with spending data
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
      let summerMainPrmr = 0;
      let extensionPrmr = 0;
      let dealsCount = 0;
      let dealsWithSpending = 0;
      let totalKnockingDays = 0;
      let summerKnockingDays = 0; // Track summer knocking days separately
      
      entries?.forEach(entry => {
        const salesLog = entry.sales_log as Sale[] | null;
        const entryDate = entry.entry_date;
        
        const isKnockingDay = (entry.doors_knocked || 0) >= 4 && entry.work_start_time && entry.work_end_time;
        if (isKnockingDay) {
          totalKnockingDays++;
          // Count summer knocking days (April 12 onwards)
          if (entryDate >= SUMMER_START) {
            summerKnockingDays++;
          }
        }
        
        if (salesLog && Array.isArray(salesLog)) {
          salesLog.forEach(sale => {
            if (sale.install_status === 'never_installed') return;
            
            dealsCount++;
            const prmr = sale.prmr || 0;
            const spent = sale.money_spent || 0;
            
            totalPrmr += prmr;
            totalSpent += spent;
            if (spent > 0) dealsWithSpending++;
            
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
        preseasonSummerPrmr: preseasonPrmr + summerMainPrmr,
        dealsCount,
        dealsWithSpending,
        totalKnockingDays,
        summerKnockingDays,
      };
    },
    enabled: !!repData?.user_id,
    staleTime: 5 * 60 * 1000,
  });
  
  // Calculate all metrics
  const metrics = useMemo(() => {
    const totalPrmr = salesData?.totalPrmr || fundedPRMR || 0;
    const preseasonSummerPrmr = salesData?.preseasonSummerPrmr || totalPrmr;
    const extensionPrmr = salesData?.extensionPrmr || 0;
    const totalSpent = salesData?.totalSpent || 0;
    const dealsCount = salesData?.dealsCount || 0;
    const dealsWithSpending = salesData?.dealsWithSpending || 0;
    const totalKnockingDays = salesData?.totalKnockingDays || preseasonKnockingDays || 0;
    const summerKnockingDays = salesData?.summerKnockingDays || 0;
    
    // Check if user is a rookie
    const isRookie = repData?.year === 'Rookie' || repData?.year === '2025' || repData?.year === '2026';
    
    // Check if summer has started for this rep
    const personalSummerStart = seasonConfig?.personal_summer_start;
    const today = new Date();
    const summerStartDate = personalSummerStart ? new Date(personalSummerStart) : new Date(SUMMER_START);
    const isSummerStarted = today >= summerStartDate;
    
    // Calculate FP+ for rookie threshold
    const currentFpForThreshold = totalFP;
    
    // Projections availability logic:
    // - Rookies: 36+ summer knocking days OR 20+ FP+
    // - Everyone else: 18+ summer knocking days
    const rookieProjectionsAvailable = summerKnockingDays >= 36 || currentFpForThreshold >= 20;
    const standardProjectionsAvailable = summerKnockingDays >= 18;
    const projectionsAvailable = isRookie ? rookieProjectionsAvailable : standardProjectionsAvailable;
    
    if (totalPrmr === 0 && totalKnockingDays === 0) return null;
    
    const customPayLevel = goals?.custom_payscale_fp ?? null;
    const targetFpPlus = customPayLevel ?? totalFP;
    const tier = getTier(targetFpPlus);
    const payRate = tier.rate;
    const rentBonus = tier.rentBonus || 0;
    
    // Correct pay calculation:
    // Total Gross = Total PRMR × Rate
    // Upfront = 4 × Total PRMR (paid weekly as installs happen)
    // Backend = Total Gross - Upfront (what's left after upfront is paid)
    // Backend 1 = 70% of (preseason+summer backend) - Late October 2026
    // Backend 2 = 30% of (preseason+summer backend) + 100% extension backend - Late January 2027
    
    const upfrontPay = totalPrmr * 4; // Upfront is 4× PRMR
    const totalGrossPay = totalPrmr * payRate; // Total is PRMR × Rate
    
    // Calculate backend for preseason+summer (before Aug 30)
    const preseasonSummerGross = preseasonSummerPrmr * payRate;
    const preseasonSummerUpfront = preseasonSummerPrmr * 4;
    const preseasonSummerBackend = Math.max(0, preseasonSummerGross - preseasonSummerUpfront);
    
    // Calculate backend for extension period (Aug 30 - Sept 27)
    const extensionGross = extensionPrmr * payRate;
    const extensionUpfront = extensionPrmr * 4;
    const extensionBackend = Math.max(0, extensionGross - extensionUpfront);
    
    // Backend 1 = 70% of preseason+summer backend (Late October 2026)
    const backend1 = preseasonSummerBackend * 0.70;
    // Backend 2 = 30% of preseason+summer backend + 100% of extension backend (Late January 2027)
    const backend2 = (preseasonSummerBackend * 0.30) + extensionBackend;
    
    // Projection calculations
    const todayStr = today.toISOString().split('T')[0];
    
    const personalSummerEnd = seasonConfig?.personal_summer_end || SEASON_END;
    
    const calculatedFpPerDay = totalKnockingDays > 0 ? totalFP / totalKnockingDays : 0;
    
    const customFpPace = goals?.custom_fp_pace ?? null;
    const fpPerDay = customFpPace ?? calculatedFpPerDay;
    
    const futurePlannedDays = plannedDays?.filter(d => d.planned_date > todayStr && d.planned_date <= personalSummerEnd) || [];
    const remainingDays = futurePlannedDays.length;
    
    const extensionPlannedDays = futurePlannedDays.filter(d => d.planned_date >= EXTENSION_START).length;
    const preExtensionPlannedDays = remainingDays - extensionPlannedDays;
    
    const prmrPerFp = totalFP > 0 ? totalPrmr / totalFP : 85;
    const effectivePrmrPerDay = fpPerDay * prmrPerFp;
    
    const projectedAdditionalPrmr = effectivePrmrPerDay * remainingDays;
    const projectedPreExtensionPrmr = effectivePrmrPerDay * preExtensionPlannedDays;
    const projectedExtensionPrmr = effectivePrmrPerDay * extensionPlannedDays;
    
    const projectedTotalFp = totalFP + (fpPerDay * remainingDays);
    const projectedTier = getTier(projectedTotalFp);
    const projectedPayRate = projectedTier.rate;
    const projectedRentBonus = projectedTier.rentBonus || 0;
    
    const projectedTotalPrmr = totalPrmr + projectedAdditionalPrmr;
    
    const projectedUpfrontPay = projectedTotalPrmr * 4;
    const projectedTotalGrossPay = projectedTotalPrmr * projectedPayRate;
    
    const projectedPreseasonSummerPrmr = preseasonSummerPrmr + projectedPreExtensionPrmr;
    const projectedExtensionPrmrTotal = extensionPrmr + projectedExtensionPrmr;
    
    // Projected backend calculations
    const projectedPreseasonSummerGross = projectedPreseasonSummerPrmr * projectedPayRate;
    const projectedPreseasonSummerUpfront = projectedPreseasonSummerPrmr * 4;
    const projectedPreseasonSummerBackend = Math.max(0, projectedPreseasonSummerGross - projectedPreseasonSummerUpfront);
    
    const projectedExtensionGross = projectedExtensionPrmrTotal * projectedPayRate;
    const projectedExtensionUpfront = projectedExtensionPrmrTotal * 4;
    const projectedExtensionBackend = Math.max(0, projectedExtensionGross - projectedExtensionUpfront);
    
    const projectedBackend1 = projectedPreseasonSummerBackend * 0.70;
    const projectedBackend2 = (projectedPreseasonSummerBackend * 0.30) + projectedExtensionBackend;
    
    const rentType = goals?.rent_type || 'No Rent';
    const weeksWorking = goals?.weeks_working || 18;
    
    // Calculate weeks worked so far for "Current" view
    // If preseason, 0 rent. If summer, count weeks since summer start
    let weeksWorkedSoFar = 0;
    if (isSummerStarted) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksSinceSummerStart = Math.floor((today.getTime() - summerStartDate.getTime()) / msPerWeek);
      weeksWorkedSoFar = Math.max(0, Math.min(weeksSinceSummerStart + 1, weeksWorking)); // +1 because first week counts
    }
    
    // Rent for current (actual weeks so far) vs projected (full season)
    const currentRentCost = getRentCost(rentType, weeksWorkedSoFar);
    const projectedRentCost = getRentCost(rentType, weeksWorking);
    
    const calculatedSpendingRate = totalFP > 0 && totalSpent > 0 
      ? totalSpent / totalFP 
      : 0;
    
    const customRate = goals?.custom_spending_rate;
    const spendingRate = customRate ?? calculatedSpendingRate;
    const dataAccuracy = dealsCount > 0 ? (dealsWithSpending / dealsCount) * 100 : 0;
    
    const projectedFp = totalFP + (fpPerDay * remainingDays);
    const projectedSpending = spendingRate * projectedFp;
    
    const netPay = totalGrossPay - currentRentCost + rentBonus - totalSpent;
    const projectedNetPay = projectedTotalGrossPay - projectedRentCost + projectedRentBonus - projectedSpending;
    
    return {
      upfrontPay,
      backend1,
      backend2,
      totalGrossPay,
      projectedUpfrontPay,
      projectedBackend1,
      projectedBackend2,
      projectedTotalGrossPay,
      projectedNetPay,
      projectedTotalPrmr,
      projectedPayRate,
      projectedTotalFp,
      fpPerDay,
      calculatedFpPerDay,
      hasCustomPace: customFpPace !== null && customFpPace !== undefined,
      remainingDays,
      totalKnockingDays,
      summerKnockingDays,
      projectionsAvailable,
      isRookie,
      currentRentCost,
      projectedRentCost,
      rentBonus,
      projectedRentBonus,
      rentType,
      weeksWorking,
      weeksWorkedSoFar,
      anticipatedSpending: totalSpent,
      projectedSpending,
      spendingRate,
      calculatedSpendingRate,
      hasCustomRate: customRate !== null && customRate !== undefined,
      dataAccuracy,
      netPay,
      payRate,
      totalPrmr,
      currentFp: totalFP,
      efpModeEnabled,
      isSummerStarted,
    };
  }, [salesData, fundedPRMR, totalFP, goals, efpModeEnabled, seasonConfig, plannedDays, preseasonKnockingDays]);
  
  const handleSaveSpendingRate = useCallback((rate: number) => {
    updateGoals({ custom_spending_rate: rate });
  }, [updateGoals]);
  
  const handleResetSpendingRate = useCallback(() => {
    updateGoals({ custom_spending_rate: null });
  }, [updateGoals]);
  
  const handleSavePace = useCallback((pace: number) => {
    updateGoals({ custom_fp_pace: pace });
  }, [updateGoals]);
  
  const handleResetPace = useCallback(() => {
    updateGoals({ custom_fp_pace: null });
  }, [updateGoals]);

  const handleToggleOpen = useCallback(() => {
    hapticLight();
    setIsOpen(!isOpen);
  }, [isOpen]);
  
  if (isLoading || !metrics) {
    return null;
  }
  
  // Handle mode-based logic
  const effectiveMode = mode === 'projected' && !metrics.projectionsAvailable ? 'current' : mode;
  
  // Calculate model metrics if in model mode
  const modelMetrics = useMemo(() => {
    if (!modelFpGoal || modelFpGoal <= 0) return null;
    
    const totalPrmr = modelFpGoal * 85;
    const tier = getTier(modelFpGoal);
    const payRate = tier.rate;
    const rentBonus = tier.rentBonus || 0;
    
    const upfrontPay = totalPrmr * 4;
    const totalGrossPay = totalPrmr * payRate;
    const totalBackend = Math.max(0, totalGrossPay - upfrontPay);
    const backend1 = totalBackend * 0.70;
    const backend2 = totalBackend * 0.30;
    
    const rentCost = getRentCost(metrics.rentType, metrics.weeksWorking);
    const anticipatedSpending = metrics.spendingRate * modelFpGoal;
    const netPay = totalGrossPay + rentBonus - rentCost - anticipatedSpending;
    
    return {
      upfrontPay,
      backend1,
      backend2,
      totalGross: totalGrossPay,
      rentBonus,
      rentCost,
      weeksDisplay: metrics.weeksWorking,
      spending: anticipatedSpending,
      netPay,
      payRate,
      totalPrmr,
    };
  }, [modelFpGoal, metrics.rentType, metrics.weeksWorking, metrics.spendingRate]);
  
  const displayMetrics = effectiveMode === 'model' && modelMetrics ? modelMetrics : effectiveMode === 'projected' ? {
    upfrontPay: metrics.projectedUpfrontPay,
    backend1: metrics.projectedBackend1,
    backend2: metrics.projectedBackend2,
    totalGross: metrics.projectedTotalGrossPay,
    rentBonus: metrics.projectedRentBonus,
    rentCost: metrics.projectedRentCost,
    weeksDisplay: metrics.weeksWorking,
    spending: metrics.projectedSpending,
    netPay: metrics.projectedNetPay,
  } : {
    upfrontPay: metrics.upfrontPay,
    backend1: metrics.backend1,
    backend2: metrics.backend2,
    totalGross: metrics.totalGrossPay,
    rentBonus: metrics.rentBonus,
    rentCost: metrics.currentRentCost,
    weeksDisplay: metrics.weeksWorkedSoFar,
    spending: metrics.anticipatedSpending,
    netPay: metrics.netPay,
  };
  
  const efpLabel = metrics.efpModeEnabled ? 'EFP' : 'FP+';
  
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <Card className="border-border/50 overflow-hidden">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger className="w-full" onClick={handleToggleOpen}>
              <EarningsHeroHeader
                netPay={displayMetrics.netPay}
                monthlyExpenses={goals?.monthly_expenses || 0}
                mode={effectiveMode}
                isOpen={isOpen}
                projectionsAvailable={metrics.projectionsAvailable}
                summerKnockingDays={metrics.summerKnockingDays}
                currentFp={metrics.currentFp}
                isRookie={metrics.isRookie}
                isSummerStarted={metrics.isSummerStarted}
                modelFpGoal={modelFpGoal || undefined}
                efpLabel={efpLabel}
                onModeChange={setMode}
              />
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
                    <CardContent className="pt-0 px-4 pb-4 space-y-5">
                      {/* Model Mode Content */}
                      {effectiveMode === 'model' && (
                        <ModelModeContent
                          rentType={metrics.rentType}
                          weeksWorking={metrics.weeksWorking}
                          spendingRate={metrics.spendingRate}
                          efpModeEnabled={metrics.efpModeEnabled}
                          onFpGoalChange={setModelFpGoal}
                        />
                      )}
                      
                      {/* Current/Projected Mode Content */}
                      {effectiveMode !== 'model' && (
                        <>
                          {/* Pace Projection (only in projected mode when projections available) */}
                          {effectiveMode === 'projected' && metrics.remainingDays > 0 && (
                            <PaceProjectionSection
                              fpPerDay={metrics.fpPerDay}
                              calculatedFpPerDay={metrics.calculatedFpPerDay}
                              hasCustomPace={metrics.hasCustomPace}
                              remainingDays={metrics.remainingDays}
                              projectedTotalFp={metrics.projectedTotalFp}
                              projectedPayRate={metrics.projectedPayRate}
                              efpModeEnabled={metrics.efpModeEnabled}
                              onSavePace={handleSavePace}
                              onResetPace={handleResetPace}
                            />
                          )}
                          
                          {/* Pay Timeline */}
                          <PayTimelineChart
                            upfrontPay={displayMetrics.upfrontPay}
                            backend1={displayMetrics.backend1}
                            backend2={displayMetrics.backend2}
                            totalGross={displayMetrics.totalGross}
                            isProjected={effectiveMode === 'projected'}
                          />
                          
                          {/* Net Pay Waterfall */}
                          <NetPayWaterfall
                            grossPay={displayMetrics.totalGross}
                            rentCost={displayMetrics.rentCost}
                            rentBonus={displayMetrics.rentBonus}
                            spending={displayMetrics.spending}
                            netPay={displayMetrics.netPay}
                            weeksWorking={displayMetrics.weeksDisplay}
                            rentType={metrics.rentType}
                            isProjected={effectiveMode === 'projected'}
                            efpModeEnabled={metrics.efpModeEnabled}
                            spendingRate={metrics.spendingRate}
                            hasCustomRate={metrics.hasCustomRate}
                            dataAccuracy={metrics.dataAccuracy}
                            onEditSpendingRate={() => setIsSpendingSheetOpen(true)}
                          />
                          
                          {/* Summary Stats */}
                          <EarningsSummaryStats
                            payRate={metrics.payRate}
                            totalKnockingDays={metrics.totalKnockingDays}
                            totalPrmr={metrics.totalPrmr}
                            isProjected={effectiveMode === 'projected'}
                            projectedPayRate={metrics.projectedPayRate}
                            projectedTotalPrmr={metrics.projectedTotalPrmr}
                          />
                          
                          {/* Tier Upgrade Card - only when projections available */}
                          {effectiveMode === 'projected' && (
                            <TierUpgradeCard
                              currentRate={metrics.payRate}
                              projectedRate={metrics.projectedPayRate}
                              projectedFp={metrics.projectedTotalFp}
                            />
                          )}
                          
                          {/* Dynamic Insight */}
                          <EarningsInsight
                            currentFp={metrics.currentFp}
                            projectedFp={metrics.projectedTotalFp}
                            fpPerDay={metrics.fpPerDay}
                            remainingDays={metrics.remainingDays}
                            currentRate={metrics.payRate}
                            projectedRate={metrics.projectedPayRate}
                            spendingRate={metrics.spendingRate}
                            projectedSpending={metrics.projectedSpending}
                            isProjected={effectiveMode === 'projected'}
                          />
                        </>
                      )}
                    </CardContent>
                  </motion.div>
                </CollapsibleContent>
              )}
            </AnimatePresence>
          </Collapsible>
        </Card>
      </motion.div>
      
      {/* Spending Rate Bottom Sheet */}
      <SpendingRateSheet
        open={isSpendingSheetOpen}
        onOpenChange={setIsSpendingSheetOpen}
        currentRate={metrics.spendingRate}
        calculatedRate={metrics.calculatedSpendingRate}
        hasCustomRate={metrics.hasCustomRate}
        efpModeEnabled={metrics.efpModeEnabled}
        projectedFp={metrics.projectedTotalFp}
        onSave={handleSaveSpendingRate}
        onReset={handleResetSpendingRate}
      />
    </>
  );
};
