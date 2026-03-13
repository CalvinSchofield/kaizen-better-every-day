/**
 * SeasonGoalsPreview - Now powered by UnifiedGoalProgress
 * 
 * Drop-in replacement for the Track page pre-working state.
 */

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { UnifiedGoalProgress } from '@/components/goals/UnifiedGoalProgress';
import { useGoalPaceCalculator } from '@/hooks/useGoalPaceCalculator';
import { FPCumulativeChart } from '@/components/FPCumulativeChart';
import { motion, AnimatePresence } from 'framer-motion';
import { hapticLight } from '@/utils/haptics';

interface SeasonGoalsPreviewProps {
  className?: string;
}

export const SeasonGoalsPreview = ({ className }: SeasonGoalsPreviewProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const data = useGoalPaceCalculator();

  if (data.isLoading) {
    return (
      <Card className={`p-4 border-border/50 ${className}`}>
        <Skeleton className="h-16 w-full" />
      </Card>
    );
  }

  if (!data.hasGoals) return null;

  return (
    <div className={className}>
      <button
        onClick={() => { hapticLight(); setIsExpanded(!isExpanded); }}
        className="w-full text-left"
      >
        <UnifiedGoalProgress
          data={data}
          mode="compact"
          compactTimeframes={['Y']}
          showPaceContext={true}
        />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-border/30 mt-4">
              <FPCumulativeChart inline />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
