import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Check, RotateCcw } from 'lucide-react';
import { hapticLight, hapticSuccess } from '@/utils/haptics';
import { cn } from '@/lib/utils';

interface SpendingRateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentRate: number;
  calculatedRate: number;
  hasCustomRate: boolean;
  efpModeEnabled: boolean;
  projectedFp: number;
  onSave: (rate: number) => void;
  onReset: () => void;
}

const PRESET_RATES = [
  { label: 'Frugal', value: 30, emoji: '🪙' },
  { label: 'Average', value: 50, emoji: '💵' },
  { label: 'Heavy', value: 80, emoji: '💸' },
];

export const SpendingRateSheet = ({
  open,
  onOpenChange,
  currentRate,
  calculatedRate,
  hasCustomRate,
  efpModeEnabled,
  projectedFp,
  onSave,
  onReset,
}: SpendingRateSheetProps) => {
  const [rate, setRate] = useState(currentRate || 50);
  const [inputValue, setInputValue] = useState(currentRate?.toString() || '50');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const projectedSpending = rate * projectedFp;

  const handleSliderChange = useCallback((value: number[]) => {
    hapticLight();
    setRate(value[0]);
    setInputValue(value[0].toString());
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 200) {
      setRate(parsed);
    }
  }, []);

  const handlePresetClick = useCallback((value: number) => {
    hapticLight();
    setRate(value);
    setInputValue(value.toString());
  }, []);

  const handleSave = useCallback(() => {
    hapticSuccess();
    onSave(rate);
    onOpenChange(false);
  }, [rate, onSave, onOpenChange]);

  const handleReset = useCallback(() => {
    hapticLight();
    onReset();
    onOpenChange(false);
  }, [onReset, onOpenChange]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-8">
        <SheetHeader className="pb-4">
          <SheetTitle>Spending Rate</SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Main Rate Display */}
          <div className="text-center py-4">
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl font-bold">${rate.toFixed(0)}</span>
              <span className="text-lg text-muted-foreground">/{efpModeEnabled ? 'EFP' : 'FP+'}</span>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              Projected total: <span className="font-medium text-foreground">{formatCurrency(projectedSpending)}</span>
            </div>
          </div>

          {/* Slider */}
          <div className="px-2">
            <Slider
              value={[rate]}
              onValueChange={handleSliderChange}
              min={0}
              max={150}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>$0</span>
              <span>$75</span>
              <span>$150</span>
            </div>
          </div>

          {/* Preset Chips */}
          <div className="flex gap-2 justify-center">
            {PRESET_RATES.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset.value)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  "border active:scale-95",
                  rate === preset.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted/50 border-border hover:bg-muted"
                )}
              >
                {preset.emoji} {preset.label}
              </button>
            ))}
          </div>

          {/* Manual Input */}
          <div className="flex items-center gap-3 px-4">
            <span className="text-sm text-muted-foreground">Or enter:</span>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                value={inputValue}
                onChange={handleInputChange}
                className="w-20 h-9 text-center"
              />
            </div>
          </div>

          {/* Calculated Rate Reference */}
          {calculatedRate > 0 && (
            <div className="text-center text-xs text-muted-foreground">
              Your tracked rate: ${calculatedRate.toFixed(0)}/{efpModeEnabled ? 'EFP' : 'FP+'}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            {hasCustomRate && (
              <Button
                variant="outline"
                onClick={handleReset}
                className="flex-1 gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </Button>
            )}
            <Button
              onClick={handleSave}
              className={cn("gap-2", hasCustomRate ? "flex-1" : "w-full")}
            >
              <Check className="w-4 h-4" />
              Save
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
