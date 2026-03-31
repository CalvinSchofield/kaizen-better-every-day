import { TrendingUp, TrendingDown, Flame, Zap } from "lucide-react";
import { useWeeklyComparison } from "@/hooks/useWeeklyComparison";
import { Skeleton } from "@/components/ui/skeleton";

export const WeeklyActivityCard = () => {
  const { comparisonData, isLoading } = useWeeklyComparison();

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  if (!comparisonData || (comparisonData.thisWeek.daysWorked === 0 && !comparisonData.hasLastWeek)) {
    return null;
  }

  // Pick the most motivating stat to highlight
  const highlights: { label: string; value: string; positive: boolean }[] = [];

  if (comparisonData.hasLastWeek) {
    const d = comparisonData.delta;
    if (d.doors !== 0) {
      highlights.push({
        label: "doors vs last week",
        value: `${d.doors > 0 ? '+' : ''}${d.doors}`,
        positive: d.doors > 0,
      });
    }
    if (d.fpPlus !== 0) {
      highlights.push({
        label: "FP vs last week",
        value: `${d.fpPlus > 0 ? '+' : ''}${d.fpPlus}`,
        positive: d.fpPlus > 0,
      });
    }
    if (d.closes !== 0) {
      highlights.push({
        label: "closes vs last week",
        value: `${d.closes > 0 ? '+' : ''}${d.closes}`,
        positive: d.closes > 0,
      });
    }
  }

  // Show current week stats if no comparison or as fallback
  const tw = comparisonData.thisWeek;
  const showCurrentOnly = !comparisonData.hasLastWeek && tw.daysWorked > 0;

  // Pick best highlight (prefer positive, then FP, then doors)
  const bestHighlight = highlights.find(h => h.positive) || highlights[0];

  return (
    <div className="bg-card border border-border/50 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {comparisonData.currentStreak >= 2 ? (
            <Flame className="h-4 w-4 text-orange-500 shrink-0" />
          ) : (
            <Zap className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-semibold text-foreground truncate">
            This Week
          </span>
        </div>
        {comparisonData.currentStreak >= 2 && (
          <span className="text-xs font-medium text-orange-500 shrink-0">
            {comparisonData.currentStreak}-day streak 🔥
          </span>
        )}
      </div>

      {/* Quick stats row */}
      <div className="flex items-center gap-4 mt-3 text-sm">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{tw.doors}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Doors</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{tw.fpPlus}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">FP</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{tw.closes}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Closes</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{tw.daysWorked}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Days</p>
        </div>
      </div>

      {/* Delta callout */}
      {bestHighlight && (
        <div className={`flex items-center gap-1.5 mt-3 text-xs font-medium ${
          bestHighlight.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
        }`}>
          {bestHighlight.positive ? (
            <TrendingUp className="h-3.5 w-3.5" />
          ) : (
            <TrendingDown className="h-3.5 w-3.5" />
          )}
          <span>{bestHighlight.value} {bestHighlight.label}</span>
        </div>
      )}

      {showCurrentOnly && (
        <p className="text-xs text-muted-foreground mt-2">
          Keep going — next week you'll see your progress!
        </p>
      )}
    </div>
  );
};
