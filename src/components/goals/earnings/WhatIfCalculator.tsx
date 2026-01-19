import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calculator, Sparkles, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getTier, getRentCost, formatCurrency } from '@/utils/payscaleCalculator';
import { hapticLight, hapticMedium } from '@/utils/haptics';

interface WhatIfCalculatorProps {
  currentFp: number;
  avgPrmrPerFp: number;
  rentType: string;
  weeksWorking: number;
  spendingRate: number;
  efpModeEnabled: boolean;
}

export const WhatIfCalculator = ({
  currentFp,
  avgPrmrPerFp,
  rentType,
  weeksWorking,
  spendingRate,
  efpModeEnabled,
}: WhatIfCalculatorProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customFpGoal, setCustomFpGoal] = useState<string>('');

  const fpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  const handleToggle = useCallback(() => {
    hapticLight();
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomFpGoal(value);
  }, []);

  const handlePreset = useCallback((value: number) => {
    hapticMedium();
    setCustomFpGoal(value.toString());
  }, []);

  const scenario = useMemo(() => {
    const fpGoal = parseInt(customFpGoal) || 0;
    if (fpGoal <= 0) return null;

    // Calculate total PRMR based on FP goal and avg PRMR per FP
    const totalPrmr = fpGoal * avgPrmrPerFp;
    
    // Get tier based on FP+
    const tier = getTier(fpGoal);
    const payRate = tier.rate;
    const rentBonus = tier.rentBonus || 0;
    
    // Pay calculations
    const upfrontPay = totalPrmr * 4;
    const totalGrossPay = totalPrmr * payRate;
    const totalBackend = Math.max(0, totalGrossPay - upfrontPay);
    const backend1 = totalBackend * 0.70;
    const backend2 = totalBackend * 0.30;
    
    // Deductions
    const rentCost = getRentCost(rentType, weeksWorking);
    const anticipatedSpending = spendingRate * fpGoal;
    
    // Net pay
    const netPay = totalGrossPay + rentBonus - rentCost - anticipatedSpending;
    
    return {
      fpGoal,
      totalPrmr,
      tier,
      payRate,
      rentBonus,
      upfrontPay,
      backend1,
      backend2,
      totalGrossPay,
      rentCost,
      anticipatedSpending,
      netPay,
    };
  }, [customFpGoal, avgPrmrPerFp, rentType, weeksWorking, spendingRate]);

  const presets = [100, 150, 200, 300, 500];

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Calculator className="w-4 h-4 text-primary" />
          </div>
          <div className="text-left">
            <span className="text-sm font-medium">What If Calculator</span>
            <p className="text-xs text-muted-foreground">
              See earnings for any {fpLabel} goal
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Input Section */}
              <div className="space-y-3">
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder={`Enter ${fpLabel} goal (e.g., 500)`}
                    value={customFpGoal}
                    onChange={handleInputChange}
                    className="text-lg font-semibold text-center pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {fpLabel}
                  </span>
                </div>
                
                {/* Quick Presets */}
                <div className="flex gap-2 flex-wrap">
                  {presets.map((preset) => (
                    <Button
                      key={preset}
                      variant={customFpGoal === preset.toString() ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handlePreset(preset)}
                      className="flex-1 min-w-[3.5rem]"
                    >
                      {preset}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Results */}
              <AnimatePresence mode="wait">
                {scenario && (
                  <motion.div
                    key={scenario.fpGoal}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    {/* Tier & Rate Banner */}
                    <div className="rounded-lg bg-gradient-to-r from-primary/20 to-primary/5 p-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs text-muted-foreground uppercase">Tier Rate</div>
                        <div className="text-xl font-bold text-primary">
                          ${scenario.payRate.toFixed(2)}/PRMR
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground uppercase">Total PRMR</div>
                        <div className="text-lg font-semibold">
                          {scenario.totalPrmr.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Pay Timeline */}
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Pay Timeline
                      </div>
                      
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center py-1.5 px-2 rounded-md bg-success/10">
                          <span className="text-sm">Upfront (×4)</span>
                          <span className="font-semibold text-success">
                            {formatCurrency(scenario.upfrontPay)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 px-2 rounded-md bg-primary/10">
                          <span className="text-sm">Backend 1 (70%)</span>
                          <span className="font-semibold text-primary">
                            {formatCurrency(scenario.backend1)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center py-1.5 px-2 rounded-md bg-primary/5">
                          <span className="text-sm">Backend 2 (30%)</span>
                          <span className="font-semibold text-primary/80">
                            {formatCurrency(scenario.backend2)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-success" />
                          <span className="font-medium">Gross Total</span>
                        </div>
                        <span className="font-bold text-lg text-success">
                          {formatCurrency(scenario.totalGrossPay)}
                        </span>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Deductions
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Rent ({weeksWorking} wks)</span>
                          <span className="text-destructive">-{formatCurrency(scenario.rentCost)}</span>
                        </div>
                        {scenario.rentBonus > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Rent Bonus</span>
                            <span className="text-success">+{formatCurrency(scenario.rentBonus)}</span>
                          </div>
                        )}
                        {scenario.anticipatedSpending > 0 && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Spending Est.</span>
                            <span className="text-destructive">-{formatCurrency(scenario.anticipatedSpending)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Net Pay Hero */}
                    <motion.div
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      className="rounded-xl bg-gradient-to-br from-success/20 via-success/10 to-transparent p-4 text-center"
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Sparkles className="w-4 h-4 text-success" />
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Net Take-Home Pay
                        </span>
                      </div>
                      <motion.div
                        key={scenario.netPay}
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        className="text-3xl font-bold text-success"
                      >
                        {formatCurrency(scenario.netPay)}
                      </motion.div>
                      <div className="text-xs text-muted-foreground mt-1">
                        at {scenario.fpGoal} {fpLabel}
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Empty State */}
              {!scenario && (
                <div className="text-center py-6 text-muted-foreground">
                  <Calculator className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Enter a {fpLabel} goal to see projections</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
