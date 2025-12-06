import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Plus, Minus, DollarSign, TrendingUp, Package } from "lucide-react";
import { Sale } from "@/hooks/useDailyEntry";

interface SalesBreakdownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalPrmr: number;
  initialFpCount: number;
  initialUpgradePrmr: number;
  onConfirm: (sales: Sale[]) => void;
}

export const SalesBreakdownSheet = ({
  open,
  onOpenChange,
  totalPrmr,
  initialFpCount,
  initialUpgradePrmr,
  onConfirm,
}: SalesBreakdownSheetProps) => {
  const [fpCount, setFpCount] = useState(initialFpCount);
  const [fpPrmrs, setFpPrmrs] = useState<number[]>([]);
  const [upgradePrmr, setUpgradePrmr] = useState(initialUpgradePrmr);

  // Initialize/reset when sheet opens
  useEffect(() => {
    if (open) {
      setFpCount(initialFpCount);
      setUpgradePrmr(initialUpgradePrmr);
      
      // Initialize FP PRMRs - distribute remaining PRMR evenly
      const remainingPrmr = totalPrmr - initialUpgradePrmr;
      const avgPrmr = initialFpCount > 0 ? Math.round(remainingPrmr / initialFpCount) : 85;
      setFpPrmrs(Array(initialFpCount).fill(avgPrmr));
    }
  }, [open, initialFpCount, initialUpgradePrmr, totalPrmr]);

  // Update FP PRMR array when count changes
  useEffect(() => {
    if (fpPrmrs.length < fpCount) {
      // Add new entries with default $85
      const newPrmrs = [...fpPrmrs];
      while (newPrmrs.length < fpCount) {
        newPrmrs.push(85);
      }
      setFpPrmrs(newPrmrs);
    } else if (fpPrmrs.length > fpCount) {
      // Remove excess entries
      setFpPrmrs(fpPrmrs.slice(0, fpCount));
    }
  }, [fpCount, fpPrmrs.length]);

  const handleFpPrmrChange = (index: number, value: string) => {
    const newPrmrs = [...fpPrmrs];
    newPrmrs[index] = parseFloat(value) || 0;
    setFpPrmrs(newPrmrs);
  };

  // Calculate totals
  const fpPrmrTotal = fpPrmrs.reduce((sum, p) => sum + p, 0);
  const calculatedTotalPrmr = fpPrmrTotal + upgradePrmr;
  const calculatedFpPlus = fpCount + (upgradePrmr / 85);

  const handleConfirm = () => {
    const now = new Date();
    const generatedSales: Sale[] = [];

    // Generate FP sales
    fpPrmrs.forEach((prmr, index) => {
      generatedSales.push({
        id: crypto.randomUUID(),
        type: 'fp',
        prmr: prmr,
        timestamp: now.toISOString(),
        installed_same_day: true,
        install_status: 'installed',
      });
    });

    // Generate upgrade sale if applicable
    if (upgradePrmr > 0) {
      generatedSales.push({
        id: crypto.randomUUID(),
        type: 'upgrade',
        prmr: upgradePrmr,
        timestamp: now.toISOString(),
        installed_same_day: true,
        install_status: 'installed',
      });
    }

    onConfirm(generatedSales);
    onOpenChange(false);
  };

  const isValid = fpCount > 0 || upgradePrmr > 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Break Down Your Sales
          </DrawerTitle>
          <DrawerDescription>
            Specify how many FP sales and upgrades you made, with PRMR for each
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 space-y-6 overflow-y-auto max-h-[60vh]">
          {/* FP Count Stepper */}
          <div className="space-y-3">
            <Label className="text-base font-medium">New Account Sales (FP)</Label>
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setFpCount(Math.max(0, fpCount - 1))}
                disabled={fpCount === 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-3xl font-bold min-w-[3rem] text-center">{fpCount}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={() => setFpCount(fpCount + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Individual FP PRMR Inputs */}
          {fpCount > 0 && (
            <div className="space-y-3">
              <Label className="text-sm text-muted-foreground">PRMR for each FP sale</Label>
              <div className="space-y-2">
                {fpPrmrs.map((prmr, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground w-16">
                      FP #{index + 1}
                    </span>
                    <div className="relative flex-1">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={prmr || ''}
                        onChange={(e) => handleFpPrmrChange(index, e.target.value)}
                        className="pl-8"
                        placeholder="85"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upgrade PRMR */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <Label className="text-base font-medium">Upgrade PRMR</Label>
              <span className="text-xs text-muted-foreground">(optional)</span>
            </div>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={upgradePrmr || ''}
                onChange={(e) => setUpgradePrmr(parseFloat(e.target.value) || 0)}
                className="pl-8"
                placeholder="0"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Total upgrade revenue (avg ~$40 per upgrade)
            </p>
          </div>

          {/* Summary */}
          <div className="p-4 bg-accent/50 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">FP PRMR Total</span>
              <span className="font-medium">${fpPrmrTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Upgrade PRMR</span>
              <span className="font-medium">${upgradePrmr.toFixed(2)}</span>
            </div>
            <div className="border-t border-border pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-medium">Total PRMR</span>
                <span className="font-bold">${calculatedTotalPrmr.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-primary">
                <span className="font-medium">Total FP+</span>
                <span className="font-bold">{calculatedFpPlus.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <DrawerFooter className="pt-2">
          <Button 
            onClick={handleConfirm} 
            disabled={!isValid}
            className="w-full"
          >
            Confirm Sales Breakdown
          </Button>
          <Button 
            variant="outline" 
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
