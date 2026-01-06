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

// Upfront pay is always 4x for all reps
const UPFRONT_MULTIPLIER = 4;
const HINT_STORAGE_KEY = 'hasSeenROIHint';

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
  const [showHint, setShowHint] = useState(false);
  
  // Check if user has seen the hint
  useEffect(() => {
    const hasSeen = localStorage.getItem(HINT_STORAGE_KEY);
    if (!hasSeen) {
      setShowHint(true);
      // Mark as seen after animation completes
      const timer = setTimeout(() => {
        localStorage.setItem(HINT_STORAGE_KEY, 'true');
        setShowHint(false);
      }, 4500); // 3 pulses × 1.5s each
      return () => clearTimeout(timer);
    }
  }, []);
  
  // Sync roiMode when goals load
  useEffect(() => {
    if (goals?.preferred_roi_mode) {
      setRoiMode(goals.preferred_roi_mode as 'upfront' | 'total');
    }
  }, [goals?.preferred_roi_mode]);
  
  // Get payscale rate (for total pay)
  const customPayLevel = goals?.custom_payscale_fp ?? null;
  const targetFpPlus = customPayLevel ?? userCumulativeFpPlus;
  const currentTier = getTier(targetFpPlus);
  const payscaleRate = currentTier.rate;
  
  // Calculate ROI
  // Upfront is always $4/FP+ for all reps, Total varies by tier
  const effectiveRate = roiMode === 'upfront' ? UPFRONT_MULTIPLIER : payscaleRate;
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
        whileTap={{ scale: 0.92 }}
        className={`p-3 h-full rounded-2xl bg-warning/10 text-center cursor-pointer touch-manipulation flex flex-col justify-center ${showHint ? 'animate-pulse-ring' : ''}`}
        {...longPressHandlers}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={`${roiMode}-${effectiveRate}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className={`text-2xl font-bold ${roi >= 1 ? 'text-success' : 'text-warning'}`}>
              {roi.toFixed(1)}x
            </div>
            <div className="text-xs text-muted-foreground">
              {roiMode === 'upfront' ? 'Upfront' : 'Total'} ROI
            </div>
            <div className="mt-1 flex justify-center">
              <span className="px-2 py-0.5 rounded-full bg-background/60 text-[10px] font-medium text-muted-foreground border border-border/40">
                ${effectiveRate.toFixed(0)}/FP+
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
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
