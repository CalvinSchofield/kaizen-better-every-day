import { useMemo } from 'react';
import { cn } from '@/lib/utils';
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

  const seasonGoal = unbufferedGoal || activeGoal;
  const priorProgress = Math.max(0, currentProgress - periodFp);

  // Use the season's original daily pace for period expected calculation
  // This is: goal / totalPlannedDays — the steady-state pace they set at the start
  const originalDailyPace = useMemo(() => {
    if (season.plannedDaysTotal <= 0 || activeGoal <= 0) return 0;
    return activeGoal / season.plannedDaysTotal;
  }, [activeGoal, season.plannedDaysTotal]);

  // For the period expected, use actual elapsed days in that period
  // We approximate: if season has X total planned days and Y elapsed, 
  // then this period's share = periodFp's timespan / total timespan × total planned days
  // But simpler: use the daily pace × days they actually worked (activeReps days)
  // Best proxy: (periodFp is what they did, periodExpected is dailyPace × workDaysInPeriod)
  // We estimate work days from calendar days with 6/7 ratio, capped reasonably
  const periodExpected = useMemo(() => {
    if (!dateRangeStart || !dateRangeEnd || originalDailyPace <= 0) return 0;
    const msPerDay = 86400000;
    const calDays = Math.round((dateRangeEnd.getTime() - dateRangeStart.getTime()) / msPerDay) + 1;
    // Use 6/7 for weekly cadence (Mon-Sat), minimum 1 day
    const workDays = Math.max(1, Math.round(calDays * (6 / 7)));
    return originalDailyPace * workDays;
  }, [dateRangeStart, dateRangeEnd, originalDailyPace]);

  const hasPeriodContext = periodExpected > 0 && dateRangeStart && dateRangeEnd;
  const periodDelta = periodFp - periodExpected;
  const periodHit = periodDelta >= 0;

  // Bar percentages (relative to seasonGoal)
  const pctOf = (val: number) => seasonGoal > 0 ? Math.min(100, Math.max(0, (val / seasonGoal) * 100)) : 0;
  const priorPct = pctOf(priorProgress);
  const periodPct = pctOf(periodFp);
  // Clamp so prior + period doesn't exceed 100
  const clampedPeriodPct = Math.min(periodPct, 100 - priorPct);
  const totalPct = pctOf(currentProgress);
  const expectedMarkerPct = pctOf(priorProgress + periodExpected);

  const sevConfig: Record<PaceSeverity, { label: string; color: string; bg: string; border: string; icon: typeof TrendingUp }> = {
    green: { label: 'On Pace', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp },
    amber: { label: 'At Risk', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Minus },
    red: { label: 'Behind', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: TrendingDown },
  };
  const sev = sevConfig[severity];
  const SevIcon = sev.icon;

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
          Goal Progress
        </span>
        <div className="flex items-center gap-2">
          {tierCfg && (
            <span className={cn(
              "text-[10px] font-bold px-2.5 py-0.5 rounded-full",
              tierCfg.bgColor, tierCfg.color
            )}>
              {tierLabel}
            </span>
          )}
        </div>
      </div>

      {/* Big number row */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
            {formatFP(currentProgress)}
          </span>
          <span className="text-sm text-muted-foreground font-medium">
            / {formatFP(seasonGoal)} {metricLabel}
          </span>
        </div>
        <div className={cn(
          "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
          sev.bg, sev.color, sev.border,
        )}>
          <SevIcon className="w-3 h-3" />
          {sev.label}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="relative h-2.5 w-full rounded-full bg-muted/40 dark:bg-muted/60 overflow-visible">
          {/* Prior progress */}
          {priorPct > 0 && (
            <div
              className="absolute inset-y-0 left-0 rounded-l-full bg-primary/30 transition-all duration-500"
              style={{ width: `${priorPct}%` }}
            />
          )}

          {/* This period — highlighted */}
          {clampedPeriodPct > 0 && (
            <div
              className={cn(
                "absolute inset-y-0 transition-all duration-500",
                periodHit
                  ? "bg-emerald-500 dark:bg-emerald-400"
                  : "bg-amber-500 dark:bg-amber-400",
                priorPct === 0 && "rounded-l-full",
                (priorPct + clampedPeriodPct) >= 99.5 && "rounded-r-full",
              )}
              style={{ left: `${priorPct}%`, width: `${clampedPeriodPct}%` }}
            />
          )}

          {/* Expected marker — thin line with dot */}
          {hasPeriodContext && expectedMarkerPct > 0 && expectedMarkerPct <= 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 z-10 flex flex-col items-center"
              style={{ left: `${expectedMarkerPct}%` }}
            >
              <div className="w-0.5 h-5 bg-foreground/40 rounded-full" />
            </div>
          )}
        </div>

        {/* Bar labels */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>{Math.round(totalPct)}% complete</span>
          <span>{formatFP(seasonGoal)}</span>
        </div>
      </div>

      {/* Period insight card */}
      {hasPeriodContext && (
        <div className={cn(
          "rounded-lg px-3 py-2.5 border",
          periodHit
            ? "bg-emerald-500/5 border-emerald-500/15"
            : "bg-amber-500/5 border-amber-500/15",
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{periodLabel}</span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-xs text-muted-foreground">
                Needed <span className="font-semibold text-foreground">{formatFP(periodExpected)}</span>
              </span>
              <span className="text-xs text-muted-foreground mx-0.5">→</span>
              <span className={cn(
                "text-xs font-bold",
                periodHit ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
              )}>
                Sold {formatFP(periodFp)}
              </span>
            </div>
          </div>

          {/* Delta pill */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
              periodHit
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}>
              {periodHit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {periodHit
                ? `+${formatFP(periodDelta)} ahead`
                : `${formatFP(Math.abs(periodDelta))} short`
              }
            </div>
            <span className="text-[10px] text-muted-foreground">
              {periodHit ? 'Gained ground on goal' : 'Fell behind pace'}
            </span>
          </div>
        </div>
      )}

      {/* Legend — only when period context exists */}
      {hasPeriodContext && (
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
          {priorProgress > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-[3px] bg-primary/30" />
              <span>Prior ({formatFP(priorProgress)})</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className={cn(
              "w-2.5 h-2.5 rounded-[3px]",
              periodHit ? "bg-emerald-500" : "bg-amber-500"
            )} />
            <span>{periodLabel} ({formatFP(periodFp)})</span>
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <div className="w-0.5 h-2.5 bg-foreground/40 rounded-full" />
            <span>Pace target</span>
          </div>
        </div>
      )}
    </div>
  );
};
