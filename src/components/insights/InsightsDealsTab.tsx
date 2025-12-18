import { useState } from 'react';
import { DollarSign, Clock, PieChart, CalendarCheck, MapPin, TrendingUp, Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useCustomerInsights } from '@/hooks/useCustomerInsights';
import { InsightsSectionHeader } from './InsightsSectionHeader';
import { InsightCollapsible } from './InsightCollapsible';
import { useNavigate } from 'react-router-dom';

type ExpandedSection = 'economics' | 'time' | 'dealType' | 'install' | null;

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
}

export const InsightsDealsTab = ({ dateRange }: InsightsDealsTabProps) => {
  const { insights, isLoading } = useCustomerInsights(dateRange);
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const navigate = useNavigate();

  const handleSectionToggle = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
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
            {insights.hasMoneySpentData && insights.prmrToCostRatio > 0 && (
              <> · <span className="text-success font-medium">{insights.prmrToCostRatio.toFixed(1)}x</span> ROI</>
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
                {insights.prmrToCostRatio > 0 && (
                  <div className="p-3 rounded-xl bg-success/10">
                    <div className="text-sm text-muted-foreground">ROI</div>
                    <div className="text-xl font-bold text-success">{insights.prmrToCostRatio.toFixed(1)}x</div>
                    <div className="text-xs text-muted-foreground">PRMR ÷ Cost</div>
                  </div>
                )}
              </div>
              
              <div className="p-3 rounded-xl bg-primary/10">
                <div className="flex justify-between items-center">
                  <div>
                    <div className="text-sm text-muted-foreground">Total PRMR</div>
                    <div className="text-xl font-bold text-primary">${insights.totalPrmr.toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">Total Spent</div>
                    <div className="text-xl font-bold">${insights.totalMoneySpent.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </>
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
