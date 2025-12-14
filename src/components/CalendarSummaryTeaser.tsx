import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Sparkles, BarChart3, ChevronRight, History } from "lucide-react";
import { format } from "date-fns";
import { useEfpMode } from "@/hooks/useEfpMode";
import { SeasonType } from "@/utils/seasonWeekUtils";

interface CumulativeComparison {
  currentTotal: number;
  historicalTotal: number;
  delta: number;
  throughDayNumber: number;
  seasonType: SeasonType;
}

interface PeriodHistoricalTotals {
  fpPlus: number;
  prmr: number;
  week?: number;
}

interface CalendarSummaryTeaserProps {
  viewMode: "week" | "month";
  weekStart: Date;
  weekEnd: Date;
  currentDate: Date;
  viewTotals: {
    fpPlus: number;
    prmr: number;
    upgradePrmr: number;
    doorsKnocked: number;
    closes: number;
    daysWorked: number;
  };
  prevPeriodTotals: {
    fpPlus: number;
    prmr: number;
    daysWorked: number;
  };
  entries: any[];
  // Me vs Me historical props
  cumulativeComparison?: CumulativeComparison | null;
  periodHistoricalTotals?: PeriodHistoricalTotals | null;
  comparisonYear?: number;
  hasHistoricalData?: boolean;
}

export const CalendarSummaryTeaser = ({
  viewMode,
  weekStart,
  weekEnd,
  currentDate,
  viewTotals,
  prevPeriodTotals,
  entries,
  cumulativeComparison,
  periodHistoricalTotals,
  comparisonYear,
  hasHistoricalData = false,
}: CalendarSummaryTeaserProps) => {
  const navigate = useNavigate();
  const { efpModeEnabled, calculateEfp } = useEfpMode();

  // Calculate period-over-period change
  const fpChange = viewTotals.fpPlus - prevPeriodTotals.fpPlus;
  const isImproving = fpChange >= 0;
  const hasPrevData = prevPeriodTotals.daysWorked > 0;

  // Generate spotlight insight - find the most compelling fact
  const spotlightInsight = useMemo(() => {
    if (viewTotals.daysWorked === 0) return null;

    const insights: { text: string; priority: number }[] = [];

    // Find best day in period
    const periodStart = viewMode === "week" ? weekStart : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const periodEntries = entries.filter(e => {
      const [year, month, day] = e.entry_date.split('-').map(Number);
      const entryDate = new Date(year, month - 1, day);
      if (viewMode === "week") {
        return entryDate >= weekStart && entryDate <= new Date(weekStart.getTime() + 6 * 24 * 60 * 60 * 1000);
      }
      return entryDate.getMonth() === currentDate.getMonth() && entryDate.getFullYear() === currentDate.getFullYear();
    }).filter(e => e.is_finalized && ((e.fp_plus || 0) > 0 || (e.prmr || 0) > 0));

    if (periodEntries.length > 0) {
      // Sort by EFP (prmr/85) if efpModeEnabled, otherwise FP+
      const bestDay = periodEntries.reduce((best, entry) => {
        if (efpModeEnabled) {
          const entryEfp = (entry.prmr || 0) / 85;
          const bestEfp = (best.prmr || 0) / 85;
          return entryEfp > bestEfp ? entry : best;
        }
        return (entry.fp_plus || 0) > (best.fp_plus || 0) ? entry : best;
      });
      
      // Compare using EFP or FP+ based on mode
      const avgValue = efpModeEnabled 
        ? calculateEfp(viewTotals.prmr) / viewTotals.daysWorked
        : viewTotals.fpPlus / viewTotals.daysWorked;
      const bestDayValue = efpModeEnabled 
        ? calculateEfp(bestDay.prmr || 0)
        : (bestDay.fp_plus || 0);
      
      if (bestDayValue >= avgValue * 1.5) {
        const dayName = format(new Date(bestDay.entry_date + 'T12:00:00'), 'EEE');
        const fpValue = efpModeEnabled ? calculateEfp(bestDay.prmr || 0).toFixed(1) : (bestDay.fp_plus || 0).toFixed(1);
        insights.push({ 
          text: `Best day: ${dayName} ${fpValue} ${efpModeEnabled ? 'EFP' : 'FP+'}`, 
          priority: 3 
        });
      }
    }

    // Strong doors-to-close ratio
    if (viewTotals.doorsKnocked > 0 && viewTotals.closes > 0) {
      const doorsPerClose = viewTotals.doorsKnocked / viewTotals.closes;
      if (doorsPerClose < 50) {
        insights.push({ 
          text: `${Math.round(doorsPerClose)} doors per close`, 
          priority: 2 
        });
      }
    }

    // Improvement trend
    if (hasPrevData && fpChange > 0) {
      insights.push({ 
        text: `+${fpChange.toFixed(1)} vs last ${viewMode}`, 
        priority: 1 
      });
    }

    // Days worked
    if (viewTotals.daysWorked >= 5) {
      insights.push({ 
        text: `${viewTotals.daysWorked} days knocked`, 
        priority: 0 
      });
    }

    // Sort by priority and return the best one
    insights.sort((a, b) => b.priority - a.priority);
    return insights[0]?.text || `${viewTotals.daysWorked} day${viewTotals.daysWorked !== 1 ? 's' : ''} worked`;
  }, [viewTotals, prevPeriodTotals, entries, viewMode, weekStart, currentDate, efpModeEnabled, calculateEfp, hasPrevData, fpChange]);

  // Navigate to insights with date range
  const handleNavigateToInsights = () => {
    // Pass actual start and end dates so Insights can match to preset or use custom
    const startDate = viewMode === "week" 
      ? format(weekStart, 'yyyy-MM-dd')
      : format(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1), 'yyyy-MM-dd');
    const endDate = viewMode === "week"
      ? format(weekEnd, 'yyyy-MM-dd')
      : format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'yyyy-MM-dd');
    
    navigate(`/insights?start=${startDate}&end=${endDate}`);
  };

  // Primary metric value
  const primaryValue = efpModeEnabled 
    ? calculateEfp(viewTotals.prmr).toFixed(1)
    : viewTotals.fpPlus % 1 === 0 ? viewTotals.fpPlus.toString() : viewTotals.fpPlus.toFixed(1);
  const primaryLabel = efpModeEnabled ? "EFP" : "FP+";

  // Secondary metric
  const secondaryValue = efpModeEnabled
    ? (viewTotals.fpPlus % 1 === 0 ? viewTotals.fpPlus.toString() : viewTotals.fpPlus.toFixed(1))
    : `$${viewTotals.prmr.toFixed(0)}`;
  const secondaryLabel = efpModeEnabled ? "FP+" : "PRMR";

  // Calculate historical comparison for current period
  const periodHistoricalDelta = useMemo(() => {
    if (!hasHistoricalData || !periodHistoricalTotals) return null;
    const currentValue = efpModeEnabled ? calculateEfp(viewTotals.prmr) : viewTotals.fpPlus;
    const historicalValue = efpModeEnabled ? calculateEfp(periodHistoricalTotals.prmr) : periodHistoricalTotals.fpPlus;
    return currentValue - historicalValue;
  }, [hasHistoricalData, periodHistoricalTotals, viewTotals, efpModeEnabled, calculateEfp]);

  return (
    <div 
      onClick={handleNavigateToInsights}
      className="mt-6 rounded-xl bg-gradient-to-br from-primary/5 via-card to-primary/10 border border-border overflow-hidden cursor-pointer hover:border-primary/40 transition-all group"
    >
      {/* Main Content */}
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <BarChart3 className="h-3.5 w-3.5" />
          <span className="font-medium">
            {viewMode === "month" ? format(currentDate, 'MMMM yyyy') : `Week of ${format(weekStart, 'MMM d')}`}
          </span>
        </div>

        {/* Metrics Row */}
        <div className="flex items-end justify-between">
          {/* Primary Metrics */}
          <div className="flex items-baseline gap-4">
            <div>
              <span className="text-3xl font-bold text-primary">{primaryValue}</span>
              <span className="text-sm text-muted-foreground ml-1">{primaryLabel}</span>
            </div>
            <div>
              <span className="text-lg font-semibold text-foreground">{secondaryValue}</span>
              <span className="text-xs text-muted-foreground ml-1">{secondaryLabel}</span>
            </div>
          </div>

          {/* Spotlight Insight */}
          {spotlightInsight && (
            <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-2.5 py-1 rounded-full">
              <Sparkles className="h-3 w-3" />
              <span className="text-xs font-medium">{spotlightInsight}</span>
            </div>
          )}
        </div>

        {/* Comparison Badge */}
        {hasPrevData && (
          <div className={`mt-3 flex items-center gap-1.5 text-xs ${
            isImproving ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"
          }`}>
            {isImproving ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            <span>
              {isImproving ? "+" : ""}{fpChange.toFixed(1)} {efpModeEnabled ? 'EFP' : 'FP+'} vs last {viewMode}
            </span>
          </div>
        )}

        {/* Me vs Me Historical Comparison Section */}
        {hasHistoricalData && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
            {/* Period vs Last Year */}
            {periodHistoricalDelta !== null && (
              <div className="flex items-center gap-1.5 text-xs">
                <History className="h-3 w-3 text-muted-foreground" />
                <span className={periodHistoricalDelta >= 0 ? "text-green-600 dark:text-green-400" : "text-orange-600 dark:text-orange-400"}>
                  {periodHistoricalDelta >= 0 ? "+" : ""}{periodHistoricalDelta.toFixed(1)} {efpModeEnabled ? 'EFP' : 'FP+'}
                </span>
                <span className="text-muted-foreground">
                  vs '{String(comparisonYear).slice(-2)} {viewMode === 'week' && periodHistoricalTotals?.week ? `Week ${periodHistoricalTotals.week}` : format(currentDate, 'MMM')}
                </span>
              </div>
            )}

            {/* Cumulative "Through Day X" */}
            {cumulativeComparison && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Through Day {cumulativeComparison.throughDayNumber}:</span>
                <span className={cumulativeComparison.delta >= 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-orange-600 dark:text-orange-400 font-medium"}>
                  {cumulativeComparison.delta >= 0 ? "+" : ""}{cumulativeComparison.delta.toFixed(1)} {efpModeEnabled ? 'EFP' : 'FP+'} vs '{String(comparisonYear).slice(-2)}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CTA Footer */}
      <div className="px-4 py-2.5 bg-muted/30 border-t border-border/50 flex items-center justify-between group-hover:bg-muted/50 transition-colors">
        <span className="text-xs font-medium text-muted-foreground">See full insights</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </div>
  );
};