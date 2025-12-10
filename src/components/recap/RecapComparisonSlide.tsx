import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface RecapComparisonSlideProps {
  period: 'week' | 'month';
  comparison: {
    doors: number;
    fpPlus: number;
    hoursWorked: number;
    daysWorked: number;
  };
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

export function RecapComparisonSlide({ period, comparison }: RecapComparisonSlideProps) {
  const prevPeriodLabel = period === 'week' ? 'last week' : 'last month';

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-muted-foreground text-lg mb-2 uppercase tracking-wide"
      >
        Compared to {prevPeriodLabel}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="space-y-4 w-full max-w-xs mt-8"
      >
        <TrendIndicator value={comparison.doors} label="Doors" />
        <TrendIndicator value={comparison.fpPlus} label="FP+" />
        <TrendIndicator value={comparison.hoursWorked} label="Hours" />
        <TrendIndicator value={comparison.daysWorked} label="Days Worked" />
      </motion.div>
    </div>
  );
}
