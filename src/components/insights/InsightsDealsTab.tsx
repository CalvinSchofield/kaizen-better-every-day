import { useState } from 'react';
import { DollarSign, Clock, TrendingUp, Zap, Award, Target, ArrowRight, CalendarCheck, MapPin, Flame, Sparkles, Banknote } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useCustomerInsights, DealHighlight } from '@/hooks/useCustomerInsights';
import { InsightsSectionHeader } from './InsightsSectionHeader';
import { useNavigate } from 'react-router-dom';
import { useRepGoals } from '@/hooks/useRepGoals';
import { useRepData } from '@/hooks/useRepData';
import { useEfpMode } from '@/hooks/useEfpMode';
import { motion } from 'framer-motion';
import { format, parseISO } from 'date-fns';

// Pay rates by FP+ level (same as RecapSummarySlide)
const PAY_RATES: Record<number, number> = {
  60: 6.50,
  100: 7.00,
  150: 7.50,
  200: 8.00,
  250: 8.50,
  300: 9.00,
};

const UPFRONT_RATE = 4; // Upfront pay = PRMR × 4

// Helper to format minutes as human readable
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
};

// Helper to format date
const formatDate = (dateStr: string): string => {
  try {
    return format(parseISO(dateStr), 'MMM d');
  } catch {
    return dateStr;
  }
};

interface InsightsDealsTabProps {
  dateRange: { start: Date; end: Date };
  userCumulativeFpPlus: number;
}

// Deal type card component
const DealTypeCard = ({ 
  type, 
  count, 
  avgPrmr, 
  avgTime, 
  avgCost, 
  roi,
  difficulty,
  color,
  icon: Icon 
}: { 
  type: string; 
  count: number; 
  avgPrmr: number; 
  avgTime: number; 
  avgCost: number;
  roi: { upfront: number; total: number };
  difficulty: { easy: number; medium: number; hard: number };
  color: string;
  icon: React.ElementType;
}) => {
  const totalDiff = difficulty.easy + difficulty.medium + difficulty.hard;
  const easyPct = totalDiff > 0 ? Math.round((difficulty.easy / totalDiff) * 100) : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`p-4 rounded-2xl ${color} space-y-3`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          <span className="font-semibold capitalize">{type}</span>
        </div>
        <span className="text-2xl font-bold">{count}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="space-y-0.5">
          <div className="text-xs opacity-70">Avg PRMR</div>
          <div className="font-semibold">${avgPrmr.toFixed(0)}</div>
        </div>
        {avgTime > 0 && (
          <div className="space-y-0.5">
            <div className="text-xs opacity-70">Avg Time</div>
            <div className="font-semibold">{formatMinutes(avgTime)}</div>
          </div>
        )}
        {avgCost > 0 && (
          <div className="space-y-0.5">
            <div className="text-xs opacity-70">Avg Cost</div>
            <div className="font-semibold">${avgCost.toFixed(0)}</div>
          </div>
        )}
        {roi.upfront > 0 && (
          <div className="space-y-0.5">
            <div className="text-xs opacity-70">ROI</div>
            <div className="flex items-center gap-1.5">
              <span className={`font-semibold text-blue-400`}>{roi.upfront.toFixed(1)}x</span>
              <span className="text-muted-foreground/60">/</span>
              <span className={`font-semibold ${roi.total >= 1 ? 'text-success' : ''}`}>{roi.total.toFixed(1)}x</span>
            </div>
          </div>
        )}
      </div>
      
      {totalDiff > 0 && (
        <div className="space-y-1">
          <div className="flex gap-0.5 h-2 rounded-full overflow-hidden bg-black/10">
            {difficulty.easy > 0 && (
              <div 
                className="bg-success/80"
                style={{ flex: difficulty.easy }}
              />
            )}
            {difficulty.medium > 0 && (
              <div 
                className="bg-warning/80"
                style={{ flex: difficulty.medium }}
              />
            )}
            {difficulty.hard > 0 && (
              <div 
                className="bg-destructive/80"
                style={{ flex: difficulty.hard }}
              />
            )}
          </div>
          <div className="text-[10px] opacity-70">{easyPct}% easy</div>
        </div>
      )}
    </motion.div>
  );
};

// Highlight card for records
const HighlightCard = ({ 
  title, 
  icon: Icon, 
  deal, 
  metric,
  color = 'bg-muted/50'
}: { 
  title: string; 
  icon: React.ElementType; 
  deal: DealHighlight; 
  metric: string;
  color?: string;
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className={`p-3 rounded-xl ${color} space-y-1.5`}
  >
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Icon className="w-3 h-3" />
      <span>{title}</span>
    </div>
    <div className="font-semibold truncate">{deal.name}</div>
    <div className="flex items-center justify-between text-sm">
      <span className="text-primary font-medium">{metric}</span>
      <span className="text-xs text-muted-foreground">{formatDate(deal.date)}</span>
    </div>
  </motion.div>
);

export const InsightsDealsTab = ({ dateRange, userCumulativeFpPlus }: InsightsDealsTabProps) => {
  const { insights, isLoading } = useCustomerInsights(dateRange);
  const navigate = useNavigate();
  const { goals } = useRepGoals();
  const { repData } = useRepData();
  const { efpModeEnabled } = useEfpMode();

  // Calculate pay rates based on user's pay level setting (same logic as recaps)
  const isRookie = repData?.year === 'Rookie';
  const defaultPayLevel = isRookie ? 60 : 100;
  const payLevel = goals?.custom_payscale_fp ?? defaultPayLevel;
  const totalPayRate = PAY_RATES[payLevel] || 6.50;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <InsightsSectionHeader 
          icon={DollarSign} 
          title="Deals" 
          description="Deep dive into your sales performance"
        />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse mb-2" />
            <div className="h-4 w-48 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!insights || insights.totalDeals === 0) {
    return (
      <div className="space-y-4">
        <InsightsSectionHeader 
          icon={DollarSign} 
          title="Deals" 
          description="Deep dive into your sales performance"
        />
        <Card className="border-border/40">
          <CardContent className="pt-6 text-center">
            <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">No deals in this period</p>
            <p className="text-sm text-muted-foreground mt-1">
              Log sales to see deal analytics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate ROIs - both upfront and total pay
  const totalSpent = insights.totalMoneySpent || 0;
  const upfrontPay = insights.totalPrmr * UPFRONT_RATE;
  const totalPay = insights.totalPrmr * totalPayRate;
  const upfrontRoi = totalSpent > 0 ? upfrontPay / totalSpent : 0;
  const totalPayRoi = totalSpent > 0 ? totalPay / totalSpent : 0;
  
  // Calculate EFP or FP+ total
  const totalEfp = insights.totalPrmr / 85;
  const avgSpentPerUnit = efpModeEnabled
    ? (totalEfp > 0 ? totalSpent / totalEfp : 0)
    : (insights.totalFpDeals > 0 ? totalSpent / insights.totalFpDeals : 0);

  // Calculate ROI for FP types (returns both upfront and total pay ROI)
  const getFpTypeRoi = (type: 'fresh' | 'takeover' | 'diy') => {
    const spend = insights.spendByDealType[type];
    const prmr = insights.prmrTotalByDealType[type];
    const upfront = spend > 0 ? (prmr * UPFRONT_RATE) / spend : 0;
    const total = spend > 0 ? (prmr * totalPayRate) / spend : 0;
    return { upfront, total };
  };

  // Helper for sale type ROI
  const getSaleTypeRoi = (saleType: 'fp' | 'upgrade') => {
    const spend = insights.spendBySaleType[saleType];
    const prmr = insights.prmrTotalBySaleType[saleType];
    const upfront = spend > 0 ? (prmr * UPFRONT_RATE) / spend : 0;
    const total = spend > 0 ? (prmr * totalPayRate) / spend : 0;
    return { upfront, total };
  };

  return (
    <div className="space-y-5">
      <InsightsSectionHeader 
        icon={DollarSign} 
        title="Deals" 
        description="Deep dive into your sales performance"
      />

      {/* Hero Stats Row */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-2xl bg-primary/10 text-center"
        >
          <div className="text-2xl font-bold text-primary">{insights.totalDeals}</div>
          <div className="text-xs text-muted-foreground">Deals</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-3 rounded-2xl bg-success/10 text-center"
        >
          <div className="text-2xl font-bold text-success">${insights.totalPrmr.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Total PRMR</div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3 rounded-2xl bg-muted/50 text-center"
        >
          <div className="text-xl font-bold text-foreground">${totalSpent.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">Invested</div>
        </motion.div>
      </div>

      {/* ROI Card - Dual Display */}
      {insights.hasMoneySpentData && totalSpent > 0 && (
        <Card className="border-border/40 overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="font-semibold">Return on Investment</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {/* Upfront ROI */}
              <div className="p-3 rounded-xl bg-blue-500/10 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-blue-400">
                  <Target className="w-3 h-3" />
                  <span>Upfront (4x)</span>
                </div>
                <div className={`text-2xl font-bold ${upfrontRoi >= 1 ? 'text-blue-400' : 'text-muted-foreground'}`}>
                  {upfrontRoi.toFixed(1)}x
                </div>
                <div className="text-xs text-muted-foreground">
                  ${upfrontPay.toLocaleString(undefined, { maximumFractionDigits: 0 })} pay
                </div>
              </div>
              
              {/* Total Pay ROI */}
              <div className="p-3 rounded-xl bg-success/10 border border-success/20 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-success">
                  <Banknote className="w-3 h-3" />
                  <span>Total ({payLevel} FP+)</span>
                </div>
                <div className={`text-2xl font-bold ${totalPayRoi >= 1 ? 'text-success' : 'text-warning'}`}>
                  {totalPayRoi.toFixed(1)}x
                </div>
                <div className="text-xs text-muted-foreground">
                  ${totalPay.toLocaleString(undefined, { maximumFractionDigits: 0 })} pay
                </div>
              </div>
            </div>
            
            <p className="text-[10px] text-muted-foreground text-center">
              Adjust pay level in Settings → Pay Level for Recaps
            </p>
          </CardContent>
        </Card>
      )}

      {/* FP vs Upgrade Split */}
      <Card className="border-border/40 overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-border">
            {/* FP Column */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="font-semibold">FP</span>
              </div>
              <div className="text-3xl font-bold">{insights.totalFpDeals}</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg PRMR</span>
                  <span className="font-medium">${insights.avgPrmrPerFp.toFixed(0)}</span>
                </div>
                {insights.avgTimeBySaleType.fp > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Time</span>
                    <span className="font-medium">{formatMinutes(insights.avgTimeBySaleType.fp)}</span>
                  </div>
                )}
                {insights.avgCostBySaleType.fp > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Cost</span>
                    <span className="font-medium">${insights.avgCostBySaleType.fp.toFixed(0)}</span>
                  </div>
                )}
                {insights.spendBySaleType.fp > 0 && (() => {
                  const fpRoi = getSaleTypeRoi('fp');
                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">ROI</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-blue-400">{fpRoi.upfront.toFixed(1)}x</span>
                        <span className="text-muted-foreground/50">/</span>
                        <span className={`font-medium ${fpRoi.total >= 1 ? 'text-success' : ''}`}>{fpRoi.total.toFixed(1)}x</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            {/* Upgrade Column */}
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="font-semibold">Upgrades</span>
              </div>
              <div className="text-3xl font-bold">{insights.totalUpgradeDeals}</div>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Avg PRMR</span>
                  <span className="font-medium">${insights.avgPrmrPerUpgrade.toFixed(0)}</span>
                </div>
                {insights.avgTimeBySaleType.upgrade > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Time</span>
                    <span className="font-medium">{formatMinutes(insights.avgTimeBySaleType.upgrade)}</span>
                  </div>
                )}
                {insights.avgCostBySaleType.upgrade > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Avg Cost</span>
                    <span className="font-medium">${insights.avgCostBySaleType.upgrade.toFixed(0)}</span>
                  </div>
                )}
                {insights.spendBySaleType.upgrade > 0 && (() => {
                  const upgradeRoi = getSaleTypeRoi('upgrade');
                  return (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">ROI</span>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-blue-400">{upgradeRoi.upfront.toFixed(1)}x</span>
                        <span className="text-muted-foreground/50">/</span>
                        <span className={`font-medium ${upgradeRoi.total >= 1 ? 'text-success' : ''}`}>{upgradeRoi.total.toFixed(1)}x</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FP Breakdown by Type (Fresh/Takeover/DIY) */}
      {insights.hasDealTypeData && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground px-1">FP Breakdown</h3>
          <div className="grid grid-cols-1 gap-3">
            {insights.dealTypeDistribution.fresh > 0 && (
              <DealTypeCard
                type="Fresh"
                count={insights.dealTypeDistribution.fresh}
                avgPrmr={insights.prmrByDealType.fresh}
                avgTime={insights.avgTimeByDealType.fresh}
                avgCost={insights.avgCostByDealType.fresh}
                roi={getFpTypeRoi('fresh')}
                difficulty={insights.difficultyByDealType.fresh}
                color="bg-primary/10"
                icon={Sparkles}
              />
            )}
            {insights.dealTypeDistribution.takeover > 0 && (
              <DealTypeCard
                type="Takeover"
                count={insights.dealTypeDistribution.takeover}
                avgPrmr={insights.prmrByDealType.takeover}
                avgTime={insights.avgTimeByDealType.takeover}
                avgCost={insights.avgCostByDealType.takeover}
                roi={getFpTypeRoi('takeover')}
                difficulty={insights.difficultyByDealType.takeover}
                color="bg-success/10"
                icon={Target}
              />
            )}
            {insights.dealTypeDistribution.diy > 0 && (
              <DealTypeCard
                type="DIY"
                count={insights.dealTypeDistribution.diy}
                avgPrmr={insights.prmrByDealType.diy}
                avgTime={insights.avgTimeByDealType.diy}
                avgCost={insights.avgCostByDealType.diy}
                roi={getFpTypeRoi('diy')}
                difficulty={insights.difficultyByDealType.diy}
                color="bg-warning/10"
                icon={Flame}
              />
            )}
          </div>
        </div>
      )}

      {/* Record Highlights */}
      {(insights.fastestSale || insights.highestPrmrDeal || insights.earliestFpDeal) && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground px-1">Highlights</h3>
          <div className="grid grid-cols-2 gap-3">
            {insights.fastestSale && (
              <HighlightCard
                title="Fastest Close"
                icon={Zap}
                deal={insights.fastestSale}
                metric={formatMinutes(insights.fastestSale.minutes || 0)}
                color="bg-primary/10"
              />
            )}
            {insights.slowestSale && (
              <HighlightCard
                title="Longest Close"
                icon={Clock}
                deal={insights.slowestSale}
                metric={formatMinutes(insights.slowestSale.minutes || 0)}
                color="bg-muted/50"
              />
            )}
            {insights.highestPrmrDeal && (
              <HighlightCard
                title="Highest PRMR"
                icon={Award}
                deal={insights.highestPrmrDeal}
                metric={`$${insights.highestPrmrDeal.prmr}`}
                color="bg-success/10"
              />
            )}
            {insights.mostExpensiveDeal && (
              <HighlightCard
                title="Most Invested"
                icon={DollarSign}
                deal={insights.mostExpensiveDeal}
                metric={`$${insights.mostExpensiveDeal.moneySpent}`}
                color="bg-warning/10"
              />
            )}
          </div>
        </div>
      )}

      {/* Time to Sell Summary */}
      {insights.hasTimeData && (
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-semibold">Time to Sell</span>
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatMinutes(insights.avgTimeToSell)}</span>
              <span className="text-muted-foreground text-sm">average</span>
            </div>
            
            {/* By Difficulty */}
            {(insights.avgTimeByDifficulty.easy > 0 || insights.avgTimeByDifficulty.medium > 0 || insights.avgTimeByDifficulty.hard > 0) && (
              <div className="grid grid-cols-3 gap-2 pt-2">
                {insights.avgTimeByDifficulty.easy > 0 && (
                  <div className="text-center p-2 rounded-xl bg-success/10">
                    <div className="text-xs text-muted-foreground">Easy</div>
                    <div className="font-semibold text-success">{formatMinutes(insights.avgTimeByDifficulty.easy)}</div>
                  </div>
                )}
                {insights.avgTimeByDifficulty.medium > 0 && (
                  <div className="text-center p-2 rounded-xl bg-warning/10">
                    <div className="text-xs text-muted-foreground">Medium</div>
                    <div className="font-semibold text-warning">{formatMinutes(insights.avgTimeByDifficulty.medium)}</div>
                  </div>
                )}
                {insights.avgTimeByDifficulty.hard > 0 && (
                  <div className="text-center p-2 rounded-xl bg-destructive/10">
                    <div className="text-xs text-muted-foreground">Hard</div>
                    <div className="font-semibold text-destructive">{formatMinutes(insights.avgTimeByDifficulty.hard)}</div>
                  </div>
                )}
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Based on {insights.dealsWithTimeData} deals with time data
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sales Time Heatmap */}
      {insights.hasSaleTimeData && (
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-semibold">When You Close</span>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Sales by hour of day (your local time)
            </p>
            
            {/* Hour labels row */}
            <div className="space-y-2">
              {/* Heatmap grid - show hours with activity */}
              {(() => {
                const hoursWithSales = insights.salesByHourAndType.filter(h => h.total > 0);
                if (hoursWithSales.length === 0) return null;
                
                const maxTotal = Math.max(...hoursWithSales.map(h => h.total));
                
                // Find min and max hours to show a focused range
                const hoursActive = hoursWithSales.map(h => h.hour);
                const minHour = Math.max(0, Math.min(...hoursActive) - 1);
                const maxHour = Math.min(23, Math.max(...hoursActive) + 1);
                
                const displayHours = insights.salesByHourAndType.filter(h => h.hour >= minHour && h.hour <= maxHour);
                
                return (
                  <div className="space-y-3">
                    {/* Hour grid */}
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${displayHours.length}, 1fr)` }}>
                      {displayHours.map(hourData => {
                        const intensity = hourData.total > 0 ? Math.max(0.15, hourData.total / maxTotal) : 0;
                        
                        return (
                          <div key={hourData.hour} className="text-center">
                            <div 
                              className="h-12 rounded-lg flex flex-col items-center justify-center relative overflow-hidden"
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
                                  <div className="flex h-1.5 w-full absolute bottom-0 left-0">
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
                            <div className="text-[10px] text-muted-foreground mt-1">
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
                    <div className="flex flex-wrap gap-3 justify-center text-[10px]">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-sm bg-primary" />
                        <span className="text-muted-foreground">Fresh</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-sm bg-success" />
                        <span className="text-muted-foreground">Takeover</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-sm bg-warning" />
                        <span className="text-muted-foreground">DIY</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-sm bg-muted-foreground" />
                        <span className="text-muted-foreground">Upgrade</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Install Performance */}
      {insights.hasInstallData && (
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-primary" />
              <span className="font-semibold">Install Performance</span>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-xl bg-success/10">
                <div className="text-2xl font-bold text-success">{insights.sameDayInstallRate.toFixed(0)}%</div>
                <div className="text-xs text-muted-foreground">Same-Day</div>
              </div>
              <div className="text-center p-3 rounded-xl bg-muted/50">
                <div className="text-2xl font-bold">{insights.avgDaysToInstall.toFixed(1)}</div>
                <div className="text-xs text-muted-foreground">Avg Days</div>
              </div>
              {insights.cancelRate > 0 && (
                <div className="text-center p-3 rounded-xl bg-destructive/10">
                  <div className="text-2xl font-bold text-destructive">{insights.cancelRate.toFixed(1)}%</div>
                  <div className="text-xs text-muted-foreground">Cancel</div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Difficulty Distribution */}
      {(insights.difficultyDistribution.easy > 0 || insights.difficultyDistribution.medium > 0 || insights.difficultyDistribution.hard > 0) && (
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-3">
            <div className="text-sm font-medium text-muted-foreground">Overall Difficulty</div>
            
            <div className="flex gap-1 h-10 rounded-xl overflow-hidden">
              {insights.difficultyDistribution.easy > 0 && (
                <div 
                  className="bg-success flex items-center justify-center text-sm font-semibold text-success-foreground"
                  style={{ flex: insights.difficultyDistribution.easy }}
                >
                  {insights.difficultyDistribution.easy}
                </div>
              )}
              {insights.difficultyDistribution.medium > 0 && (
                <div 
                  className="bg-warning flex items-center justify-center text-sm font-semibold text-warning-foreground"
                  style={{ flex: insights.difficultyDistribution.medium }}
                >
                  {insights.difficultyDistribution.medium}
                </div>
              )}
              {insights.difficultyDistribution.hard > 0 && (
                <div 
                  className="bg-destructive flex items-center justify-center text-sm font-semibold text-destructive-foreground"
                  style={{ flex: insights.difficultyDistribution.hard }}
                >
                  {insights.difficultyDistribution.hard}
                </div>
              )}
            </div>
            
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-success" /> Easy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-warning" /> Medium
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-destructive" /> Hard
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Map Link */}
      {insights.salesWithLocationCount > 0 && (
        <Card 
          className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors active:scale-[0.98]"
          onClick={() => navigate('/customers')}
        >
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold">Customer Map</div>
                <div className="text-sm text-muted-foreground">
                  {insights.salesWithLocationCount} deals with location
                </div>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
