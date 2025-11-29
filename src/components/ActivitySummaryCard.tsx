import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useActivitySummary } from "@/hooks/useActivitySummary";
import { FPSparkline } from "@/components/FPSparkline";
import { useNavigate } from "react-router-dom";

interface ActivitySummaryCardProps {
  repData: any;
}

export const ActivitySummaryCard = ({ repData }: ActivitySummaryCardProps) => {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useActivitySummary(repData);

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

  const isImproving = summary.comparison && summary.comparison.fpChange >= 0;

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
        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{summary.totals.doors}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Doors</p>
            {summary.daysWorked > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {summary.dailyAverages.doors.toFixed(0)}/day
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{summary.totals.transitions}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Transitions</p>
            {summary.daysWorked > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {summary.dailyAverages.transitions.toFixed(1)}/day
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">{summary.totals.fp.toFixed(1)}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">FP+</p>
            {summary.daysWorked > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {summary.dailyAverages.fp.toFixed(1)}/day
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-primary">${summary.totals.prmr}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">PRMR</p>
            {summary.daysWorked > 0 && (
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                ${summary.dailyAverages.prmr.toFixed(0)}/day
              </p>
            )}
          </div>
        </div>

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

        {/* Comparison */}
        {summary.comparison && (
          <div
            className={`flex items-center gap-2 justify-center text-sm ${
              isImproving
                ? "text-green-600 dark:text-green-400"
                : "text-orange-600 dark:text-orange-400"
            }`}
          >
            {isImproving ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            <span>
              {isImproving ? "+" : ""}
              {summary.comparison.fpChange.toFixed(1)} FP+ {summary.comparison.label}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
