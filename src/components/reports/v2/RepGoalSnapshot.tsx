import { useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { cn } from '@/lib/utils';
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

  // The full season goal (use unbuffered for display)
  const seasonGoal = unbufferedGoal || activeGoal;
  
  // Prior progress = total progress minus what was done this period
  const priorProgress = Math.max(0, currentProgress - periodFp);

  // Original planned pace (goal / total planned days)
  const originalDailyPace = useMemo(() => {
    const totalPlannedDays = season.plannedDaysTotal;
    if (totalPlannedDays <= 0 || activeGoal <= 0) return 0;
    return activeGoal / totalPlannedDays;
  }, [activeGoal, season.plannedDaysTotal]);

  // What was expected for THIS period specifically
  const periodExpected = useMemo(() => {
    if (!dateRangeStart || !dateRangeEnd || originalDailyPace <= 0) return 0;
    const calDays = differenceInCalendarDays(dateRangeEnd, dateRangeStart) + 1;
    const estimatedWorkDays = Math.max(1, Math.round(calDays * (6 / 7)));
    return originalDailyPace * estimatedWorkDays;
  }, [dateRangeStart, dateRangeEnd, originalDailyPace]);

  // Where they should have been at end of this period (prior + period expected)
  const expectedAtEndOfPeriod = priorProgress + periodExpected;

  const showPeriodSegment = periodExpected > 0 && dateRangeStart && dateRangeEnd;

  // Season percentages (all relative to seasonGoal)
  const priorPct = seasonGoal > 0 ? Math.min(100, (priorProgress / seasonGoal) * 100) : 0;
  const periodPct = seasonGoal > 0 ? Math.min(100 - priorPct, (periodFp / seasonGoal) * 100) : 0;
  const totalPct = seasonGoal > 0 ? Math.min(100, (currentProgress / seasonGoal) * 100) : 0;
  const expectedMarkerPct = seasonGoal > 0 ? Math.min(100, (expectedAtEndOfPeriod / seasonGoal) * 100) : 0;

  // Did they hit pace for this period?
  const periodHit = periodFp >= periodExpected;
  const periodShortfall = periodExpected - periodFp;
  const periodSurplus = periodFp - periodExpected;

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

      {/* Season goal summary */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">
          {isPreseason ? 'Preseason' : 'Season'}
        </span>
        <span className="font-semibold tabular-nums text-foreground">
          {formatFP(currentProgress)} / {formatFP(seasonGoal)} {metricLabel}
        </span>
      </div>

      {/* Unified season bar with period segment highlighted */}
      <div className="space-y-1">
        <div className="relative h-3 w-full overflow-hidden rounded-full bg-muted/30 dark:bg-muted/50 border border-border/30">
          {/* Prior progress (muted/completed) */}
          {priorPct > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-primary/40 transition-all duration-700"
              style={{ width: `${priorPct}%` }}
            />
          )}
          
          {/* This period's contribution (bright highlight) */}
          {periodPct > 0 && (
            <div
              className={cn(
                "absolute inset-y-0 transition-all duration-700",
                periodHit ? "bg-emerald-500" : "bg-amber-500",
                priorPct === 0 && "rounded-l-full",
              )}
              style={{ 
                left: `${priorPct}%`, 
                width: `${periodPct}%`,
              }}
            />
          )}

          {/* Expected marker line — where they SHOULD be after this period */}
          {showPeriodSegment && expectedMarkerPct > 0 && (
            <div
              className="absolute inset-y-0 w-0.5 bg-foreground/50 z-10"
              style={{ left: `${expectedMarkerPct}%` }}
            />
          )}
        </div>

        {/* Legend row */}
        {showPeriodSegment && (
          <div className="flex items-center gap-3 text-[10px]">
            {priorPct > 0 && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <div className="w-2 h-2 rounded-sm bg-primary/40" />
                Prior: {formatFP(priorProgress)}
              </div>
            )}
            <div className={cn(
              "flex items-center gap-1 font-medium",
              periodHit ? "text-emerald-500" : "text-amber-500"
            )}>
              <div className={cn(
                "w-2 h-2 rounded-sm",
                periodHit ? "bg-emerald-500" : "bg-amber-500"
              )} />
              {periodLabel}: {formatFP(periodFp)}
            </div>
            <div className="flex items-center gap-1 text-muted-foreground ml-auto">
              <div className="w-0.5 h-2 bg-foreground/50" />
              Expected
            </div>
          </div>
        )}
      </div>

      {/* Period result callout */}
      {showPeriodSegment && (
        <div className={cn(
          "flex items-center justify-between text-[10px] px-2 py-1.5 rounded-lg",
          periodHit ? "bg-emerald-500/5" : "bg-amber-500/5"
        )}>
          <div className={cn(
            "flex items-center gap-1 font-semibold",
            periodHit ? "text-emerald-500" : "text-amber-500"
          )}>
            {periodHit ? (
              <>
                <Check className="w-3 h-3" />
                {periodLabel}: +{formatFP(periodSurplus)} ahead of pace
              </>
            ) : (
              <>
                <X className="w-3 h-3" />
                {periodLabel}: short {formatFP(periodShortfall)} ({formatFP(periodFp)} of {formatFP(periodExpected)} needed)
              </>
            )}
          </div>
        </div>
      )}

      {/* Season pace badge */}
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
          {Math.round(totalPct)}%
        </span>
      </div>
    </div>
  );
};
