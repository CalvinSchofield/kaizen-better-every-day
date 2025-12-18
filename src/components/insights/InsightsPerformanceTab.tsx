import { Target, PieChart, Gauge, TrendingUp, TrendingDown } from 'lucide-react';
import { InsightsData } from '@/hooks/useInsightsData';
import { InsightsSectionHeader } from './InsightsSectionHeader';
import { InsightCollapsible } from './InsightCollapsible';
import { SalesFunnelChart } from './SalesFunnelChart';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type ExpandedSection = 'funnel' | 'ratios' | 'productivity' | 'custom' | null;

// Helper to safely format numbers
const safeFormat = (value: number, decimals: number = 1, suffix: string = ''): string => {
  if (!isFinite(value) || isNaN(value) || value < 0) return '-';
  return `${value.toFixed(decimals)}${suffix}`;
};

interface InsightsPerformanceTabProps {
  insights: InsightsData;
  efpModeEnabled: boolean;
  repData: any;
}

export const InsightsPerformanceTab = ({
  insights,
  efpModeEnabled,
  repData,
}: InsightsPerformanceTabProps) => {
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);

  const handleSectionToggle = (section: ExpandedSection) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const getRatioComparison = (current: number, overall: number) => {
    if (current === 0 || overall === 0) return null;
    const percentDiff = ((overall - current) / overall) * 100;
    const isBetter = current < overall;
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  const getCloseRatioComparison = (current: number, overall: number) => {
    if (current === 0 || overall === 0) return null;
    const percentDiff = ((current - overall) / overall) * 100;
    const isBetter = current < overall;
    return { percentDiff: Math.abs(percentDiff), isBetter };
  };

  const doorsComparison = efpModeEnabled 
    ? getRatioComparison(insights.doorsToEfp, insights.overallDoorsToEfp) 
    : getRatioComparison(insights.doorsToFp, insights.overallDoorsToFp);
  const pitchesComparison = efpModeEnabled
    ? getRatioComparison(insights.pitchesToEfp, insights.overallPitchesToEfp)
    : getRatioComparison(insights.pitchesToFp, insights.overallPitchesToFp);
  const transitionsComparison = efpModeEnabled
    ? getRatioComparison(insights.transitionsToEfp, insights.overallTransitionsToEfp)
    : getRatioComparison(insights.transitionsToFp, insights.overallTransitionsToFp);
  const closeComparison = getCloseRatioComparison(insights.presentationsToClose, insights.overallPresentationsToClose);

  return (
    <div className="space-y-4">
      <InsightsSectionHeader 
        icon={Target} 
        title="Performance" 
        description="Your conversion rates & efficiency"
      />

      {/* Sales Funnel */}
      <InsightCollapsible
        icon={PieChart}
        title="Sales Funnel"
        isOpen={expandedSection === 'funnel'}
        onToggle={() => handleSectionToggle('funnel')}
        preview={
          <span>
            {insights.funnelData.doors.total} doors → {insights.funnelData.closes.total} closes · <span className="text-primary font-medium">{safeFormat(insights.funnelData.doors.conversionToNext, 1, '%')}</span> DM rate
          </span>
        }
      >
        <SalesFunnelChart funnelData={insights.funnelData} />
      </InsightCollapsible>

      {/* Key Ratios */}
      <InsightCollapsible
        icon={Target}
        title="Key Ratios"
        isOpen={expandedSection === 'ratios'}
        onToggle={() => handleSectionToggle('ratios')}
        preview={
          <span>
            <span className="text-primary font-medium">
              {safeFormat(efpModeEnabled ? insights.doorsToEfp : insights.doorsToFp)}
            </span> doors per {efpModeEnabled ? "EFP" : "FP+"} · {safeFormat(insights.presentationsToClose)} pres/close
          </span>
        }
      >
        <div className="space-y-3">
          {/* Doors Ratio */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
            <div>
              <div className="text-sm text-muted-foreground">Doors → {efpModeEnabled ? "EFP" : "FP+"}</div>
              <div className="text-xl font-bold">{safeFormat(efpModeEnabled ? insights.doorsToEfp : insights.doorsToFp)}</div>
              <div className="text-xs text-muted-foreground">Overall: {safeFormat(efpModeEnabled ? insights.overallDoorsToEfp : insights.overallDoorsToFp)}</div>
            </div>
            {doorsComparison && (
              <div className={cn("flex items-center gap-1", doorsComparison.isBetter ? 'text-success' : 'text-destructive')}>
                {doorsComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-semibold">{doorsComparison.percentDiff.toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Pitches Ratio */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
            <div>
              <div className="text-sm text-muted-foreground">Pitches → {efpModeEnabled ? "EFP" : "FP+"}</div>
              <div className="text-xl font-bold">{safeFormat(efpModeEnabled ? insights.pitchesToEfp : insights.pitchesToFp)}</div>
              <div className="text-xs text-muted-foreground">Overall: {safeFormat(efpModeEnabled ? insights.overallPitchesToEfp : insights.overallPitchesToFp)}</div>
            </div>
            {pitchesComparison && (
              <div className={cn("flex items-center gap-1", pitchesComparison.isBetter ? 'text-success' : 'text-destructive')}>
                {pitchesComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-semibold">{pitchesComparison.percentDiff.toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Transitions Ratio */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
            <div>
              <div className="text-sm text-muted-foreground">Transitions → {efpModeEnabled ? "EFP" : "FP+"}</div>
              <div className="text-xl font-bold">{safeFormat(efpModeEnabled ? insights.transitionsToEfp : insights.transitionsToFp)}</div>
              <div className="text-xs text-muted-foreground">Overall: {safeFormat(efpModeEnabled ? insights.overallTransitionsToEfp : insights.overallTransitionsToFp)}</div>
            </div>
            {transitionsComparison && (
              <div className={cn("flex items-center gap-1", transitionsComparison.isBetter ? 'text-success' : 'text-destructive')}>
                {transitionsComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-semibold">{transitionsComparison.percentDiff.toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Close Ratio */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
            <div>
              <div className="text-sm text-muted-foreground">Presentations → Close</div>
              <div className="text-xl font-bold">{safeFormat(insights.presentationsToClose)}</div>
              <div className="text-xs text-muted-foreground">Overall: {safeFormat(insights.overallPresentationsToClose)}</div>
            </div>
            {closeComparison && (
              <div className={cn("flex items-center gap-1", closeComparison.isBetter ? 'text-success' : 'text-destructive')}>
                {closeComparison.isBetter ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm font-semibold">{closeComparison.percentDiff.toFixed(0)}%</span>
              </div>
            )}
          </div>

          {/* Doors to FP (new FP only) */}
          {insights.totalNewFp > 0 && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
              <div>
                <div className="text-sm text-muted-foreground">Doors → FP</div>
                <div className="text-xl font-bold">{safeFormat(insights.doorsToNewFp)}</div>
                <div className="text-xs text-muted-foreground">More accurate door efficiency</div>
              </div>
            </div>
          )}
        </div>
      </InsightCollapsible>

      {/* Productivity */}
      <InsightCollapsible
        icon={Gauge}
        title="Productivity per Hour"
        isOpen={expandedSection === 'productivity'}
        onToggle={() => handleSectionToggle('productivity')}
        preview={
          <span>
            <span className="text-primary font-medium">
              {safeFormat(efpModeEnabled ? insights.hoursToEfp : insights.hoursToFp)} hours
            </span> to sell 1 {efpModeEnabled ? "EFP" : "FP+"}
          </span>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-muted/30">
            <div className="text-sm text-muted-foreground">Doors/Hour</div>
            <div className="text-xl font-bold">{safeFormat(insights.doorsPerHour)}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <div className="text-sm text-muted-foreground">Pitches/Hour</div>
            <div className="text-xl font-bold">{safeFormat(insights.pitchesPerHour)}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <div className="text-sm text-muted-foreground">Transitions/Hour</div>
            <div className="text-xl font-bold">{safeFormat(insights.transitionsPerHour)}</div>
          </div>
          <div className="p-3 rounded-xl bg-muted/30">
            <div className="text-sm text-muted-foreground">Presentations/Hour</div>
            <div className="text-xl font-bold">{safeFormat(insights.presentationsPerHour)}</div>
          </div>
          <div className="col-span-2 p-3 rounded-xl bg-primary/10">
            <div className="text-sm text-muted-foreground">Hours to sell 1 {efpModeEnabled ? "EFP" : "FP+"}</div>
            <div className="text-xl font-bold text-primary">
              {safeFormat(efpModeEnabled ? insights.hoursToEfp : insights.hoursToFp, 1, 'h')}
            </div>
          </div>
        </div>
      </InsightCollapsible>

      {/* Personal Metrics (Custom Counters) - Only for Vets/Sophomores */}
      {(repData?.year === "Vet" || repData?.year === "Sophomore") && insights.customCounterTotals && Object.keys(insights.customCounterTotals).length > 0 && (
        <InsightCollapsible
          icon={Target}
          title="Personal Metrics"
          isOpen={expandedSection === 'custom'}
          onToggle={() => handleSectionToggle('custom')}
          preview={`Your custom tracking (${Object.keys(insights.customCounterTotals).length} counters)`}
        >
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Custom counters are not included in team leaderboards
            </p>
            {Object.entries(insights.customCounterTotals).map(([counterId, total]) => {
              const config = (repData?.custom_counter_config as any[])?.find((c: any) => c.id === counterId);
              if (!config) return null;
              
              const dailyAvg = (total as number) / insights.daysWorked;
              const perHour = insights.totalWorkMinutes > 0 
                ? ((total as number) / insights.totalWorkMinutes) * 60 
                : 0;
              
              return (
                <div key={counterId} className="p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{config.emoji}</span>
                    <span className="font-semibold">{config.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Total</div>
                      <div className="text-lg font-bold">{total}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Daily Avg</div>
                      <div className="text-lg font-bold">{dailyAvg.toFixed(1)}</div>
                    </div>
                    {perHour > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground">Per Hour</div>
                        <div className="text-lg font-bold">{perHour.toFixed(1)}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </InsightCollapsible>
      )}
    </div>
  );
};
