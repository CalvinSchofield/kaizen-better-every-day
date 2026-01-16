import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActivitySummary } from "@/hooks/useActivitySummary";
import { useDailyFocus } from "@/hooks/useDailyFocus";
import { ComparisonSparkline } from "@/components/ComparisonSparkline";
import { useNavigate } from "react-router-dom";
import { useEfpMode } from "@/hooks/useEfpMode";
import { useMemo } from "react";

interface ActivitySummaryCardProps {
  repData: any;
}

export const ActivitySummaryCard = ({ repData }: ActivitySummaryCardProps) => {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useActivitySummary(repData);
  const { efpModeEnabled, calculateEfp } = useEfpMode();

  // Prepare data for daily focus (only for "Today" mode with data)
  const focusParams = summary && summary.mode === "preseason" && !summary.isEmpty && summary.daysWorked > 0 ? {
    today: {
      doors: summary.totals.doors,
      pitches: 0, // Not tracked in ActivitySummary but we'll pass 0 for now
      transitions: summary.totals.transitions,
      presentations: 0, // Not tracked in ActivitySummary
      closes: 0, // Not tracked in ActivitySummary
      fp: summary.totals.fp
    },
    comparison: summary.comparison || { fpChange: 0, label: "" },
    avgDoors: summary.dailyAverages.doors,
    avgFp: summary.dailyAverages.fp
  } : null;

  const { data: dailyFocus, isLoading: focusLoading } = useDailyFocus(focusParams);

  if (isLoading || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  // Empty state for preseason
  if (summary.mode === "preseason" && summary.isEmpty) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>{summary.title}</CardTitle>
          <CardDescription>Start tracking your progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-2xl font-semibold text-muted-foreground">
            Go knock some doors! 🚪
          </p>
          <Button
            className="w-full"
            onClick={() => navigate("/track")}
          >
            Start Tracking
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isRookie = repData?.year === "Rookie";
  const isBlitzMode = summary.mode === "blitz";
  const previousBlitzFp = summary.comparison?.previousBlitzFp || 0;
  const hasNoBlitzEntries = isBlitzMode && summary.daysWorked === 0 && previousBlitzFp > 0;
  // Calculate EFP for display - prmr field IS total PRMR (already includes upgrade)
  const totalPrmr = summary.totals.prmr;
  const efpValue = efpModeEnabled ? calculateEfp(summary.totals.prmr) : 0;
  
  // Calculate previous period EFP if in EFP mode and comparison exists
  const previousPeriodEfp = efpModeEnabled && summary.comparison?.previousPeriodPrmr 
    ? calculateEfp(summary.comparison.previousPeriodPrmr) 
    : 0;
  
  // Calculate day-aligned previous EFP for comparison using actual PRMR change
  const previousEfpAtSameDays = efpModeEnabled && summary.comparison?.previousDayAlignedPrmr !== undefined
    ? calculateEfp(summary.comparison.previousDayAlignedPrmr)
    : 0;
  const efpChange = efpModeEnabled ? efpValue - previousEfpAtSameDays : 0;
  
  const isImproving = efpModeEnabled 
    ? efpChange >= 0
    : summary.comparison && summary.comparison.fpChange >= 0;

  // Build dynamic metrics based on priority and non-zero values
  const allMetrics = efpModeEnabled ? [
    { key: 'efp', label: 'EFP', value: efpValue, displayValue: efpValue.toFixed(2), avgValue: summary.daysWorked > 1 ? (efpValue / summary.daysWorked).toFixed(2) : null },
    { key: 'fp', label: 'FP+', value: summary.totals.fp, displayValue: summary.totals.fp.toFixed(1), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.fp.toFixed(1) : null },
    { key: 'closes', label: 'Closes', value: summary.totals.closes || 0, displayValue: (summary.totals.closes || 0).toString(), avgValue: summary.daysWorked > 1 ? ((summary.totals.closes || 0) / summary.daysWorked).toFixed(1) : null },
    { key: 'presentations', label: 'Presentations', value: summary.totals.presentations, displayValue: summary.totals.presentations.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.presentations.toFixed(1) : null },
    { key: 'transitions', label: 'Transitions', value: summary.totals.transitions, displayValue: summary.totals.transitions.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.transitions.toFixed(1) : null },
    { key: 'pitches', label: 'Pitches', value: summary.totals.pitches, displayValue: summary.totals.pitches.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.pitches.toFixed(1) : null },
    { key: 'dms', label: 'Decision Makers', value: summary.totals.decisionMakers || 0, displayValue: (summary.totals.decisionMakers || 0).toString(), avgValue: summary.daysWorked > 1 ? ((summary.totals.decisionMakers || 0) / summary.daysWorked).toFixed(1) : null },
    { key: 'doors', label: 'Doors', value: summary.totals.doors, displayValue: summary.totals.doors.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.doors.toFixed(0) : null },
  ] : [
    { key: 'fp', label: 'FP+', value: summary.totals.fp, displayValue: summary.totals.fp.toFixed(1), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.fp.toFixed(1) : null },
    { key: 'prmr', label: 'PRMR', value: summary.totals.prmr, displayValue: `$${summary.totals.prmr}`, avgValue: summary.daysWorked > 1 ? `$${summary.dailyAverages.prmr.toFixed(0)}` : null },
    { key: 'closes', label: 'Closes', value: summary.totals.closes || 0, displayValue: (summary.totals.closes || 0).toString(), avgValue: summary.daysWorked > 1 ? ((summary.totals.closes || 0) / summary.daysWorked).toFixed(1) : null },
    { key: 'presentations', label: 'Presentations', value: summary.totals.presentations, displayValue: summary.totals.presentations.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.presentations.toFixed(1) : null },
    { key: 'transitions', label: 'Transitions', value: summary.totals.transitions, displayValue: summary.totals.transitions.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.transitions.toFixed(1) : null },
    { key: 'pitches', label: 'Pitches', value: summary.totals.pitches, displayValue: summary.totals.pitches.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.pitches.toFixed(1) : null },
    { key: 'dms', label: 'Decision Makers', value: summary.totals.decisionMakers || 0, displayValue: (summary.totals.decisionMakers || 0).toString(), avgValue: summary.daysWorked > 1 ? ((summary.totals.decisionMakers || 0) / summary.daysWorked).toFixed(1) : null },
    { key: 'doors', label: 'Doors', value: summary.totals.doors, displayValue: summary.totals.doors.toString(), avgValue: summary.daysWorked > 1 ? summary.dailyAverages.doors.toFixed(0) : null },
  ];

  const topMetrics = allMetrics.filter(m => m.value > 0).slice(0, 4);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{summary.title}</CardTitle>
        {summary.subtitle && <CardDescription>{summary.subtitle}</CardDescription>}
        {summary.mode === "preseason" && !summary.isEmpty && (
          <CardDescription>{summary.daysWorked} day{summary.daysWorked !== 1 ? "s" : ""} worked</CardDescription>
        )}
        {summary.mode === "blitz" && summary.daysWorked > 0 && (
          <CardDescription>{summary.daysWorked} day{summary.daysWorked !== 1 ? "s" : ""} with activity</CardDescription>
        )}
        {summary.mode === "summer" && (
          <CardDescription>{summary.daysWorked} day{summary.daysWorked !== 1 ? "s" : ""} worked</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Empty Blitz Encouragement */}
        {hasNoBlitzEntries && (
          <div className="text-center p-4 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm font-medium mb-2">Track your blitz progress! 📊</p>
            <p className="text-xs text-muted-foreground mb-3">
              Log your doors, pitches, and sales. Remember to differentiate between new FP and upgrades!
            </p>
            <Button
              size="sm"
              onClick={() => navigate("/track")}
              className="w-full"
            >
              Start Tracking
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Metrics Grid */}
        {!hasNoBlitzEntries && (
          <div className="grid grid-cols-4 gap-3">
            {topMetrics.map((metric) => (
              <div key={metric.key} className="text-center">
                <p className="text-2xl font-bold text-primary">{metric.displayValue}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{metric.label}</p>
                {metric.avgValue && (
                  <p className="text-xs text-muted-foreground/60 mt-0.5">
                    {metric.avgValue}/day
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Comparison Chart for Blitz/Summer modes */}
        {summary.comparisonChartData && (summary.mode === "blitz" || summary.mode === "summer") && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">
              {efpModeEnabled ? "EFP" : "FP+"} comparison
            </p>
            <ComparisonSparkline
              currentData={summary.comparisonChartData.current.map(d => ({
                day: d.day,
                value: efpModeEnabled ? calculateEfp((d as any).prmr || 0) : d.value,
              }))}
              previousData={summary.comparisonChartData.previous.map(d => ({
                day: d.day,
                value: efpModeEnabled ? calculateEfp((d as any).prmr || 0) : d.value,
              }))}
              currentLabel={summary.comparisonChartData.currentLabel}
              previousLabel={summary.comparisonChartData.previousLabel}
              metric={efpModeEnabled ? "EFP" : "FP+"}
            />
          </div>
        )}

        {/* Upfront Pay - Only show if rep has an install scheduled/installed this week */}
        {summary.hasInstallThisWeek && (
          <div className="text-center pt-2 border-t">
            <p className="text-sm font-semibold text-muted-foreground">
              Anticipated Upfront Pay:{" "}
              <span className="text-base text-green-800 dark:text-green-500">
                ${summary.upfrontPay.toLocaleString()}
              </span>
            </p>
            {summary.totalMoneySpent > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Spent: <span className="text-destructive">${summary.totalMoneySpent.toLocaleString()}</span>
                {" → "}Net: <span className="text-green-700 dark:text-green-400 font-medium">
                  ${(summary.upfrontPay - summary.totalMoneySpent).toLocaleString()}
                </span>
              </p>
            )}
          </div>
        )}

        {/* Daily Focus - AI generated one-liner */}
        {dailyFocus && summary.mode === "preseason" && (
          <div className="pt-2 border-t">
            <p className="text-sm text-center text-muted-foreground italic">
              {dailyFocus}
            </p>
          </div>
        )}
        {focusLoading && summary.mode === "preseason" && (
          <div className="pt-2 border-t">
            <div className="h-4 w-4/5 bg-muted rounded animate-pulse mx-auto" />
          </div>
        )}

        {/* Comparison */}
        {summary.comparison && (
          <div className="text-center pt-4 border-t space-y-1">
            {summary.comparison.showComparison ? (
              <>
                <div className="flex items-center justify-center gap-2">
                  {isImproving ? (
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                  <span className={`text-sm font-medium ${
                    isImproving
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}>
                    {efpModeEnabled ? (
                      <>{isImproving ? "+" : ""}{efpChange.toFixed(2)} EFP</>
                    ) : (
                      <>{isImproving ? "+" : ""}{summary.comparison.fpChange.toFixed(1)} FP+</>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    vs {summary.comparison.label}
                  </span>
                </div>
                {/* Subtle totals */}
                <p className="text-[10px] text-muted-foreground/60">
                  {efpModeEnabled ? (
                    <>
                      {efpValue.toFixed(2)} EFP total {summary.mode === "blitz" ? "this blitz" : "this week"}
                      {summary.comparison.previousPeriodTotal !== undefined && (
                        <> · {previousPeriodEfp.toFixed(2)} EFP total {summary.mode === "blitz" ? "last blitz" : "last week"}</>
                      )}
                    </>
                  ) : (
                    <>
                      {summary.totals.fp.toFixed(1)} FP+ total {summary.mode === "blitz" ? "this blitz" : "this week"}
                      {summary.comparison.previousPeriodTotal !== undefined && (
                        <> · {summary.comparison.previousPeriodTotal.toFixed(1)} FP+ total {summary.mode === "blitz" ? "last blitz" : "last week"}</>
                      )}
                    </>
                  )}
                </p>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">
                    {efpModeEnabled ? (
                      <>{efpValue.toFixed(2)} EFP</>
                    ) : (
                      <>{summary.totals.fp.toFixed(1)} FP+</>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground/60">
                    total {summary.mode === "blitz" ? "this blitz" : "this week"}
                  </span>
                </div>
                {summary.comparison.previousPeriodTotal !== undefined && (
                  <p className="text-[10px] text-muted-foreground/60">
                    {efpModeEnabled ? (
                      <>
                        {previousPeriodEfp.toFixed(2)} EFP total {summary.mode === "blitz" ? "last blitz" : "last week"}
                      </>
                    ) : (
                      <>
                        {summary.comparison.previousPeriodTotal.toFixed(1)} FP+ total {summary.mode === "blitz" ? "last blitz" : "last week"}
                      </>
                    )}
                    {summary.comparison.previousDaysWorked && (
                      <> · Need {summary.comparison.previousDaysWorked - summary.daysWorked} more day{summary.comparison.previousDaysWorked - summary.daysWorked !== 1 ? 's' : ''} to compare</>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
