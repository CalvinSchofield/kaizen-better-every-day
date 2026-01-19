import { motion } from 'framer-motion';
import { Lightbulb, TrendingUp, TrendingDown, Target, DollarSign } from 'lucide-react';
import { getTier } from '@/utils/payscaleCalculator';

interface EarningsInsightProps {
  currentFp: number;
  projectedFp: number;
  fpPerDay: number;
  remainingDays: number;
  currentRate: number;
  projectedRate: number;
  spendingRate: number;
  projectedSpending: number;
  isProjected: boolean;
}

export const EarningsInsight = ({
  currentFp,
  projectedFp,
  fpPerDay,
  remainingDays,
  currentRate,
  projectedRate,
  spendingRate,
  projectedSpending,
  isProjected,
}: EarningsInsightProps) => {
  // Generate the most relevant insight based on current state
  const getInsight = () => {
    // Check if near tier boundary
    const nextTier = getTier(currentFp + 1);
    const fpToNextTier = findFpToNextTier(currentFp, currentRate);
    
    // If close to next tier (within 5 FP+)
    if (fpToNextTier > 0 && fpToNextTier <= 5) {
      return {
        icon: Target,
        message: `Just ${fpToNextTier} more FP+ to unlock the $${nextTier.rate}/PRMR rate!`,
        type: 'opportunity' as const,
      };
    }

    // If projected tier is higher than current
    if (isProjected && projectedRate > currentRate) {
      const additionalEarnings = (projectedFp * (projectedRate - currentRate)) * 85 / projectedRate;
      return {
        icon: TrendingUp,
        message: `Your pace leads to ~$${Math.round(additionalEarnings).toLocaleString()} extra from tier upgrade!`,
        type: 'positive' as const,
      };
    }

    // If spending is high
    if (spendingRate > 60) {
      const savingsIfReduced = (spendingRate - 40) * (projectedFp - currentFp);
      return {
        icon: DollarSign,
        message: `Cutting spending by $20/deal = $${Math.round(savingsIfReduced)} more take-home`,
        type: 'tip' as const,
      };
    }

    // If few days remaining but good pace
    if (remainingDays < 30 && fpPerDay > 1) {
      return {
        icon: TrendingUp,
        message: `${remainingDays} days at ${fpPerDay.toFixed(1)}/day = ${Math.round(fpPerDay * remainingDays)} more FP+!`,
        type: 'positive' as const,
      };
    }

    // Default insight about projected total
    return {
      icon: Lightbulb,
      message: `Projected to finish with ${Math.round(projectedFp)} FP+ this season`,
      type: 'neutral' as const,
    };
  };

  const insight = getInsight();
  const IconComponent = insight.icon;

  const typeStyles = {
    positive: 'bg-success/10 text-success border-success/20',
    opportunity: 'bg-primary/10 text-primary border-primary/20',
    tip: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    neutral: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className={`rounded-lg border p-3 flex items-center gap-3 ${typeStyles[insight.type]}`}
    >
      <IconComponent className="w-4 h-4 flex-shrink-0" />
      <span className="text-xs">{insight.message}</span>
    </motion.div>
  );
};

// Helper function to find FP+ needed to reach next tier
function findFpToNextTier(currentFp: number, currentRate: number): number {
  const checkPoints = [10, 20, 30, 40, 50, 60, 70, 80, 100, 125, 150];
  
  for (const point of checkPoints) {
    if (point > currentFp) {
      const tierAtPoint = getTier(point);
      if (tierAtPoint.rate > currentRate) {
        return point - Math.floor(currentFp);
      }
    }
  }
  
  return 0;
}
