import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { GOAL_TIER_CONFIG } from '@/config/goalTiers';
import { formatFP } from '@/lib/formatters';
import type { GoalPaceData, PaceSeverity } from '@/hooks/useGoalPaceCalculator';
import { TrendingDown, TrendingUp, Minus, Send } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface RepGoalSnapshotProps {
  goalPaceData: GoalPaceData;
  periodFp: number;
  periodLabel: string;
  periodDaysWorked?: number;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  onNudgeGoals?: () => void;
}

export const RepGoalSnapshot = ({
  goalPaceData,
  periodFp,
  periodLabel,
  periodDaysWorked,
  dateRangeStart,
  dateRangeEnd,
  onNudgeGoals,
}: RepGoalSnapshotProps) => {
  const {
    activeGoal,
    unbufferedGoal,
    tierLabel,
    focusTier,
    metricLabel,
    severity,
    currentProgress,
    season,
    hasGoals,
  } = goalPaceData;

  const tierKey = focusTier === 'preseason' ? 'preseason' : focusTier;
  const tierCfg = GOAL_TIER_CONFIG[tierKey as keyof typeof GOAL_TIER_CONFIG];
  const seasonGoal = unbufferedGoal || activeGoal;

  const ytdPct = seasonGoal > 0 ? Math.min(100, (currentProgress / seasonGoal) * 100) : 0;

  const ytdExpectedPct = useMemo(() => {
    if (seasonGoal <= 0 || season.plannedDaysTotal <= 0) return 0;
    const expected = (activeGoal / season.plannedDaysTotal) * season.plannedDaysElapsed;
    return Math.min(100, Math.max(0, (expected / seasonGoal) * 100));
  }, [activeGoal, seasonGoal, season.plannedDaysTotal, season.plannedDaysElapsed]);

  const originalDailyPace = useMemo(() => {
    if (season.plannedDaysTotal <= 0 || activeGoal <= 0) return 0;
    return activeGoal / season.plannedDaysTotal;
  }, [activeGoal, season.plannedDaysTotal]);

  const periodExpected = useMemo(() => {
    if (originalDailyPace <= 0) return 0;
    if (periodDaysWorked !== undefined && periodDaysWorked > 0) {
      return originalDailyPace * periodDaysWorked;
    }
    if (!dateRangeStart || !dateRangeEnd) return 0;
    const msPerDay = 86400000;
    const calDays = Math.round((dateRangeEnd.getTime() - dateRangeStart.getTime()) / msPerDay) + 1;
    const workDays = Math.max(1, Math.round(calDays * (6 / 7)));
    return originalDailyPace * workDays;
  }, [dateRangeStart, dateRangeEnd, originalDailyPace, periodDaysWorked]);

  const hasPeriodContext = periodExpected > 0 && dateRangeStart && dateRangeEnd;
  const periodDelta = periodFp - periodExpected;
  const periodHit = periodDelta >= 0;

  const sevConfig: Record<PaceSeverity, { label: string; color: string; bg: string; border: string; icon: typeof TrendingUp }> = {
    green: { label: 'On Pace', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: TrendingUp },
    amber: { label: 'At Risk', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Minus },
    red: { label: 'Behind', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: TrendingDown },
  };
  const sev = sevConfig[severity];
  const SevIcon = sev.icon;

  // ── No Goals State ──
  if (!hasGoals) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-5 text-center space-y-3">
        <p className="text-sm font-medium text-muted-foreground">No goals set up yet</p>
        <p className="text-xs text-muted-foreground/70">
          This rep hasn't completed goal setup. Nudge them to get started.
        </p>
        {onNudgeGoals && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onNudgeGoals}
          >
            <Send className="w-3.5 h-3.5" />
            Nudge to Set Goals
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Section 1: Season Standing ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
            Goal Progress
          </span>
          {tierCfg && (
            <span className={cn(
              "text-[10px] font-bold px-2.5 py-0.5 rounded-full",
              tierCfg.bgColor, tierCfg.color,
            )}>
              {tierLabel}
            </span>
          )}
        </div>

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

        <div className="relative">
          <Progress value={ytdPct} className="h-2.5" />
          {ytdExpectedPct > 0 && ytdExpectedPct <= 100 && (
            <div
              className="absolute top-1/2 -translate-y-1/2 z-10"
              style={{ left: `${ytdExpectedPct}%` }}
            >
              <div className="w-0.5 h-5 bg-foreground/40 dark:bg-foreground/50 rounded-full" />
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Period Verdict ── */}
      {hasPeriodContext && (
        <div className={cn(
          "rounded-lg border px-3 py-2.5",
          periodHit
            ? "bg-emerald-500/5 border-emerald-500/15"
            : "bg-amber-500/5 border-amber-500/15",
        )}>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-foreground">{periodLabel}</span>
              {periodDaysWorked !== undefined && periodDaysWorked > 0 && (
                <span className="text-[10px] text-muted-foreground ml-1.5">
                  · {periodDaysWorked} day{periodDaysWorked !== 1 ? 's' : ''} worked
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 tabular-nums">
              <span className={cn(
                "text-xs font-bold",
                periodHit ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400",
              )}>
                {formatFP(periodFp)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                / {formatFP(periodExpected)} needed
              </span>
            </div>
          </div>

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
          </div>
        </div>
      )}
    </div>
  );
};
