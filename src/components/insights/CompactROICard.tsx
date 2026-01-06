import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLongPress } from '@/hooks/useLongPress';
import { PayscalePickerDrawer } from './PayscalePickerDrawer';
import { useRepGoals } from '@/hooks/useRepGoals';
import { getTier } from '@/utils/payscaleCalculator';

interface CompactROICardProps {
  totalSpent: number;
  totalPrmr: number;
  userCumulativeFpPlus: number;
  onRateChange?: (rate: number, roiMode: 'upfront' | 'total') => void;
}

// Total pay multiplier (rough estimate of final commission value vs upfront)
const TOTAL_PAY_MULTIPLIER = 2.5;

export const CompactROICard = ({
  totalSpent,
  totalPrmr,
  userCumulativeFpPlus,
  onRateChange,
}: CompactROICardProps) => {
  const { goals, updateGoals } = useRepGoals();
  
  // Initialize from persisted preferences
  const [roiMode, setRoiMode] = useState<'upfront' | 'total'>(
    (goals?.preferred_roi_mode as 'upfront' | 'total') || 'upfront'
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Get payscale rate
  const customPayLevel = goals?.custom_payscale_fp ?? null;
  const targetFpPlus = customPayLevel ?? userCumulativeFpPlus;
  const currentTier = getTier(targetFpPlus);
  const payscaleRate = currentTier.rate;
  
  // Calculate ROI
  const effectiveRate = roiMode === 'total' ? payscaleRate * TOTAL_PAY_MULTIPLIER : payscaleRate;
  const totalEarnings = totalPrmr * effectiveRate;
  const roi = totalSpent > 0 ? totalEarnings / totalSpent : 0;
  
  // Notify parent of rate changes
  useEffect(() => {
    onRateChange?.(payscaleRate, roiMode);
  }, [payscaleRate, roiMode, onRateChange]);

  // Handle tap to toggle ROI mode
  const handleTap = async () => {
    const newMode = roiMode === 'upfront' ? 'total' : 'upfront';
    setRoiMode(newMode);
    
    // Persist preference
    try {
      await updateGoals({ preferred_roi_mode: newMode } as any);
    } catch {
      // Ignore - preference save failed but local state still works
    }
  };

  // Handle long press to open drawer
  const handleLongPress = () => {
    setDrawerOpen(true);
  };

  // Handle payscale selection
  const handlePayscaleSelect = async (fp: number) => {
    try {
      await updateGoals({ custom_payscale_fp: fp });
    } catch {
      // Ignore - preference save failed but drawer will close anyway
    }
  };

  const longPressHandlers = useLongPress({
    onTap: handleTap,
    onLongPress: handleLongPress,
  });

  if (totalSpent === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="p-4 rounded-2xl bg-warning/10 text-center cursor-pointer active:scale-[0.98] transition-transform touch-manipulation"
        {...longPressHandlers}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${roiMode}-${payscaleRate}`}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            <div className={`text-3xl font-bold ${roi >= 1 ? 'text-success' : 'text-warning'}`}>
              {roi.toFixed(1)}x
            </div>
            <div className="text-sm font-medium mt-0.5">
              {roiMode === 'upfront' ? 'Upfront' : 'Total (~2.5x)'} ROI
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              @ ${payscaleRate}/FP+
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="text-[10px] text-muted-foreground mt-2 opacity-60">
          Tap to toggle • Hold to change tier
        </div>
      </motion.div>

      <PayscalePickerDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        selectedFp={customPayLevel ?? 0}
        currentFp={userCumulativeFpPlus}
        onSelect={handlePayscaleSelect}
      />
    </>
  );
};
