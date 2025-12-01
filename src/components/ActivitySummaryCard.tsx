import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActivitySummary } from "@/hooks/useActivitySummary";
import { useDailyFocus } from "@/hooks/useDailyFocus";
import { FPSparkline } from "@/components/FPSparkline";
import { useNavigate } from "react-router-dom";
import { useEfpMode } from "@/hooks/useEfpMode";

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
  const shouldShowActivityMetrics = isRookie && isBlitzMode && previousBlitzFp > 0 && previousBlitzFp < 2;

  // Calculate EFP for display
  const efpValue = efpModeEnabled ? calculateEfp(summary.totals.prmr) : 0;
  
  // Calculate previous period EFP if in EFP mode and comparison exists
  const previousPeriodEfp = efpModeEnabled && summary.comparison?.previousPeriodTotal 
    ? calculateEfp((summary.comparison.previousPeriodTotal || 0) * 85) 
    : 0;
  
  // Calculate day-aligned previous EFP for comparison
  const dayAlignedPreviousEfp = efpModeEnabled && summary.comparison?.fpChange !== undefined
    ? calculateEfp((summary.totals.prmr || 0)) - calculateEfp(((summary.totals.prmr || 0) - (summary.comparison.fpChange * 85)))
    : 0;
  
  const isImproving = efpModeEnabled 
    ? dayAlignedPreviousEfp >= 0
    : summary.comparison && summary.comparison.fpChange >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{summary.title}</CardTitle>
        {summary.subtitle && <CardDescription>{summary.subtitle}</CardDescription>}
        {summary.mode === "preseason" && !summary.isEmpty && (
          <CardDescription>{summary.daysWorked} day{summary.daysWorked !== 1 ? "s" : ""} worked</CardDescription>
        )}
        {summary.mode !== "preseason" && (
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
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{summary.totals.doors}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">Doors</p>
              {summary.daysWorked > 1 && (
                <p className="text-xs text-muted-foreground/60 mt-0.5">
                  {summary.dailyAverages.doors.toFixed(0)}/day
                </p>
              )}
            </div>

            {shouldShowActivityMetrics ? (
              <>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totals.pitches}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Pitches</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {summary.dailyAverages.pitches.toFixed(1)}/day
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totals.transitions}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Transitions</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {summary.dailyAverages.transitions.toFixed(1)}/day
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totals.presentations}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Presentations</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {summary.dailyAverages.presentations.toFixed(1)}/day
                    </p>
                  )}
                </div>
              </>
            ) : efpModeEnabled ? (
              <>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{efpValue.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">EFP</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {(efpValue / summary.daysWorked).toFixed(2)}/day
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totals.fp.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">FP+</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {summary.dailyAverages.fp.toFixed(1)}/day
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totals.transitions}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Transitions</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {summary.dailyAverages.transitions.toFixed(1)}/day
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totals.transitions}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">Transitions</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {summary.dailyAverages.transitions.toFixed(1)}/day
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{summary.totals.fp.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">FP+</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {summary.dailyAverages.fp.toFixed(1)}/day
                    </p>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">${summary.totals.prmr}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">PRMR</p>
                  {summary.daysWorked > 1 && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      ${summary.dailyAverages.prmr.toFixed(0)}/day
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Sparkline Chart */}
        {summary.chartData.length > 1 && (
          <div className="pt-2">
            <p className="text-xs text-muted-foreground mb-2">FP+ trend</p>
            <FPSparkline data={summary.chartData} />
          </div>
        )}

        {/* Upfront Pay */}
        <div className="text-center pt-2 border-t">
          <p className="text-sm font-semibold text-muted-foreground">
            Anticipated Upfront Pay:{" "}
            <span className="text-base text-green-800 dark:text-green-500">
              ${summary.upfrontPay.toLocaleString()}
            </span>
          </p>
        </div>

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
                      <>{isImproving ? "+" : ""}{dayAlignedPreviousEfp.toFixed(2)} EFP</>
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
                      <br />
                      {summary.totals.fp.toFixed(1)} FP+ total {summary.mode === "blitz" ? "this blitz" : "this week"}
                      {summary.comparison.previousPeriodTotal !== undefined && (
                        <> · {summary.comparison.previousPeriodTotal.toFixed(1)} FP+ total {summary.mode === "blitz" ? "last blitz" : "last week"}</>
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
                        <br />
                        {summary.comparison.previousPeriodTotal.toFixed(1)} FP+ total {summary.mode === "blitz" ? "last blitz" : "last week"}
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
