import { motion } from 'framer-motion';
import { PieChart, DollarSign, Clock, Zap, ArrowUpCircle } from 'lucide-react';

interface DealBreakdownData {
  totalDeals: number;
  fpDeals: number;
  upgradeDeals: number;
  avgTimeToSell: number | null;
  avgTimeByType: { fp: number | null; upgrade: number | null };
  totalMoneySpent: number;
  avgSpentPerDeal: number;
}

interface RecapDealBreakdownSlideProps {
  dealBreakdown: DealBreakdownData;
}

export function RecapDealBreakdownSlide({ dealBreakdown }: RecapDealBreakdownSlideProps) {
  const { totalDeals, fpDeals, upgradeDeals, avgTimeToSell, totalMoneySpent, avgSpentPerDeal, avgTimeByType } = dealBreakdown;
  
  const fpPercent = totalDeals > 0 ? (fpDeals / totalDeals) * 100 : 0;
  const upgradePercent = totalDeals > 0 ? (upgradeDeals / totalDeals) * 100 : 0;

  return (
    <div className="flex flex-col items-center h-full px-6 pt-8 pb-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-4"
      >
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <PieChart className="w-8 h-8 text-green-500" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-1 uppercase tracking-wide"
      >
        Deal Breakdown
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-2xl font-bold mb-6"
      >
        {totalDeals} {totalDeals === 1 ? 'Deal' : 'Deals'}
      </motion.p>

      <div className="w-full max-w-sm space-y-4">
        {/* Deal Type Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-muted/30 rounded-xl p-4 space-y-3"
        >
          <p className="text-sm text-muted-foreground mb-2">Deal Types</p>
          
          {/* FP Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-500" />
                <span>Fresh/Takeover</span>
              </div>
              <span className="font-medium">{fpDeals} ({Math.round(fpPercent)}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${fpPercent}%` }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="h-full bg-green-500 rounded-full"
              />
            </div>
          </div>

          {/* Upgrade Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                <span>Upgrades</span>
              </div>
              <span className="font-medium">{upgradeDeals} ({Math.round(upgradePercent)}%)</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${upgradePercent}%` }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="h-full bg-blue-500 rounded-full"
              />
            </div>
          </div>
        </motion.div>

        {/* Time to Sell */}
        {avgTimeToSell !== null && avgTimeToSell > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-muted/30 rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-purple-400" />
                <span className="text-muted-foreground text-sm">Avg Time to Sell</span>
              </div>
              <span className="text-xl font-semibold">{Math.round(avgTimeToSell)} min</span>
            </div>
            
            {/* Time by type breakdown */}
            {(avgTimeByType.fp !== null || avgTimeByType.upgrade !== null) && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-muted">
                {avgTimeByType.fp !== null && avgTimeByType.fp > 0 && (
                  <div className="flex-1 text-center">
                    <p className="text-xs text-green-400">Fresh/Takeover</p>
                    <p className="font-semibold">{Math.round(avgTimeByType.fp)} min</p>
                  </div>
                )}
                {avgTimeByType.upgrade !== null && avgTimeByType.upgrade > 0 && (
                  <div className="flex-1 text-center">
                    <p className="text-xs text-blue-400">Upgrades</p>
                    <p className="font-semibold">{Math.round(avgTimeByType.upgrade)} min</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Money Spent */}
        {totalMoneySpent > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-muted/30 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-orange-400" />
                <span className="text-muted-foreground text-sm">Total Invested</span>
              </div>
              <span className="text-xl font-semibold">${totalMoneySpent.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-muted">
              <span className="text-xs text-muted-foreground">Avg per Deal</span>
              <span className="text-sm font-medium">${avgSpentPerDeal.toFixed(2)}</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
