import { useState, useMemo } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Check, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { hapticLight } from "@/utils/haptics";

interface CancelRateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRate: number; // decimal e.g. 0.15
  actualCancelRate?: number | null; // decimal, calculated from real data
  efpModeEnabled: boolean;
  onSave: (rate: number) => Promise<void>; // decimal
}

export const CancelRateDrawer = ({
  open,
  onOpenChange,
  currentRate,
  actualCancelRate,
  efpModeEnabled,
  onSave,
}: CancelRateDrawerProps) => {
  const [mode, setMode] = useState<'custom' | 'actual'>('custom');
  const [sliderValue, setSliderValue] = useState(Math.round(currentRate * 1000) / 10); // e.g. 15.0
  const [isSaving, setIsSaving] = useState(false);

  const metricLabel = efpModeEnabled ? "EFP" : "FP";

  // Reset state when drawer opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      const currentPct = Math.round(currentRate * 1000) / 10;
      setSliderValue(currentPct);
      // If current rate matches actual rate, default to actual mode
      if (actualCancelRate != null && Math.abs(currentRate - actualCancelRate) < 0.005) {
        setMode('actual');
      } else {
        setMode('custom');
      }
    }
    onOpenChange(isOpen);
  };

  const effectiveRate = mode === 'actual' && actualCancelRate != null
    ? actualCancelRate
    : sliderValue / 100;

  const displayPct = mode === 'actual' && actualCancelRate != null
    ? (actualCancelRate * 100).toFixed(1)
    : sliderValue.toFixed(1);

  const hasChanged = Math.abs(effectiveRate - currentRate) >= 0.001;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Race against a timeout to prevent infinite "Saving..." on TestFlight
      const savePromise = onSave(effectiveRate);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Save timed out')), 8000)
      );
      await Promise.race([savePromise, timeoutPromise]);
      onOpenChange(false);
    } catch (err) {
      console.error('CancelRateDrawer save error:', err);
      // Still close — optimistic update already applied by useRepGoals
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const actualRatePct = actualCancelRate != null ? (actualCancelRate * 100).toFixed(1) : null;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Cancel / Unfunded Buffer</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-6">
          {/* Explanation */}
          <p className="text-sm text-muted-foreground">
            This buffer adjusts your {metricLabel} goals upward to account for cancellations and unfunded accounts. 
            A {displayPct}% buffer means you need to sell more to hit your net goal.
          </p>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setMode('custom'); hapticLight(); }}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm",
                mode === 'custom'
                  ? "border-primary bg-primary/5"
                  : "border-muted bg-muted/30"
              )}
            >
              <span className="font-semibold">Custom Rate</span>
              <span className="text-xs text-muted-foreground">Set manually</span>
            </button>
            <button
              onClick={() => { 
                if (actualCancelRate != null) {
                  setMode('actual'); 
                  hapticLight(); 
                }
              }}
              disabled={actualCancelRate == null}
              className={cn(
                "flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-sm",
                mode === 'actual'
                  ? "border-primary bg-primary/5"
                  : "border-muted bg-muted/30",
                actualCancelRate == null && "opacity-50 cursor-not-allowed"
              )}
            >
              <span className="font-semibold flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" />
                My Actual Rate
              </span>
              <span className="text-xs text-muted-foreground">
                {actualRatePct != null ? `${actualRatePct}%` : "No data yet"}
              </span>
            </button>
          </div>

          {/* Custom slider */}
          {mode === 'custom' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Buffer percentage</span>
                <span className="text-2xl font-bold tabular-nums">
                  {sliderValue.toFixed(1)}%
                </span>
              </div>
              <Slider
                value={[sliderValue]}
                onValueChange={([v]) => setSliderValue(Math.round(v * 10) / 10)}
                min={0}
                max={25}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>25%</span>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2">
                {[5, 10, 15, 20].map(preset => (
                  <button
                    key={preset}
                    onClick={() => { setSliderValue(preset); hapticLight(); }}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                      Math.abs(sliderValue - preset) < 0.05
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {preset}%
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actual rate details */}
          {mode === 'actual' && actualCancelRate != null && (
            <div className="bg-muted/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your actual cancel/unfunded rate</span>
                <span className="text-2xl font-bold tabular-nums">{actualRatePct}%</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Based on your tracked {metricLabel} data — total vs funded accounts this season.
              </p>
            </div>
          )}

          {/* Save button */}
          <Button
            onClick={handleSave}
            disabled={!hasChanged || isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              "Saving..."
            ) : hasChanged ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save {displayPct}% Buffer
              </>
            ) : (
              "No changes"
            )}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
