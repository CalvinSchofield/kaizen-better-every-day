import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Target, Calendar, Pencil, Check, X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { hapticLight, hapticSuccess } from '@/utils/haptics';

interface PaceProjectionSectionProps {
  fpPerDay: number;
  calculatedFpPerDay: number;
  hasCustomPace: boolean;
  remainingDays: number;
  projectedTotalFp: number;
  projectedPayRate: number;
  efpModeEnabled: boolean;
  onSavePace: (pace: number) => void;
  onResetPace: () => void;
}

export const PaceProjectionSection = ({
  fpPerDay,
  calculatedFpPerDay,
  hasCustomPace,
  remainingDays,
  projectedTotalFp,
  projectedPayRate,
  efpModeEnabled,
  onSavePace,
  onResetPace,
}: PaceProjectionSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempPace, setTempPace] = useState(fpPerDay);
  const [inputValue, setInputValue] = useState(fpPerDay.toFixed(2));

  const handleStartEdit = useCallback(() => {
    hapticLight();
    setTempPace(fpPerDay);
    setInputValue(fpPerDay.toFixed(2));
    setIsEditing(true);
  }, [fpPerDay]);

  const handleSliderChange = useCallback((value: number[]) => {
    hapticLight();
    const newPace = value[0];
    setTempPace(newPace);
    setInputValue(newPace.toFixed(2));
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      setTempPace(parsed);
    }
  }, []);

  const handleSave = useCallback(() => {
    hapticSuccess();
    onSavePace(tempPace);
    setIsEditing(false);
  }, [tempPace, onSavePace]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setTempPace(fpPerDay);
    setInputValue(fpPerDay.toFixed(2));
  }, [fpPerDay]);

  const handleReset = useCallback(() => {
    hapticLight();
    onResetPace();
    setIsEditing(false);
  }, [onResetPace]);

  // Calculate slider position relative to calculated pace
  const sliderMin = Math.max(0, calculatedFpPerDay - 1);
  const sliderMax = calculatedFpPerDay + 2;
  
  // Determine pace status
  const getPaceStatus = (pace: number) => {
    const diff = pace - calculatedFpPerDay;
    if (Math.abs(diff) < 0.1) return 'neutral';
    return diff > 0 ? 'aggressive' : 'conservative';
  };

  const displayPace = isEditing ? tempPace : fpPerDay;
  const status = getPaceStatus(displayPace);

  return (
    <div className="rounded-xl bg-muted/30 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Projection Settings</span>
        </div>
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleStartEdit}
            className="h-7 px-2 text-xs"
          >
            <Pencil className="w-3 h-3 mr-1" />
            Edit
          </Button>
        )}
      </div>

      {/* Pace Display */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-1">
          <motion.span
            key={displayPace}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-2xl font-bold"
          >
            {displayPace.toFixed(2)}
          </motion.span>
          <span className="text-muted-foreground">{efpModeEnabled ? 'EFP' : 'FP+'}/day</span>
        </div>
        <div className={cn(
          "text-xs",
          status === 'aggressive' && "text-success",
          status === 'conservative' && "text-amber-500",
          status === 'neutral' && "text-muted-foreground"
        )}>
          {hasCustomPace ? 'Custom pace' : 'Your current pace'}
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          {/* Slider */}
          <div className="px-2">
            <Slider
              value={[tempPace]}
              onValueChange={handleSliderChange}
              min={sliderMin}
              max={sliderMax}
              step={0.05}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Conservative</span>
              <span>▲ Your pace</span>
              <span>Aggressive</span>
            </div>
          </div>

          {/* Manual Input */}
          <div className="flex items-center justify-center gap-2">
            <Input
              type="number"
              step="0.1"
              value={inputValue}
              onChange={handleInputChange}
              className="w-24 h-8 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground">{efpModeEnabled ? 'EFP' : 'FP+'}/day</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-center">
            {hasCustomPace && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
            >
              <X className="w-3 h-3 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
            >
              <Check className="w-3 h-3 mr-1" />
              Save
            </Button>
          </div>
        </motion.div>
      )}

      {/* Days Info */}
      <div className="flex items-center justify-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-muted-foreground">
          <Calendar className="w-4 h-4" />
          <span>{remainingDays} days left</span>
        </div>
      </div>

      {/* Projection Result */}
      <div className="rounded-lg bg-primary/10 p-3 text-center">
        <div className="text-sm">
          At this pace, you'll reach <span className="font-bold">{Math.round(projectedTotalFp)} {efpModeEnabled ? 'EFP' : 'FP+'}</span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          That's the <span className="font-medium text-primary">${projectedPayRate}/PRMR</span> tier! 🎯
        </div>
      </div>

      {/* Show actual pace when custom is set */}
      {hasCustomPace && !isEditing && (
        <div className="text-center text-xs text-muted-foreground">
          Actual pace: {calculatedFpPerDay.toFixed(2)} {efpModeEnabled ? 'EFP' : 'FP+'}/day
        </div>
      )}
    </div>
  );
};
