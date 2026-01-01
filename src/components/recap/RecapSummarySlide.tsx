import { motion } from 'framer-motion';
import { DollarSign, Target, Calendar, Banknote } from 'lucide-react';
import { RecapStats } from '@/hooks/useRecapData';
import { useRepGoals } from '@/hooks/useRepGoals';
import { useRepData } from '@/hooks/useRepData';

interface RecapSummarySlideProps {
  stats: RecapStats;
}

const PAY_RATES: Record<number, number> = {
  60: 6.50,
  100: 7.00,
  150: 7.50,
  200: 8.00,
  250: 8.50,
  300: 9.00,
};

export function RecapSummarySlide({ stats }: RecapSummarySlideProps) {
  const { goals } = useRepGoals();
  const { repData } = useRepData();
  
  const isRookie = repData?.year === 'Rookie';
  const defaultPayLevel = isRookie ? 60 : 100;
  const payLevel = goals?.custom_payscale_fp ?? defaultPayLevel;
  
  const upfrontPay = stats.totalPrmr * 4;
  const payRate = PAY_RATES[payLevel] || 6.50;
  const totalPay = stats.totalPrmr * payRate;
  
  const maxPay = Math.max(upfrontPay, totalPay);
  const upfrontWidth = maxPay > 0 ? (upfrontPay / maxPay) * 100 : 0;
  const totalWidth = maxPay > 0 ? (totalPay / maxPay) * 100 : 0;

  return (
    <div className="flex flex-col items-center h-full px-6 pt-8 pb-4 overflow-y-auto">
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-4 uppercase tracking-wide"
      >
        {stats.period === 'week' ? "Week's" : "Month's"} Results
      </motion.p>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.3, type: 'spring', duration: 0.6 }}
        className="mb-6"
      >
        <div className="text-6xl font-bold text-green-500 mb-1">
          {stats.totalFpPlus.toFixed(1)}
        </div>
        <p className="text-muted-foreground text-center">FP+</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className="space-y-3 w-full max-w-xs"
      >
        <div className="flex items-center justify-between bg-muted/30 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <DollarSign className="w-5 h-5 text-green-500" />
            <span className="text-muted-foreground">Total PRMR</span>
          </div>
          <span className="text-xl font-semibold">${stats.totalPrmr.toLocaleString()}</span>
        </div>

        <div className="bg-muted/30 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Target className="w-5 h-5 text-blue-500" />
              <span className="text-blue-400 text-sm">Upfront Pay</span>
            </div>
            <span className="text-lg font-semibold text-blue-400">${upfrontPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${upfrontWidth}%` }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="h-full bg-blue-500 rounded-full"
            />
          </div>
        </div>

        <div className="bg-green-500/10 rounded-xl px-4 py-3 border border-green-500/20 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Banknote className="w-5 h-5 text-green-500" />
              <span className="text-green-500 text-sm">Total Pay ({payLevel} FP+)</span>
            </div>
            <span className="text-lg font-bold text-green-500">${totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="h-3 bg-muted/50 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${totalWidth}%` }}
              transition={{ delay: 0.8, duration: 0.5 }}
              className="h-full bg-green-500 rounded-full"
            />
          </div>
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
        className="text-sm text-muted-foreground mt-6"
      >
        Keep pushing! 💪
      </motion.p>
    </div>
  );
}
