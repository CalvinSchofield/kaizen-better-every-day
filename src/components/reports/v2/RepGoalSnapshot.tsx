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

  // Period pace: use original planned pace (goal / total planned days), not catch-up pace
  // This gives a fair "what should they have produced in this window" expectation
  const originalDailyPace = useMemo(() => {
    const totalPlannedDays = season.plannedDaysTotal;
    if (totalPlannedDays <= 0 || activeGoal <= 0) return 0;
    return activeGoal / totalPlannedDays;
  }, [activeGoal, season.plannedDaysTotal]);

  const periodExpected = useMemo(() => {
    if (!dateRangeStart || !dateRangeEnd || originalDailyPace <= 0) return 0;
    const calDays = differenceInCalendarDays(dateRangeEnd, dateRangeStart) + 1;
    // Approximate planned days as ~6/7 of calendar days (typical knocking schedule)
    const estimatedWorkDays = Math.max(1, Math.round(calDays * (6 / 7)));
    return originalDailyPace * estimatedWorkDays;
  }, [dateRangeStart, dateRangeEnd, originalDailyPace]);

  const periodPercent = periodExpected > 0
    ? Math.min(100, (periodFp / periodExpected) * 100)
    : periodFp > 0 ? 100 : 0;

  // Season progress
  const seasonGoal = unbufferedGoal || activeGoal;
  const seasonPercent = seasonGoal > 0
    ? Math.min(100, (currentProgress / seasonGoal) * 100)
    : 0;

  const paceDiff = season.paceDiff;
  const sev = severityConfig[severity];
  const SevIcon = sev.icon;

  // Determine period performance color
  const periodIsAhead = periodFp >= periodExpected;
  const periodColor = periodExpected <= 0
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

      {/* Period Row */}
      {periodExpected > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{periodLabel}</span>
            <span className={cn("font-semibold tabular-nums", periodColor)}>
              {formatFP(periodFp)} / {formatFP(periodExpected)} {metricLabel}
            </span>
          </div>
          <div className="relative">
            <Progress value={periodPercent} className="h-2" />
            {/* Period percent badge */}
            <span className={cn(
              "absolute right-0 -top-0.5 text-[9px] font-semibold tabular-nums",
              periodColor
            )}>
              {Math.round(periodPercent)}%
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
