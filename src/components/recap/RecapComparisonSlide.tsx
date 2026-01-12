import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BarChart3 } from 'lucide-react';

interface RecapComparisonSlideProps {
  period: 'week' | 'month';
  comparison: {
    doors: number;
    fpPlus: number;
    hoursWorked: number;
    daysWorked: number;
  };
  efpModeEnabled?: boolean;
}

function TrendIndicator({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3"
    >
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {isNeutral ? (
          <>
            <Minus className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Same</span>
          </>
        ) : isPositive ? (
          <>
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-green-500 font-medium">+{Math.round(value)}%</span>
          </>
        ) : (
          <>
            <TrendingDown className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-medium">{Math.round(value)}%</span>
          </>
        )}
      </div>
    </motion.div>
  );
}

export function RecapComparisonSlide({ period, comparison, efpModeEnabled }: RecapComparisonSlideProps) {
  const prevPeriodLabel = period === 'week' ? 'last week' : 'last month';
  const fpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  return (
    <div className="flex flex-col items-center h-full px-6 pt-8 pb-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-4"
      >
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-primary" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-1 uppercase tracking-wide"
      >
        Compared to {prevPeriodLabel}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="space-y-3 w-full max-w-xs mt-6"
      >
        <TrendIndicator value={comparison.doors} label="Doors" />
        <TrendIndicator value={comparison.fpPlus} label={fpLabel} />
        <TrendIndicator value={comparison.hoursWorked} label="Hours" />
        <TrendIndicator value={comparison.daysWorked} label="Days Worked" />
      </motion.div>
    </div>
  );
}
