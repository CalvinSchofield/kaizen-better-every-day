import { motion } from 'framer-motion';
import { PieChart, DollarSign, Clock, Zap, ArrowUpCircle, TrendingUp, Target, Trophy, Gauge, Flame, Timer, Coins, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useRepGoals } from '@/hooks/useRepGoals';
import { useRepData } from '@/hooks/useRepData';
import { getTier } from '@/utils/payscaleCalculator';

interface DealHighlight {
  date: string;
  type: string;
  prmr: number;
  moneySpent: number;
  timeToSell: number;
  difficulty?: string;
}

interface SalesByHour {
  hour: number;
  fresh: number;
  takeover: number;
  diy: number;
  upgrade: number;
  total: number;
}

interface DealBreakdownData {
  totalDeals: number;
  fpDeals: number;
  upgradeDeals: number;
  avgTimeToSell: number | null;
  avgTimeByType: { fp: number | null; upgrade: number | null };
  totalMoneySpent: number;
  avgSpentPerDeal: number;
  hasDetailedData?: boolean;
  
  // Extended analytics
  totalPrmr?: number;
  avgPrmrPerDeal?: number;
  avgRoiPerDeal?: number;
  
  dealTypeBreakdown?: {
    fresh: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
    takeover: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
    diy: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
    upgrade: { count: number; totalPrmr: number; totalCost: number; avgTime: number | null; avgDifficulty: number | null };
  };
  
  difficultyDistribution?: { easy: number; medium: number; hard: number };
  avgDifficultyByType?: { fp: number | null; upgrade: number | null };
  
  fastestDeal?: DealHighlight | null;
  slowestDeal?: DealHighlight | null;
  highestPrmrDeal?: DealHighlight | null;
  lowestPrmrDeal?: DealHighlight | null;
  mostExpensiveDeal?: DealHighlight | null;
  earliestFpDeal?: DealHighlight | null;
  latestFpDeal?: DealHighlight | null;
  earliestUpgradeDeal?: DealHighlight | null;
  latestUpgradeDeal?: DealHighlight | null;
  earliestFpPlusDeal?: DealHighlight | null;
  latestFpPlusDeal?: DealHighlight | null;
  
  // Sales by hour for heatmap
  salesByHourAndType?: SalesByHour[];
  hasSaleTimeData?: boolean;
}

interface RecapDealBreakdownSlideProps {
  dealBreakdown: DealBreakdownData;
}

// Pay rates by FP level for quick lookup
const PAY_RATES: Record<number, number> = {
  60: 6.50,
  100: 7.00,
  150: 7.50,
  200: 8.00,
  250: 8.50,
  300: 9.00,
};

// Simple donut chart component
function DonutChart({ fpPercent, upgradePercent }: { fpPercent: number; upgradePercent: number }) {
  const radius = 36;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius;
  const fpStroke = (fpPercent / 100) * circumference;
  const upgradeStroke = (upgradePercent / 100) * circumference;
  
  return (
    <div className="relative w-24 h-24">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <motion.circle
          cx="50" cy="50" r={radius} fill="none"
          stroke="hsl(210, 100%, 60%)"
          strokeWidth={strokeWidth}
          strokeDasharray={`${upgradeStroke} ${circumference}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          initial={{ strokeDasharray: `0 ${circumference}` }}
          animate={{ strokeDasharray: `${upgradeStroke} ${circumference}` }}
          transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
        />
        <motion.circle
          cx="50" cy="50" r={radius} fill="none"
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
        <PieChart className="w-5 h-5 text-muted-foreground" />
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
}

function DifficultyBar({ easy, medium, hard }: { easy: number; medium: number; hard: number }) {
  const total = easy + medium + hard;
  if (total === 0) return null;
  
  const easyPct = (easy / total) * 100;
  const mediumPct = (medium / total) * 100;
  const hardPct = (hard / total) * 100;
  
  return (
    <div className="w-full h-2 rounded-full bg-muted/50 overflow-hidden flex">
      <motion.div 
        className="h-full bg-green-500" 
        initial={{ width: 0 }}
        animate={{ width: `${easyPct}%` }}
        transition={{ delay: 0.3, duration: 0.5 }}
      />
      <motion.div 
        className="h-full bg-yellow-500" 
        initial={{ width: 0 }}
        animate={{ width: `${mediumPct}%` }}
        transition={{ delay: 0.4, duration: 0.5 }}
      />
      <motion.div 
        className="h-full bg-red-500" 
        initial={{ width: 0 }}
        animate={{ width: `${hardPct}%` }}
        transition={{ delay: 0.5, duration: 0.5 }}
      />
    </div>
  );
}

export function RecapDealBreakdownSlide({ dealBreakdown }: RecapDealBreakdownSlideProps) {
  const { goals } = useRepGoals();
  const { repData } = useRepData();
  
  const { 
    totalDeals, fpDeals, upgradeDeals, avgTimeToSell, totalMoneySpent, avgSpentPerDeal, hasDetailedData,
    totalPrmr, avgPrmrPerDeal, dealTypeBreakdown, difficultyDistribution,
    fastestDeal, slowestDeal, highestPrmrDeal, mostExpensiveDeal, 
    earliestFpPlusDeal, latestFpPlusDeal, salesByHourAndType, hasSaleTimeData
  } = dealBreakdown;
  
  // Calculate pay-based ROI using user's pay level setting
  const isRookie = repData?.year === 'Rookie';
  const defaultPayLevel = isRookie ? 60 : 100;
  const payLevel = goals?.custom_payscale_fp ?? defaultPayLevel;
  const payRate = PAY_RATES[payLevel] || getTier(payLevel).rate;
  
  const upfrontPay = (totalPrmr || 0) * 4;
  const totalPay = (totalPrmr || 0) * payRate;
  const upfrontRoi = totalMoneySpent > 0 ? upfrontPay / totalMoneySpent : 0;
  const payRoi = totalMoneySpent > 0 ? totalPay / totalMoneySpent : 0;
  
  const fpPercent = totalDeals > 0 ? (fpDeals / totalDeals) * 100 : 0;
  const upgradePercent = totalDeals > 0 ? (upgradeDeals / totalDeals) * 100 : 0;
  const showDealTypes = (fpDeals > 0 || upgradeDeals > 0);

  return (
    <div className="flex flex-col items-center h-full px-4 pt-6 pb-4 overflow-y-auto">
      {/* Header */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="mb-3"
      >
        <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center">
          <TrendingUp className="w-7 h-7 text-emerald-500" />
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-muted-foreground text-xs mb-0.5 uppercase tracking-wide"
      >
        Deal Analytics
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold mb-4"
      >
        {totalDeals} {totalDeals === 1 ? 'Deal' : 'Deals'}
      </motion.p>

      <div className="w-full max-w-sm space-y-3">
        {/* Hero Stats Row - Total PRMR, Total Invested, and DUAL ROI */}
        {hasDetailedData && totalPrmr !== undefined && totalPrmr > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="space-y-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-emerald-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-emerald-400 mb-0.5">Total PRMR</p>
                <p className="text-lg font-bold text-emerald-400">${totalPrmr.toLocaleString()}</p>
              </div>
              <div className="bg-orange-500/10 rounded-xl p-3 text-center">
                <p className="text-[10px] text-orange-400 mb-0.5">Total Invested</p>
                <p className="text-lg font-bold text-orange-400">${totalMoneySpent.toLocaleString()}</p>
              </div>
            </div>
            
            {/* Dual ROI Cards */}
            {totalMoneySpent > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-blue-500/10 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-blue-400 mb-0.5">Upfront ROI</p>
                  <p className="text-lg font-bold text-blue-400">{upfrontRoi.toFixed(1)}x</p>
                  <p className="text-[9px] text-muted-foreground">PRMR × 4 = ${((totalPrmr || 0) * 4).toLocaleString()}</p>
                </div>
                <div className="bg-green-500/10 rounded-xl p-3 text-center border border-green-500/20">
                  <p className="text-[10px] text-green-400 mb-0.5">Pay ROI ({payLevel} FP+)</p>
                  <p className="text-lg font-bold text-green-400">{payRoi.toFixed(1)}x</p>
                  <p className="text-[9px] text-muted-foreground">${totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })} total</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Deal Mix with Donut Chart */}
        {showDealTypes && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-muted/30 rounded-2xl p-4"
          >
            <div className="flex items-center gap-4">
              <DonutChart fpPercent={fpPercent} upgradePercent={upgradePercent} />
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <Zap className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs">FP</span>
                  </div>
                  <span className="font-bold text-sm">{fpDeals}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <ArrowUpCircle className="w-3.5 h-3.5 text-blue-500" />
                    <span className="text-xs">Upgrades</span>
                  </div>
                  <span className="font-bold text-sm">{upgradeDeals}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Deal Type Breakdown with ROI, Time, Difficulty */}
        {hasDetailedData && dealTypeBreakdown && (dealTypeBreakdown.fresh.count > 0 || dealTypeBreakdown.takeover.count > 0 || dealTypeBreakdown.diy.count > 0 || dealTypeBreakdown.upgrade.count > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-muted/30 rounded-2xl p-4"
          >
            <p className="text-xs text-muted-foreground mb-3">Deal Type Breakdown</p>
            <div className="space-y-2">
              {/* Fresh */}
              {dealTypeBreakdown.fresh.count > 0 && (
                <div className="bg-green-500/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-green-400">Fresh</span>
                    <span className="font-bold text-sm">{dealTypeBreakdown.fresh.count}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>${dealTypeBreakdown.fresh.totalPrmr} PRMR</span>
                    {dealTypeBreakdown.fresh.totalCost > 0 && (
                      <span>{(dealTypeBreakdown.fresh.totalPrmr / dealTypeBreakdown.fresh.totalCost).toFixed(1)}x ROI</span>
                    )}
                    {dealTypeBreakdown.fresh.avgTime && <span>{Math.round(dealTypeBreakdown.fresh.avgTime)}m avg</span>}
                    {dealTypeBreakdown.fresh.avgDifficulty && (
                      <span className={dealTypeBreakdown.fresh.avgDifficulty < 1.5 ? 'text-green-400' : dealTypeBreakdown.fresh.avgDifficulty > 2.5 ? 'text-red-400' : 'text-yellow-400'}>
                        {dealTypeBreakdown.fresh.avgDifficulty < 1.5 ? 'Easy' : dealTypeBreakdown.fresh.avgDifficulty > 2.5 ? 'Hard' : 'Med'}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Takeover */}
              {dealTypeBreakdown.takeover.count > 0 && (
                <div className="bg-amber-500/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-amber-400">Takeover</span>
                    <span className="font-bold text-sm">{dealTypeBreakdown.takeover.count}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>${dealTypeBreakdown.takeover.totalPrmr} PRMR</span>
                    {dealTypeBreakdown.takeover.totalCost > 0 && (
                      <span>{(dealTypeBreakdown.takeover.totalPrmr / dealTypeBreakdown.takeover.totalCost).toFixed(1)}x ROI</span>
                    )}
                    {dealTypeBreakdown.takeover.avgTime && <span>{Math.round(dealTypeBreakdown.takeover.avgTime)}m avg</span>}
                    {dealTypeBreakdown.takeover.avgDifficulty && (
                      <span className={dealTypeBreakdown.takeover.avgDifficulty < 1.5 ? 'text-green-400' : dealTypeBreakdown.takeover.avgDifficulty > 2.5 ? 'text-red-400' : 'text-yellow-400'}>
                        {dealTypeBreakdown.takeover.avgDifficulty < 1.5 ? 'Easy' : dealTypeBreakdown.takeover.avgDifficulty > 2.5 ? 'Hard' : 'Med'}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* DIY */}
              {dealTypeBreakdown.diy.count > 0 && (
                <div className="bg-cyan-500/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-cyan-400">DIY</span>
                    <span className="font-bold text-sm">{dealTypeBreakdown.diy.count}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>${dealTypeBreakdown.diy.totalPrmr} PRMR</span>
                    {dealTypeBreakdown.diy.totalCost > 0 && (
                      <span>{(dealTypeBreakdown.diy.totalPrmr / dealTypeBreakdown.diy.totalCost).toFixed(1)}x ROI</span>
                    )}
                    {dealTypeBreakdown.diy.avgTime && <span>{Math.round(dealTypeBreakdown.diy.avgTime)}m avg</span>}
                    {dealTypeBreakdown.diy.avgDifficulty && (
                      <span className={dealTypeBreakdown.diy.avgDifficulty < 1.5 ? 'text-green-400' : dealTypeBreakdown.diy.avgDifficulty > 2.5 ? 'text-red-400' : 'text-yellow-400'}>
                        {dealTypeBreakdown.diy.avgDifficulty < 1.5 ? 'Easy' : dealTypeBreakdown.diy.avgDifficulty > 2.5 ? 'Hard' : 'Med'}
                      </span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Upgrade */}
              {dealTypeBreakdown.upgrade.count > 0 && (
                <div className="bg-blue-500/10 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-400">Upgrade</span>
                    <span className="font-bold text-sm">{dealTypeBreakdown.upgrade.count}</span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>${dealTypeBreakdown.upgrade.totalPrmr} PRMR</span>
                    {dealTypeBreakdown.upgrade.totalCost > 0 && (
                      <span>{(dealTypeBreakdown.upgrade.totalPrmr / dealTypeBreakdown.upgrade.totalCost).toFixed(1)}x ROI</span>
                    )}
                    {dealTypeBreakdown.upgrade.avgTime && <span>{Math.round(dealTypeBreakdown.upgrade.avgTime)}m avg</span>}
                    {dealTypeBreakdown.upgrade.avgDifficulty && (
                      <span className={dealTypeBreakdown.upgrade.avgDifficulty < 1.5 ? 'text-green-400' : dealTypeBreakdown.upgrade.avgDifficulty > 2.5 ? 'text-red-400' : 'text-yellow-400'}>
                        {dealTypeBreakdown.upgrade.avgDifficulty < 1.5 ? 'Easy' : dealTypeBreakdown.upgrade.avgDifficulty > 2.5 ? 'Hard' : 'Med'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Time & Cost Comparison */}
        {hasDetailedData && (avgTimeToSell || totalMoneySpent > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="grid grid-cols-2 gap-2"
          >
            {avgTimeToSell !== null && avgTimeToSell > 0 && (
              <div className="bg-muted/30 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Avg Time</p>
                    <p className="text-lg font-bold">{Math.round(avgTimeToSell)}m</p>
                  </div>
                </div>
                {dealBreakdown.avgTimeByType && (dealBreakdown.avgTimeByType.fp || dealBreakdown.avgTimeByType.upgrade) && (
                  <div className="flex gap-1.5 text-[10px]">
                    {dealBreakdown.avgTimeByType.fp && (
                      <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">FP: {Math.round(dealBreakdown.avgTimeByType.fp)}m</span>
                    )}
                    {dealBreakdown.avgTimeByType.upgrade && (
                      <span className="bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">UPG: {Math.round(dealBreakdown.avgTimeByType.upgrade)}m</span>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {totalMoneySpent > 0 && (
              <div className="bg-muted/30 rounded-2xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                    <Coins className="w-4 h-4 text-orange-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Avg Cost</p>
                    <p className="text-lg font-bold">${avgSpentPerDeal.toFixed(0)}</p>
                  </div>
                </div>
                {avgPrmrPerDeal !== undefined && avgPrmrPerDeal > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    Avg PRMR: <span className="text-emerald-400 font-medium">${avgPrmrPerDeal.toFixed(0)}</span>
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* When You Close - Heatmap */}
        {hasDetailedData && hasSaleTimeData && salesByHourAndType && (() => {
          const hoursWithData = salesByHourAndType.filter(h => h.total > 0);
          if (hoursWithData.length === 0) return null;
          
          const maxTotal = Math.max(...hoursWithData.map(h => h.total));
          const hoursActive = hoursWithData.map(h => h.hour);
          const minHour = Math.max(0, Math.min(...hoursActive) - 1);
          const maxHour = Math.min(23, Math.max(...hoursActive) + 1);
          
          const displayHours = salesByHourAndType.filter(h => h.hour >= minHour && h.hour <= maxHour);
          
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="bg-muted/30 rounded-2xl p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">When You Close</p>
              </div>
              
              {/* Hour grid */}
              <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${displayHours.length}, 1fr)` }}>
                {displayHours.map(hourData => {
                  const intensity = hourData.total > 0 ? Math.max(0.15, hourData.total / maxTotal) : 0;
                  
                  return (
                    <div key={hourData.hour} className="text-center">
                      <div 
                        className="h-10 rounded-lg flex flex-col items-center justify-center relative overflow-hidden"
                        style={{ 
                          backgroundColor: hourData.total > 0 
                            ? `hsl(var(--primary) / ${intensity})` 
                            : 'hsl(var(--muted) / 0.3)'
                        }}
                      >
                        {hourData.total > 0 && (
                          <>
                            <span className="text-xs font-bold">{hourData.total}</span>
                            {/* Stacked bar showing breakdown */}
                            <div className="flex h-1 w-full absolute bottom-0 left-0">
                              {hourData.fresh > 0 && (
                                <div 
                                  className="bg-primary h-full"
                                  style={{ flex: hourData.fresh }}
                                />
                              )}
                              {hourData.takeover > 0 && (
                                <div 
                                  className="bg-success h-full"
                                  style={{ flex: hourData.takeover }}
                                />
                              )}
                              {hourData.diy > 0 && (
                                <div 
                                  className="bg-warning h-full"
                                  style={{ flex: hourData.diy }}
                                />
                              )}
                              {hourData.upgrade > 0 && (
                                <div 
                                  className="bg-muted-foreground h-full"
                                  style={{ flex: hourData.upgrade }}
                                />
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">
                        {hourData.hour === 0 ? '12a' : 
                         hourData.hour < 12 ? `${hourData.hour}a` : 
                         hourData.hour === 12 ? '12p' : 
                         `${hourData.hour - 12}p`}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex flex-wrap gap-2 justify-center mt-2 text-[9px]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-primary" />
                  <span className="text-muted-foreground">Fresh</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-success" />
                  <span className="text-muted-foreground">Takeover</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-warning" />
                  <span className="text-muted-foreground">DIY</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-muted-foreground" />
                  <span className="text-muted-foreground">Upgrade</span>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* Difficulty Distribution */}
        {hasDetailedData && difficultyDistribution && (difficultyDistribution.easy + difficultyDistribution.medium + difficultyDistribution.hard > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-muted/30 rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Difficulty</p>
            </div>
            <DifficultyBar {...difficultyDistribution} />
            <div className="flex justify-between mt-2 text-[10px]">
              <span className="text-green-400">{difficultyDistribution.easy} Easy</span>
              <span className="text-yellow-400">{difficultyDistribution.medium} Medium</span>
              <span className="text-red-400">{difficultyDistribution.hard} Hard</span>
            </div>
          </motion.div>
        )}

        {/* Record Highlights */}
        {hasDetailedData && (fastestDeal || highestPrmrDeal || mostExpensiveDeal) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            className="bg-muted/30 rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <p className="text-xs text-muted-foreground">Highlights</p>
            </div>
            <div className="space-y-2">
              {fastestDeal && (
                <div className="flex items-center justify-between bg-green-500/10 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <Timer className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-xs">Fastest Close</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-green-400">{Math.round(fastestDeal.timeToSell)}m</span>
                    <p className="text-[10px] text-muted-foreground">{formatDate(fastestDeal.date)}</p>
                  </div>
                </div>
              )}
              {slowestDeal && slowestDeal.timeToSell !== fastestDeal?.timeToSell && (
                <div className="flex items-center justify-between bg-red-500/10 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-xs">Longest Battle</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-red-400">{Math.round(slowestDeal.timeToSell)}m</span>
                    <p className="text-[10px] text-muted-foreground">{formatDate(slowestDeal.date)}</p>
                  </div>
                </div>
              )}
              {highestPrmrDeal && (
                <div className="flex items-center justify-between bg-emerald-500/10 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs">Highest PRMR</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-emerald-400">${highestPrmrDeal.prmr}</span>
                    <p className="text-[10px] text-muted-foreground">{formatDate(highestPrmrDeal.date)} • {highestPrmrDeal.type}</p>
                  </div>
                </div>
              )}
              {mostExpensiveDeal && (
                <div className="flex items-center justify-between bg-orange-500/10 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs">Most Invested</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-sm text-orange-400">${mostExpensiveDeal.moneySpent}</span>
                    <p className="text-[10px] text-muted-foreground">{formatDate(mostExpensiveDeal.date)}</p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* First & Last FP+ Deals */}
        {hasDetailedData && (earliestFpPlusDeal || latestFpPlusDeal) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-muted/30 rounded-2xl p-4"
          >
            <p className="text-xs text-muted-foreground mb-3">First & Last FP+</p>
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              {earliestFpPlusDeal && (
                <div className="bg-primary/10 rounded-lg p-2">
                  <p className="text-primary mb-0.5">First FP+</p>
                  <p className="font-semibold">{formatDate(earliestFpPlusDeal.date)}</p>
                  <p className="text-muted-foreground">
                    {earliestFpPlusDeal.type} {earliestFpPlusDeal.prmr > 0 && `• $${earliestFpPlusDeal.prmr}`}
                  </p>
                </div>
              )}
              {latestFpPlusDeal && latestFpPlusDeal.date !== earliestFpPlusDeal?.date && (
                <div className="bg-primary/10 rounded-lg p-2">
                  <p className="text-primary mb-0.5">Last FP+</p>
                  <p className="font-semibold">{formatDate(latestFpPlusDeal.date)}</p>
                  <p className="text-muted-foreground">
                    {latestFpPlusDeal.type} {latestFpPlusDeal.prmr > 0 && `• $${latestFpPlusDeal.prmr}`}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Fallback if no detailed data */}
        {!hasDetailedData && totalDeals > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-muted/30 rounded-2xl p-5 text-center"
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
