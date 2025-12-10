import { motion } from 'framer-motion';
import { DollarSign, Target, Calendar } from 'lucide-react';
import { RecapStats } from '@/hooks/useRecapData';

interface RecapSummarySlideProps {
  stats: RecapStats;
}

export function RecapSummarySlide({ stats }: RecapSummarySlideProps) {
  const anticipatedPay = stats.totalPrmr * 4;

  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8">
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-muted-foreground text-lg mb-4 uppercase tracking-wide"
      >
        {stats.period === 'week' ? "Week's" : "Month's"} Results
      </motion.p>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', duration: 0.6 }}
        className="mb-8"
      >
        <div className="text-6xl font-bold text-green-500 mb-1">
          {stats.totalFpPlus.toFixed(1)}
        </div>
        <p className="text-muted-foreground">FP+</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="space-y-4 w-full max-w-xs"
      >
        <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-muted-foreground">Total PRMR</span>
          </div>
          <span className="text-xl font-semibold">${stats.totalPrmr.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between bg-green-500/10 rounded-xl px-4 py-3 border border-green-500/20">
          <div className="flex items-center gap-3">
            <Target className="w-5 h-5 text-green-500" />
            <span className="text-green-500">Anticipated Pay</span>
          </div>
          <span className="text-xl font-bold text-green-500">${anticipatedPay.toLocaleString()}</span>
        </div>

        <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <span className="text-muted-foreground">Days Worked</span>
          </div>
          <span className="text-xl font-semibold">{stats.daysWorked}</span>
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
        className="text-sm text-muted-foreground mt-10"
      >
        Keep pushing! 💪
      </motion.p>
    </div>
  );
}
