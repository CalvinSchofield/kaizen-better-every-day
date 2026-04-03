import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { GOAL_TIER_CONFIG } from '@/config/goalTiers';
import { formatFP } from '@/lib/formatters';
import type { GoalPaceData, PaceSeverity } from '@/hooks/useGoalPaceCalculator';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface RepGoalSnapshotProps {
  goalPaceData: GoalPaceData;
  periodFp: number;
  periodLabel: string;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
}

const SEASON_START_STR = '2025-09-28';

const severityConfig: Record<PaceSeverity, { label: string; color: string; bg: string; icon: typeof TrendingUp }> = {
  green: { label: 'On Pace', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: TrendingUp },
  amber: { label: 'At Risk', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: Minus },
  red: { label: 'Behind', color: 'text-red-500', bg: 'bg-red-500/10', icon: TrendingDown },
};

export const RepGoalSnapshot = ({
  goalPaceData,
  periodFp,
  periodLabel,
  dateRangeStart,
  dateRangeEnd,
}: RepGoalSnapshotProps) => {
  const {
    activeGoal,
    unbufferedGoal,
    tierLabel,
    focusTier,
    isPreseason,
    metricLabel,
    dailyNeeded,
    severity,
    currentProgress,
    season,
  } = goalPaceData;

  const tierKey = focusTier === 'preseason' ? 'preseason' : focusTier;
  const tierCfg = GOAL_TIER_CONFIG[tierKey as keyof typeof GOAL_TIER_CONFIG];

  // Original planned pace (goal / total planned days)
  const originalDailyPace = useMemo(() => {
    const totalPlannedDays = season.plannedDaysTotal;
    if (totalPlannedDays <= 0 || activeGoal <= 0) return 0;
    return activeGoal / totalPlannedDays;
  }, [activeGoal, season.plannedDaysTotal]);

  // Cumulative expected by end of selected date range
  const cumulativeExpectedByEndOfRange = useMemo(() => {
    if (!dateRangeEnd || originalDailyPace <= 0) return 0;
    const seasonStart = new Date(SEASON_START_STR + 'T00:00:00');
    const calDays = differenceInCalendarDays(dateRangeEnd, seasonStart) + 1;
    if (calDays <= 0) return 0;
    const estimatedWorkDays = Math.max(1, Math.round(calDays * (6 / 7)));
    return originalDailyPace * estimatedWorkDays;
  }, [dateRangeEnd, originalDailyPace]);

  // Period-only expected (just the window)
  const periodExpected = useMemo(() => {
    if (!dateRangeStart || !dateRangeEnd || originalDailyPace <= 0) return 0;
    const calDays = differenceInCalendarDays(dateRangeEnd, dateRangeStart) + 1;
    const estimatedWorkDays = Math.max(1, Math.round(calDays * (6 / 7)));
    return originalDailyPace * estimatedWorkDays;
  }, [dateRangeStart, dateRangeEnd, originalDailyPace]);

  // Pre-period progress: everything produced before the range
  // Approximation: currentProgress - periodFp (includes post-range production but close enough)
  const prePeriodFp = useMemo(() => {
    return Math.max(0, currentProgress - periodFp);
  }, [currentProgress, periodFp]);

  // Stacked bar percentages (relative to cumulative expected by end of range)
  const barScale = cumulativeExpectedByEndOfRange;
  const prePeriodPercent = barScale > 0 ? Math.min(100, (prePeriodFp / barScale) * 100) : 0;
  const periodPercent = barScale > 0 ? Math.min(100 - prePeriodPercent, (periodFp / barScale) * 100) : 0;
  const totalPercent = prePeriodPercent + periodPercent;

  const showPeriodRow = periodExpected > 0 && dateRangeStart && dateRangeEnd;

  // Season progress
  const seasonGoal = unbufferedGoal || activeGoal;
  const seasonPercent = seasonGoal > 0
    ? Math.min(100, (currentProgress / seasonGoal) * 100)
    : 0;

  const paceDiff = season.paceDiff;
  const sev = severityConfig[severity];
  const SevIcon = sev.icon;

  // Period performance color for the text
  const periodTotal = prePeriodFp + periodFp;
  const periodIsAhead = periodTotal >= cumulativeExpectedByEndOfRange;
  const periodColor = cumulativeExpectedByEndOfRange <= 0
    ? 'text-muted-foreground'
    : periodIsAhead ? 'text-emerald-500' : 'text-amber-500';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Goal Progress
        </span>
        {tierCfg && (
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full",
            tierCfg.bgColor, tierCfg.color
          )}>
            {tierLabel}
          </span>
        )}
      </div>

      {/* Period Row — Stacked dual-segment bar */}
      {showPeriodRow && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{periodLabel}</span>
            <span className={cn("font-semibold tabular-nums", periodColor)}>
              {formatFP(periodFp)} / {formatFP(periodExpected)} {metricLabel}
            </span>
          </div>

          {/* Stacked progress bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted/30 dark:bg-muted/50 border border-border/30">
            {/* Pre-period segment (muted emerald) */}
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500/40 transition-all duration-700"
              style={{ width: `${Math.min(prePeriodPercent, 100)}%` }}
            />
            {/* Period segment (orange) */}
            <div
              className="absolute inset-y-0 rounded-r-full bg-amber-500 transition-all duration-700 shadow-sm"
              style={{
                left: `${Math.min(prePeriodPercent, 100)}%`,
                width: `${Math.min(periodPercent, 100 - Math.min(prePeriodPercent, 100))}%`,
              }}
            />
          </div>

          {/* Legend row */}
          <div className="flex items-center justify-between text-[9px]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500/40" />
                Prior: {formatFP(prePeriodFp)}
              </span>
              <span className="flex items-center gap-1 text-amber-500">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                {periodLabel}: {formatFP(periodFp)}
              </span>
            </div>
            <span className={cn("font-semibold tabular-nums", periodColor)}>
              {Math.round(totalPercent)}%
            </span>
          </div>
        </div>
      )}

      {/* Season Row */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            {isPreseason ? 'Preseason' : 'Season'}
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {formatFP(currentProgress)} / {formatFP(seasonGoal)} {metricLabel}
          </span>
        </div>
        <div className="relative">
          <Progress value={seasonPercent} className="h-2" />
        </div>
        {/* Pace badge */}
        <div className="flex items-center justify-end gap-1.5">
          <div className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
            sev.bg, sev.color
          )}>
            <SevIcon className="w-3 h-3" />
            {sev.label}
            {paceDiff !== 0 && (
              <span className="tabular-nums ml-0.5">
                {paceDiff > 0 ? '+' : ''}{formatFP(paceDiff)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(seasonPercent)}%
          </span>
        </div>
      </div>
    </div>
  );
};
