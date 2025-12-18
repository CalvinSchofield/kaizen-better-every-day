import { useState } from 'react';
import { DollarSign, Clock, PieChart, CalendarCheck, MapPin, TrendingUp, Zap, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useCustomerInsights } from '@/hooks/useCustomerInsights';
import { InsightsSectionHeader } from './InsightsSectionHeader';
import { InsightCollapsible } from './InsightCollapsible';
import { useNavigate } from 'react-router-dom';
import { useRepGoals } from '@/hooks/useRepGoals';
import { getTier, getAllTiers } from '@/utils/payscaleCalculator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

type ExpandedSection = 'economics' | 'time' | 'dealType' | 'install' | null;

// Key payscale tiers for quick selection
const QUICK_TIER_OPTIONS = [20, 40, 60, 100, 200, 300];

// Helper to format minutes as human readable
const formatMinutes = (minutes: number): string => {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} hr`;
  return `${hours}h ${mins}m`;
};

interface InsightsDealsTabProps {
  dateRange: { start: Date; end: Date };
  userCumulativeFpPlus: number;
}

export const InsightsDealsTab = ({ dateRange, userCumulativeFpPlus }: InsightsDealsTabProps) => {
  const { insights, isLoading } = useCustomerInsights(dateRange);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const navigate = useNavigate();
  const { goals, updateGoals } = useRepGoals();
  const { toast } = useToast();
  const [isUpdatingTier, setIsUpdatingTier] = useState(false);

  const handleSectionToggle = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // Calculate ROI at different pay levels
  // Use custom pay level if set, otherwise use user's actual cumulative FP+
  const customPayLevel = goals?.custom_payscale_fp ?? null;
  const targetFpPlus = customPayLevel ?? userCumulativeFpPlus;
  const upfrontRate = 4; // $4/PRMR upfront
  
  // Get current tier rate based on user's FP+ level
  const currentTier = getTier(targetFpPlus);
  const payscaleRate = currentTier.rate;
  
  // Calculate earnings based on total PRMR
  const upfrontEarnings = insights?.totalPrmr ? insights.totalPrmr * upfrontRate : 0;
  const payscaleEarnings = insights?.totalPrmr ? insights.totalPrmr * payscaleRate : 0;
  
  // Calculate ROI as earnings ÷ cost (not PRMR ÷ cost)
  const totalSpent = insights?.totalMoneySpent || 0;
  const payscaleRoi = totalSpent > 0 ? payscaleEarnings / totalSpent : 0;
  const upfrontRoi = totalSpent > 0 ? upfrontEarnings / totalSpent : 0;

  const handleTierChange = async (newTier: number | null) => {
    setIsUpdatingTier(true);
    try {
      await updateGoals({ custom_payscale_fp: newTier });
      toast({
        title: "Pay level updated",
        description: newTier 
          ? `Now showing ROI at ${newTier} FP+ payscale`
          : "Using your current FP+ level",
      });
    } catch (error: any) {
      toast({
        title: "Failed to update",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUpdatingTier(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <InsightsSectionHeader 
          icon={DollarSign} 
          title="Deals" 
          description="Customer analytics & deal economics"
        />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4">
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
          description="Customer analytics & deal economics"
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

  // Find highest value deal type
  const dealTypes = ['fresh', 'takeover', 'diy'] as const;
  const highestValueType = dealTypes.reduce((a, b) => 
    insights.prmrByDealType[a] > insights.prmrByDealType[b] ? a : b
  );

  return (
    <div className="space-y-4">
      <InsightsSectionHeader 
        icon={DollarSign} 
        title="Deals" 
        description="Customer analytics & deal economics"
      />

      {/* Deal Economics */}
      <InsightCollapsible
        icon={DollarSign}
        title="Deal Economics"
        isOpen={expandedSection === 'economics'}
        onToggle={() => handleSectionToggle('economics')}
        preview={
          <span>
            <span className="text-primary font-medium">${insights.avgPrmrPerFp.toFixed(0)}</span> avg PRMR per FP
            {insights.hasMoneySpentData && payscaleRoi > 0 && (
              <> · <span className="text-success font-medium">{payscaleRoi.toFixed(1)}x</span> ROI</>
            )}
          </span>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/30">
              <div className="text-sm text-muted-foreground">Avg PRMR / FP</div>
              <div className="text-xl font-bold">${insights.avgPrmrPerFp.toFixed(0)}</div>
            </div>
            {insights.avgPrmrPerUpgrade > 0 && (
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground">Avg PRMR / Upgrade</div>
                <div className="text-xl font-bold">${insights.avgPrmrPerUpgrade.toFixed(0)}</div>
              </div>
            )}
          </div>
          
          {insights.hasMoneySpentData && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Avg Spent / Deal</div>
                  <div className="text-xl font-bold">${insights.avgMoneySpent.toFixed(0)}</div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-sm text-muted-foreground">Total Spent</div>
                  <div className="text-xl font-bold">${insights.totalMoneySpent.toLocaleString()}</div>
                </div>
              </div>
              
              <div className="p-3 rounded-xl bg-primary/10">
                <div className="text-sm text-muted-foreground mb-2">Total PRMR</div>
                <div className="text-xl font-bold text-primary">${insights.totalPrmr.toLocaleString()}</div>
              </div>
            </>
          )}
          
        {/* Tier Selector */}
          {insights.totalPrmr > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Pay Level</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1"
                    disabled={isUpdatingTier}
                  >
                    {customPayLevel ? `${customPayLevel} FP+` : `${Math.round(userCumulativeFpPlus)} FP+ (Current)`}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    <Button
                      variant={customPayLevel === null ? "secondary" : "ghost"}
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => handleTierChange(null)}
                    >
                      {Math.round(userCumulativeFpPlus)} FP+ (Current)
                    </Button>
                    {QUICK_TIER_OPTIONS.map((tier) => (
                      <Button
                        key={tier}
                        variant={customPayLevel === tier ? "secondary" : "ghost"}
                        size="sm"
                        className="w-full justify-start text-xs"
                        onClick={() => handleTierChange(tier)}
                      >
                        {tier} FP+ (${getTier(tier).rate.toFixed(2)}/PRMR)
                      </Button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* ROI (Earnings ÷ Cost) - Payscale vs Upfront */}
          {insights.totalPrmr > 0 && insights.hasMoneySpentData && totalSpent > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">ROI (Earnings ÷ Cost)</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-success/10">
                  <div className="text-xs text-muted-foreground">
                    @ {Math.round(targetFpPlus)} FP+ Payscale
                  </div>
                  <div className="text-xl font-bold text-success">{payscaleRoi.toFixed(2)}x</div>
                  <div className="text-[10px] text-muted-foreground">
                    ${payscaleEarnings.toFixed(0)} ÷ ${totalSpent.toFixed(0)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-xs text-muted-foreground">Upfront Only</div>
                  <div className="text-xl font-bold">{upfrontRoi.toFixed(2)}x</div>
                  <div className="text-[10px] text-muted-foreground">
                    ${upfrontEarnings.toFixed(0)} ÷ ${totalSpent.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Earnings from PRMR - Payscale vs Upfront */}
          {insights.totalPrmr > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Earnings from PRMR</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-success/10">
                  <div className="text-xs text-muted-foreground">
                    @ {Math.round(targetFpPlus)} FP+ Payscale
                  </div>
                  <div className="text-lg font-bold text-success">
                    ${payscaleEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    ${insights.totalPrmr.toFixed(0)} × ${payscaleRate.toFixed(2)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <div className="text-xs text-muted-foreground">Upfront Only</div>
                  <div className="text-lg font-bold">
                    ${upfrontEarnings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    ${insights.totalPrmr.toFixed(0)} × $4
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ROI by Deal Type (Fresh, Takeover, DIY) */}
          {insights.hasDealTypeData && insights.hasMoneySpentData && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">ROI by Deal Type</div>
              <div className="grid grid-cols-3 gap-2">
                {(['fresh', 'takeover', 'diy'] as const).map((type) => {
                  const spend = insights.spendByDealType[type];
                  const prmr = insights.prmrTotalByDealType[type];
                  const earnings = prmr * payscaleRate;
                  const roi = spend > 0 ? earnings / spend : 0;
                  const hasData = insights.dealTypeDistribution[type] > 0;
                  
                  if (!hasData) return null;
                  
                  return (
                    <div key={type} className="p-2 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground capitalize">{type}</div>
                      <div className={`font-bold ${roi >= 1 ? 'text-success' : 'text-destructive'}`}>
                        {spend > 0 ? `${roi.toFixed(1)}x` : '—'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        ${spend.toFixed(0)} spent
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ROI by Sale Type (FP vs Upgrade) */}
          {insights.hasMoneySpentData && (insights.totalFpDeals > 0 || insights.totalUpgradeDeals > 0) && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">ROI by Sale Type</div>
              <div className="grid grid-cols-2 gap-3">
                {insights.totalFpDeals > 0 && (
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <div className="text-xs text-muted-foreground">Fresh Pitch (FP)</div>
                    <div className={`font-bold ${insights.spendBySaleType.fp > 0 && (insights.prmrTotalBySaleType.fp * payscaleRate / insights.spendBySaleType.fp) >= 1 ? 'text-success' : insights.spendBySaleType.fp > 0 ? 'text-destructive' : ''}`}>
                      {insights.spendBySaleType.fp > 0 
                        ? `${(insights.prmrTotalBySaleType.fp * payscaleRate / insights.spendBySaleType.fp).toFixed(1)}x`
                        : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      ${insights.spendBySaleType.fp.toFixed(0)} spent · {insights.totalFpDeals} deals
                    </div>
                  </div>
                )}
                {insights.totalUpgradeDeals > 0 && (
                  <div className="p-2 rounded-lg bg-muted/30 text-center">
                    <div className="text-xs text-muted-foreground">Upgrade</div>
                    <div className={`font-bold ${insights.spendBySaleType.upgrade > 0 && (insights.prmrTotalBySaleType.upgrade * payscaleRate / insights.spendBySaleType.upgrade) >= 1 ? 'text-success' : insights.spendBySaleType.upgrade > 0 ? 'text-destructive' : ''}`}>
                      {insights.spendBySaleType.upgrade > 0 
                        ? `${(insights.prmrTotalBySaleType.upgrade * payscaleRate / insights.spendBySaleType.upgrade).toFixed(1)}x`
                        : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      ${insights.spendBySaleType.upgrade.toFixed(0)} spent · {insights.totalUpgradeDeals} deals
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <p className="text-xs text-muted-foreground">
            Based on {insights.totalDeals} deal{insights.totalDeals !== 1 ? 's' : ''} ({insights.totalFpDeals} FP, {insights.totalUpgradeDeals} upgrade)
          </p>
        </div>
      </InsightCollapsible>

      {/* Time to Sell */}
      {insights.hasTimeData && (
        <InsightCollapsible
          icon={Clock}
          title="Time to Sell"
          isOpen={expandedSection === 'time'}
          onToggle={() => handleSectionToggle('time')}
          preview={
            <span>
              <span className="text-primary font-medium">{formatMinutes(insights.avgTimeToSell)}</span> avg time to close
            </span>
          }
        >
          <div className="space-y-3">
            <div className="p-3 rounded-xl bg-primary/10">
              <div className="text-sm text-muted-foreground">Average Time to Close</div>
              <div className="text-xl font-bold text-primary">{formatMinutes(insights.avgTimeToSell)}</div>
              <div className="text-xs text-muted-foreground">From transition to close</div>
            </div>

            {/* By Deal Type */}
            {(insights.avgTimeByDealType.fresh > 0 || insights.avgTimeByDealType.takeover > 0 || insights.avgTimeByDealType.diy > 0) && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">By Deal Type</div>
                <div className="grid grid-cols-3 gap-2">
                  {insights.avgTimeByDealType.fresh > 0 && (
                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground">Fresh</div>
                      <div className="font-bold">{formatMinutes(insights.avgTimeByDealType.fresh)}</div>
                    </div>
                  )}
                  {insights.avgTimeByDealType.takeover > 0 && (
                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground">Takeover</div>
                      <div className="font-bold">{formatMinutes(insights.avgTimeByDealType.takeover)}</div>
                    </div>
                  )}
                  {insights.avgTimeByDealType.diy > 0 && (
                    <div className="p-2 rounded-lg bg-muted/30 text-center">
                      <div className="text-xs text-muted-foreground">DIY</div>
                      <div className="font-bold">{formatMinutes(insights.avgTimeByDealType.diy)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* By Difficulty */}
            {(insights.avgTimeByDifficulty.easy > 0 || insights.avgTimeByDifficulty.medium > 0 || insights.avgTimeByDifficulty.hard > 0) && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">By Difficulty</div>
                <div className="grid grid-cols-3 gap-2">
                  {insights.avgTimeByDifficulty.easy > 0 && (
                    <div className="p-2 rounded-lg bg-success/10 text-center">
                      <div className="text-xs text-muted-foreground">Easy</div>
                      <div className="font-bold text-success">{formatMinutes(insights.avgTimeByDifficulty.easy)}</div>
                    </div>
                  )}
                  {insights.avgTimeByDifficulty.medium > 0 && (
                    <div className="p-2 rounded-lg bg-warning/10 text-center">
                      <div className="text-xs text-muted-foreground">Medium</div>
                      <div className="font-bold text-warning">{formatMinutes(insights.avgTimeByDifficulty.medium)}</div>
                    </div>
                  )}
                  {insights.avgTimeByDifficulty.hard > 0 && (
                    <div className="p-2 rounded-lg bg-destructive/10 text-center">
                      <div className="text-xs text-muted-foreground">Hard</div>
                      <div className="font-bold text-destructive">{formatMinutes(insights.avgTimeByDifficulty.hard)}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Fastest Sale */}
            {insights.fastestSale && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                <Zap className="w-5 h-5 text-primary" />
                <div>
                  <div className="text-sm text-muted-foreground">Fastest Close</div>
                  <div className="font-bold">{formatMinutes(insights.fastestSale.minutes)}</div>
                  <div className="text-xs text-muted-foreground">
                    {insights.fastestSale.name} · ${insights.fastestSale.prmr} PRMR
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Based on {insights.dealsWithTimeData} deals with time data
            </p>
          </div>
        </InsightCollapsible>
      )}

      {/* Deal Type Distribution */}
      {insights.hasDealTypeData && (
        <InsightCollapsible
          icon={PieChart}
          title="Deal Type Performance"
          isOpen={expandedSection === 'dealType'}
          onToggle={() => handleSectionToggle('dealType')}
          preview={
            <span>
              <span className="text-primary font-medium capitalize">{highestValueType}s</span> are your highest value deals
            </span>
          }
        >
          <div className="space-y-3">
            {/* Distribution Bar */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Deal Mix</div>
              <div className="flex gap-1 h-8 rounded-lg overflow-hidden">
                {insights.dealTypeDistribution.fresh > 0 && (
                  <div 
                    className="bg-primary flex items-center justify-center text-xs font-medium text-primary-foreground"
                    style={{ flex: insights.dealTypeDistribution.fresh }}
                  >
                    {insights.dealTypeDistribution.fresh}
                  </div>
                )}
                {insights.dealTypeDistribution.takeover > 0 && (
                  <div 
                    className="bg-success flex items-center justify-center text-xs font-medium text-success-foreground"
                    style={{ flex: insights.dealTypeDistribution.takeover }}
                  >
                    {insights.dealTypeDistribution.takeover}
                  </div>
                )}
                {insights.dealTypeDistribution.diy > 0 && (
                  <div 
                    className="bg-warning flex items-center justify-center text-xs font-medium text-warning-foreground"
                    style={{ flex: insights.dealTypeDistribution.diy }}
                  >
                    {insights.dealTypeDistribution.diy}
                  </div>
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary" /> Fresh
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-success" /> Takeover
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-warning" /> DIY
                </span>
              </div>
            </div>

            {/* PRMR by Type */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">Avg PRMR by Type</div>
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2 rounded-lg text-center ${highestValueType === 'fresh' ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <div className="text-xs text-muted-foreground">Fresh</div>
                  <div className={`font-bold ${highestValueType === 'fresh' ? 'text-primary' : ''}`}>
                    ${insights.prmrByDealType.fresh.toFixed(0)}
                  </div>
                </div>
                <div className={`p-2 rounded-lg text-center ${highestValueType === 'takeover' ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <div className="text-xs text-muted-foreground">Takeover</div>
                  <div className={`font-bold ${highestValueType === 'takeover' ? 'text-primary' : ''}`}>
                    ${insights.prmrByDealType.takeover.toFixed(0)}
                  </div>
                </div>
                <div className={`p-2 rounded-lg text-center ${highestValueType === 'diy' ? 'bg-primary/10' : 'bg-muted/30'}`}>
                  <div className="text-xs text-muted-foreground">DIY</div>
                  <div className={`font-bold ${highestValueType === 'diy' ? 'text-primary' : ''}`}>
                    ${insights.prmrByDealType.diy.toFixed(0)}
                  </div>
                </div>
              </div>
            </div>

            {/* Difficulty Distribution */}
            {(insights.difficultyDistribution.easy > 0 || insights.difficultyDistribution.medium > 0 || insights.difficultyDistribution.hard > 0) && (
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">By Difficulty</div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2 rounded-lg bg-success/10 text-center">
                    <div className="text-xs text-muted-foreground">Easy</div>
                    <div className="font-bold text-success">{insights.difficultyDistribution.easy}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-warning/10 text-center">
                    <div className="text-xs text-muted-foreground">Medium</div>
                    <div className="font-bold text-warning">{insights.difficultyDistribution.medium}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-destructive/10 text-center">
                    <div className="text-xs text-muted-foreground">Hard</div>
                    <div className="font-bold text-destructive">{insights.difficultyDistribution.hard}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </InsightCollapsible>
      )}

      {/* Install Performance */}
      {insights.hasInstallData && (
        <InsightCollapsible
          icon={CalendarCheck}
          title="Install Performance"
          isOpen={expandedSection === 'install'}
          onToggle={() => handleSectionToggle('install')}
          preview={
            <span>
              <span className="text-primary font-medium">{insights.sameDayInstallRate.toFixed(0)}%</span> same-day install rate
            </span>
          }
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-success/10">
                <div className="text-sm text-muted-foreground">Same-Day Installs</div>
                <div className="text-xl font-bold text-success">{insights.sameDayInstallRate.toFixed(0)}%</div>
              </div>
              <div className="p-3 rounded-xl bg-muted/30">
                <div className="text-sm text-muted-foreground">Avg Days to Install</div>
                <div className="text-xl font-bold">{insights.avgDaysToInstall.toFixed(1)}</div>
              </div>
            </div>
            
            {insights.cancelRate > 0 && (
              <div className="p-3 rounded-xl bg-destructive/10">
                <div className="text-sm text-muted-foreground">Cancel Rate</div>
                <div className="text-xl font-bold text-destructive">{insights.cancelRate.toFixed(1)}%</div>
              </div>
            )}
          </div>
        </InsightCollapsible>
      )}

      {/* Location Quick Access */}
      {insights.salesWithLocationCount > 0 && (
        <Card 
          className="border-border/40 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate('/customers')}
        >
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">Customer Map</div>
                <div className="text-sm text-muted-foreground">
                  {insights.salesWithLocationCount} deals with location data
                </div>
              </div>
            </div>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </CardContent>
        </Card>
      )}
    </div>
  );
};
