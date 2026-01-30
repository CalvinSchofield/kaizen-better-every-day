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
import { ExternalLink, Receipt, ArrowRight, RotateCcw } from 'lucide-react';
import { motion } from 'framer-motion';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

const SOURCE_EARNINGS_URL = 'https://curator.vivint.com/dashboard/source-accountdetailsearnings';

interface SpendingOverrideSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackedSpending: number;
  currentOverride: number | null;
  dealsCount: number;
  onSave: (amount: number | null) => void;
  efpModeEnabled: boolean;
  totalFp: number;
  totalPrmr: number;
  isSaving?: boolean;
}

export const SpendingOverrideSheet = ({
  open,
  onOpenChange,
  trackedSpending,
  currentOverride,
  dealsCount,
  onSave,
  efpModeEnabled,
  totalFp,
  totalPrmr,
  isSaving = false,
}: SpendingOverrideSheetProps) => {
  const [inputValue, setInputValue] = useState('');
  
  // Initialize input with current override when sheet opens
  useEffect(() => {
    if (open) {
      if (currentOverride && currentOverride > 0) {
        setInputValue(currentOverride.toString());
      } else {
        setInputValue('');
      }
    }
  }, [open, currentOverride]);

  const parsedValue = useMemo(() => {
    const val = parseFloat(inputValue);
    return isNaN(val) || val < 0 ? null : val;
  }, [inputValue]);

  // Calculate effective spending (max of tracked vs override)
  const effectiveSpending = useMemo(() => {
    if (parsedValue === null) return trackedSpending;
    return Math.max(trackedSpending, parsedValue);
  }, [parsedValue, trackedSpending]);

  // Calculate metrics with new spending
  const metrics = useMemo(() => {
    const fpMetric = totalFp || 1;
    const currentAvgCost = trackedSpending / fpMetric;
    const newAvgCost = effectiveSpending / fpMetric;
    
    const currentNetUpfront = (totalPrmr * 4) - trackedSpending;
    const newNetUpfront = (totalPrmr * 4) - effectiveSpending;
    
    return {
      currentAvgCost,
      newAvgCost,
      currentNetUpfront,
      newNetUpfront,
      hasChange: effectiveSpending !== trackedSpending,
    };
  }, [trackedSpending, effectiveSpending, totalFp, totalPrmr]);

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
            <Receipt className="h-5 w-5 text-primary" />
            Total Season Spending
          </DrawerTitle>
          <DrawerDescription>
            Override your tracked spending to include buyouts, promos, and other costs not logged per-deal.
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 space-y-5 pb-4 overflow-y-auto">
          {/* Tracked spending display */}
          <div className="p-4 rounded-xl bg-muted/50 space-y-1">
            <div className="text-sm text-muted-foreground">Your tracked spending</div>
            <div className="text-2xl font-bold">${trackedSpending.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">
              from {dealsCount} {dealsCount === 1 ? 'deal' : 'deals'} logged
            </div>
          </div>

          {/* Override input */}
          <div className="space-y-2">
            <Label htmlFor="spending-override" className="text-sm font-medium">
              Actual Total Spent
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="spending-override"
                type="number"
                inputMode="decimal"
                placeholder="e.g., 2,340"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="text-xl h-14 text-center pl-8"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your total amount spent on buyouts, promos, free months, etc.
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

          {/* Live preview of changes */}
          {metrics.hasChange && parsedValue !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl border border-border bg-card space-y-3"
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

          {/* Current override indicator */}
          {currentOverride && currentOverride > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 text-sm">
              <span className="text-muted-foreground">Current override: ${currentOverride.toLocaleString()}</span>
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
            disabled={isSaving || (parsedValue === null && !currentOverride)}
            className="w-full"
          >
            {isSaving ? 'Saving...' : 'Save Adjustment'}
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
