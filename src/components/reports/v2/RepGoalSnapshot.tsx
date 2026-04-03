import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { GOAL_TIER_CONFIG } from '@/config/goalTiers';
import { formatFP } from '@/lib/formatters';
import type { GoalPaceData, PaceSeverity } from '@/hooks/useGoalPaceCalculator';
import { TrendingDown, TrendingUp, Minus, Check, X } from 'lucide-react';

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

  // What was NEEDED just for this period to stay on pace
  const periodExpected = useMemo(() => {
    if (!dateRangeStart || !dateRangeEnd || originalDailyPace <= 0) return 0;
    const calDays = differenceInCalendarDays(dateRangeEnd, dateRangeStart) + 1;
    const estimatedWorkDays = Math.max(1, Math.round(calDays * (6 / 7)));
    return originalDailyPace * estimatedWorkDays;
  }, [dateRangeStart, dateRangeEnd, originalDailyPace]);

  const showPeriodRow = periodExpected > 0 && dateRangeStart && dateRangeEnd;

  // Period bar: periodFp vs periodExpected — did they do enough THIS period?
  const periodPercent = periodExpected > 0
    ? Math.min(120, (periodFp / periodExpected) * 100)
    : periodFp > 0 ? 100 : 0;
  const periodHit = periodFp >= periodExpected;
  const periodShortfall = periodExpected - periodFp;

  // Season progress
  const seasonGoal = unbufferedGoal || activeGoal;
  const seasonPercent = seasonGoal > 0
    ? Math.min(100, (currentProgress / seasonGoal) * 100)
    : 0;

  const paceDiff = season.paceDiff;
  const sev = severityConfig[severity];
  const SevIcon = sev.icon;

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

      {/* Period Row — Did they hit the pace target for this window? */}
      {showPeriodRow && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">{periodLabel} Needed</span>
            <span className="font-semibold tabular-nums text-foreground">
              {formatFP(periodExpected)} {metricLabel}
            </span>
          </div>

          {/* Bar: actual vs needed */}
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/30 dark:bg-muted/50 border border-border/30">
            {/* Expected marker line at 100% */}
            <div
              className="absolute inset-y-0 w-px bg-foreground/40 z-10"
              style={{ left: `${Math.min(100, 100)}%` }}
            />
            {/* Actual production bar */}
            <div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-700 shadow-sm",
                periodHit ? "bg-emerald-500" : "bg-amber-500"
              )}
              style={{ width: `${Math.min(periodPercent, 100)}%` }}
            />
          </div>

          {/* Result line */}
          <div className="flex items-center justify-between text-[10px]">
            <div className={cn(
              "flex items-center gap-1 font-semibold",
              periodHit ? "text-emerald-500" : "text-amber-500"
            )}>
              {periodHit ? (
                <>
                  <Check className="w-3 h-3" />
                  Produced {formatFP(periodFp)} — hit pace
                </>
              ) : (
                <>
                  <X className="w-3 h-3" />
                  Produced {formatFP(periodFp)} — short {formatFP(periodShortfall)}
                </>
              )}
            </div>
            <span className={cn(
              "font-semibold tabular-nums",
              periodHit ? "text-emerald-500" : "text-amber-500"
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
