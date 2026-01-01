import { motion } from 'framer-motion';
import { PieChart, DollarSign, Clock, Zap, ArrowUpCircle, TrendingUp } from 'lucide-react';

interface DealBreakdownData {
  totalDeals: number;
  fpDeals: number;
  upgradeDeals: number;
  avgTimeToSell: number | null;
  avgTimeByType: { fp: number | null; upgrade: number | null };
  totalMoneySpent: number;
  avgSpentPerDeal: number;
  hasDetailedData?: boolean;
}

interface RecapDealBreakdownSlideProps {
  dealBreakdown: DealBreakdownData;
}

// Simple donut chart component
function DonutChart({ fpPercent, upgradePercent }: { fpPercent: number; upgradePercent: number }) {
  const radius = 40;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius;
  const fpStroke = (fpPercent / 100) * circumference;
  const upgradeStroke = (upgradePercent / 100) * circumference;
  
  return (
    <div className="relative w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        {/* Background circle */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
        />
        {/* Upgrade segment (blue) */}
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(210, 100%, 60%)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${upgradeStroke} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${upgradeStroke} ${circumference}` }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
        />
        {/* FP segment (green) */}
        <motion.circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="hsl(142, 76%, 45%)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${fpStroke} ${circumference}`}
          strokeDashoffset={-upgradeStroke}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${fpStroke} ${circumference}` }}
          transition={{ delay: 0.7, duration: 0.8, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <PieChart className="w-6 h-6 text-muted-foreground" />
      </div>
    </div>
  );
}

export function RecapDealBreakdownSlide({ dealBreakdown }: RecapDealBreakdownSlideProps) {
  const { totalDeals, fpDeals, upgradeDeals, avgTimeToSell, totalMoneySpent, avgSpentPerDeal, hasDetailedData } = dealBreakdown;
  
  const fpPercent = totalDeals > 0 ? (fpDeals / totalDeals) * 100 : 0;
  const upgradePercent = totalDeals > 0 ? (upgradeDeals / totalDeals) * 100 : 0;
  
  // Show deal type breakdown only if we have actual type data
  const showDealTypes = (fpDeals > 0 || upgradeDeals > 0) && (fpPercent > 0 || upgradePercent > 0);

  return (
    <div className="flex flex-col items-center h-full px-6 pt-8 pb-4 overflow-y-auto">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-4"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <TrendingUp className="w-8 h-8 text-emerald-500" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="text-muted-foreground text-sm mb-1 uppercase tracking-wide"
      >
        Deal Summary
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="text-3xl font-bold mb-6"
      >
        {totalDeals} {totalDeals === 1 ? 'Deal' : 'Deals'}
      </motion.p>

      <div className="w-full max-w-sm space-y-4">
        {/* Deal Mix with Donut Chart - only show if we have type data */}
        {showDealTypes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-muted/30 rounded-2xl p-5"
          >
            <p className="text-sm text-muted-foreground mb-4">Deal Mix</p>
            
            <div className="flex items-center gap-6">
              <DonutChart fpPercent={fpPercent} upgradePercent={upgradePercent} />
              
              <div className="flex-1 space-y-3">
                {/* FP Legend */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm">Fresh/TO</span>
                  </div>
                  <span className="font-bold">{fpDeals}</span>
                </div>
                
                {/* Upgrade Legend */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <ArrowUpCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm">Upgrades</span>
                  </div>
                  <span className="font-bold">{upgradeDeals}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Time to Sell - only show if we have data */}
        {avgTimeToSell !== null && avgTimeToSell > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-muted/30 rounded-2xl p-5"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Avg Time to Sell</p>
                <p className="text-2xl font-bold">{Math.round(avgTimeToSell)} min</p>
              </div>
            </div>
            
            {/* Time by type - only if detailed data exists */}
            {hasDetailedData && (dealBreakdown.avgTimeByType.fp !== null || dealBreakdown.avgTimeByType.upgrade !== null) && (
              <div className="flex gap-3 pt-3 border-t border-muted/50">
                {dealBreakdown.avgTimeByType.fp !== null && dealBreakdown.avgTimeByType.fp > 0 && (
                  <div className="flex-1 bg-emerald-500/10 rounded-xl p-3 text-center">
                    <p className="text-xs text-emerald-400 mb-1">Fresh/TO</p>
                    <p className="font-bold">{Math.round(dealBreakdown.avgTimeByType.fp)}m</p>
                  </div>
                )}
                {dealBreakdown.avgTimeByType.upgrade !== null && dealBreakdown.avgTimeByType.upgrade > 0 && (
                  <div className="flex-1 bg-blue-500/10 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-400 mb-1">Upgrades</p>
                    <p className="font-bold">{Math.round(dealBreakdown.avgTimeByType.upgrade)}m</p>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Money Invested - only show if we have data */}
        {totalMoneySpent > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="bg-muted/30 rounded-2xl p-5"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-bold">${totalMoneySpent.toLocaleString()}</p>
              </div>
            </div>
            
            {totalDeals > 0 && (
              <div className="mt-3 pt-3 border-t border-muted/50 flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg per Deal</span>
                <span className="font-semibold">${avgSpentPerDeal.toFixed(0)}</span>
              </div>
            )}
          </motion.div>
        )}

        {/* Simple deals count if no detailed metrics available */}
        {!showDealTypes && !avgTimeToSell && totalMoneySpent === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-muted/30 rounded-2xl p-6 text-center"
          >
            <Zap className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">
              Great work closing {totalDeals} {totalDeals === 1 ? 'deal' : 'deals'}!
            </p>
            <p className="text-xs text-muted-foreground/70 mt-2">
              Enable detailed CRM logging for more insights
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
