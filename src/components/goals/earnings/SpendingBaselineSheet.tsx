import { useState, useEffect, useMemo } from 'react';
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle, 
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Wallet, ArrowRight, RotateCcw, Plus, Equal } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

const SOURCE_EARNINGS_URL = 'https://curator.vivint.com/dashboard/source-accountdetailsearnings';

interface SpendingBaselineSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedSpending: number;
  currentBaseline: number | null;
  dealsCount: number;
  onSave: (amount: number | null) => void;
  efpModeEnabled: boolean;
  totalFp: number;
  totalPrmr: number;
  isSaving?: boolean;
}

export const SpendingBaselineSheet = ({
  open,
  onOpenChange,
  trackedSpending,
  currentBaseline,
  dealsCount,
  onSave,
  efpModeEnabled,
  totalFp,
  totalPrmr,
  isSaving = false,
}: SpendingBaselineSheetProps) => {
  // Debug logging for React error #310
  console.log('[SpendingBaselineSheet] Props:', {
    open,
    trackedSpending,
    currentBaseline,
    dealsCount,
    efpModeEnabled,
    totalFp,
    totalPrmr,
    isSaving,
    typeOfCurrentBaseline: typeof currentBaseline,
    typeOfTotalFp: typeof totalFp,
    typeOfTotalPrmr: typeof totalPrmr,
  });
  
  const [inputValue, setInputValue] = useState('');
  
  // Initialize input with current baseline when sheet opens
  useEffect(() => {
    if (open) {
      if (currentBaseline && currentBaseline > 0) {
        setInputValue(currentBaseline.toString());
      } else {
        setInputValue('');
      }
    }
  }, [open, currentBaseline]);

  const parsedValue = useMemo(() => {
    const val = parseFloat(inputValue);
    return isNaN(val) || val < 0 ? null : val;
  }, [inputValue]);

  // Calculate total spending (additive: baseline + tracked)
  const baselineValue = parsedValue ?? 0;
  const totalSpending = baselineValue + trackedSpending;

  // Calculate metrics with new total spending
  const metrics = useMemo(() => {
    const fpMetric = totalFp || 1;
    
    // Current state (with existing baseline if any)
    const existingBaseline = currentBaseline ?? 0;
    const currentTotal = existingBaseline + trackedSpending;
    const currentAvgCost = currentTotal / fpMetric;
    const currentNetUpfront = (totalPrmr * 4) - currentTotal;
    
    // New state (with input baseline)
    const newAvgCost = totalSpending / fpMetric;
    const newNetUpfront = (totalPrmr * 4) - totalSpending;
    
    const hasChange = baselineValue !== existingBaseline;
    
    return {
      currentAvgCost,
      newAvgCost,
      currentNetUpfront,
      newNetUpfront,
      hasChange,
    };
  }, [trackedSpending, totalSpending, totalFp, totalPrmr, baselineValue, currentBaseline]);

  const handleSave = () => {
    hapticSuccess();
    onSave(parsedValue);
  };

  const handleReset = () => {
    hapticLight();
    setInputValue('');
  };

  const handleClear = () => {
    hapticLight();
    onSave(null);
  };

  const metricLabel = efpModeEnabled ? 'EFP' : 'FP+';

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Spending Baseline
          </DrawerTitle>
          <DrawerDescription>
            Enter spending from before you started tracking per-deal costs. This will be added to your tracked spending.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-5 pb-4 overflow-y-auto">
          {/* Pre-tracking baseline input */}
          <div className="space-y-2">
            <Label htmlFor="spending-baseline" className="text-sm font-medium">
              Pre-Tracking Spending
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="spending-baseline"
                type="number"
                inputMode="decimal"
                placeholder="e.g., 465"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="text-xl h-14 text-center pl-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Buyouts, promos, free months, etc. from before you started logging costs per deal.
            </p>
          </div>

          {/* Link to Source */}
          <button
            className="flex items-center gap-2 text-sm text-primary hover:underline w-full"
            onClick={() => window.open(SOURCE_EARNINGS_URL, '_blank')}
          >
            <ExternalLink className="h-4 w-4" />
            Check your buyouts on Source
          </button>

          {/* Calculation breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl border border-border bg-card space-y-3"
          >
            <div className="text-sm font-medium text-muted-foreground">Season Spending Calculation</div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Pre-tracking baseline</span>
                <span className="font-semibold">${baselineValue.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-center py-1">
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tracked spending ({dealsCount} deals)</span>
                <span className="font-semibold">${trackedSpending.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center justify-center py-1">
                <Equal className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="flex items-center justify-between text-sm border-t border-border pt-2">
                <span className="font-medium">Total Season Spending</span>
                <span className="text-lg font-bold text-primary">${totalSpending.toLocaleString()}</span>
              </div>
            </div>
          </motion.div>

          {/* Live preview of changes (only show if there's a meaningful change) */}
          {metrics.hasChange && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-muted/50 space-y-3"
            >
              <div className="text-sm font-medium text-muted-foreground">Your adjusted totals:</div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Avg Cost/{metricLabel}</span>
                  <div className="flex items-center gap-2">
                    <span>${metrics.currentAvgCost.toFixed(2)}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold">${metrics.newAvgCost.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Net Upfront</span>
                  <div className="flex items-center gap-2">
                    <span>${metrics.currentNetUpfront.toLocaleString()}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className={`font-semibold ${metrics.newNetUpfront < metrics.currentNetUpfront ? 'text-warning' : ''}`}>
                      ${metrics.newNetUpfront.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Current baseline indicator */}
          {currentBaseline && currentBaseline > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 text-sm">
              <span className="text-muted-foreground">Current baseline: ${currentBaseline.toLocaleString()}</span>
              <button 
                onClick={handleClear}
                className="text-primary hover:underline flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Clear
              </button>
            </div>
          )}
        </div>

        <DrawerFooter className="pt-2">
          <Button 
            onClick={handleSave} 
            disabled={isSaving || (parsedValue === null && !currentBaseline)}
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save Baseline'}
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
