/**
 * UnifiedGoalProgress
 * 
 * Single component for all goal progress display across the app.
 * Supports two modes:
 * - full: D/W/M/Season toggle with segmented bars, tier selector, pace context
 * - compact: Single-bar inline view for cards and lists
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, TrendingUp, TrendingDown, ChevronDown, Check, Zap, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFP } from '@/lib/formatters';
import { hapticLight } from '@/utils/haptics';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { GOAL_TIER_CONFIG } from '@/config/goalTiers';
import type { GoalPaceData, TimeframeData, PaceSeverity } from '@/hooks/useGoalPaceCalculator';
import type { FocusTier } from '@/hooks/useFocusTier';

type GoalTimeframe = 'D' | 'W' | 'M' | 'Y';

interface UnifiedGoalProgressProps {
  data: GoalPaceData;
  
  /** Display mode */
  mode?: 'full' | 'compact';
  
  /** Which timeframes to show in compact mode (defaults to day + season) */
  compactTimeframes?: GoalTimeframe[];
  
  /** Initial timeframe for full mode */
  initialTimeframe?: GoalTimeframe;
  
  /** Show tier selector */
  showTierSelector?: boolean;
  
  /** Show pace context line (Avg X/day | Need X/day) */
  showPaceContext?: boolean;
  
  /** Show the timeframe toggle pills */
  showTimeframeToggle?: boolean;
  
  /** Custom selected date for day label */
  selectedDate?: Date;
  
  /** Render without internal card wrapper (when parent provides the card) */
  cardless?: boolean;
  
  /** Hide the "Goal Progress" header row */
  hideHeader?: boolean;
  
  /** Hide the Day option from timeframe toggle */
  hideDay?: boolean;
  
  className?: string;
}

// =====================================================
// Severity colors using design tokens
// =====================================================

const severityConfig: Record<PaceSeverity, { text: string; bg: string; border: string }> = {
  green: {
    text: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  amber: {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
  },
  red: {
    text: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
  },
};

// =====================================================
// Segmented Progress Bar
// =====================================================

const SegmentedBar = ({
  finalized,
  funded = 0,
  live,
  pending = 0,
  goal,
  unbufferedGoal,
  expected,
  severity,
  height = 'h-3',
  showExpectedMarker = true,
}: {
  finalized: number;
  funded?: number;
  live: number;
  pending?: number;
  goal: number;
  /** Raw goal without cancel buffer — used as the visual 100% reference */
  unbufferedGoal?: number;
  expected: number;
  severity: PaceSeverity;
  height?: string;
  showExpectedMarker?: boolean;
}) => {
  if (goal <= 0) return null;

  // Use unbuffered goal as the visual reference (100% of bar width)
  // Unfunded and pending can overflow beyond this
  const displayGoal = unbufferedGoal && unbufferedGoal > 0 ? unbufferedGoal : goal;

  // Split finalized into funded (green) and unfunded (blue)
  const fundedAmount = Math.min(funded, finalized);
  const unfundedAmount = Math.max(0, finalized - fundedAmount);

  // Calculate total to determine if we need overflow
  const totalProduction = fundedAmount + live + unfundedAmount + pending;
  const overflowRatio = totalProduction > displayGoal ? totalProduction / displayGoal : 1;
  
  // The bar's visual width represents max(displayGoal, totalProduction)
  const barMax = Math.max(displayGoal, totalProduction);

  const fundedPct = (fundedAmount / barMax) * 100;
  const livePct = (live / barMax) * 100;
  const unfundedPct = (unfundedAmount / barMax) * 100;
  const pendingPct = (pending / barMax) * 100;
  const expectedPct = (expected / barMax) * 100;
  
  // Where the 100% goal line sits (may be < 100% of bar if overflowing)
  const goalLinePct = (displayGoal / barMax) * 100;

  return (
    <div className="relative">
      <div className={cn(height, "bg-muted/50 rounded-full overflow-hidden border border-border/30")}>
        {/* Funded (green) */}
        <motion.div
          className="h-full absolute left-0 top-0 rounded-l-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${fundedPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* Live (lighter green) */}
        {livePct > 0 && (
          <motion.div
            className="h-full absolute top-0 bg-emerald-400"
            style={{ left: `${fundedPct}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${livePct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
          />
        )}
        {/* Unfunded (blue) */}
        {unfundedPct > 0 && (
          <motion.div
            className="h-full absolute top-0 bg-primary"
            style={{ left: `${fundedPct + livePct}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${unfundedPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.2 }}
          />
        )}
        {/* Pending (warning/yellow) */}
        {pendingPct > 0 && (
          <motion.div
            className="h-full absolute top-0 rounded-r-full bg-warning"
            style={{ left: `${fundedPct + livePct + unfundedPct}%` }}
            initial={{ width: 0 }}
            animate={{ width: `${pendingPct}%` }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.3 }}
          />
        )}
      </div>
      {/* Goal line marker when bar overflows past the raw goal */}
      {overflowRatio > 1 && (
        <div
          className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-foreground/60 rounded-full z-10"
          style={{ left: `${goalLinePct}%` }}
        />
      )}
      {/* Expected marker */}
      {showExpectedMarker && expected > 0 && expectedPct > 0 && (
        <div
          className="absolute top-[-2px] bottom-[-2px] w-[2px] bg-foreground/80 rounded-full"
          style={{ left: `${expectedPct}%` }}
        >
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-foreground/80" />
        </div>
      )}
    </div>
  );
};

// =====================================================
// Pace Badge
// =====================================================

const PaceBadge = ({ paceDiff, severity }: { paceDiff: number; severity: PaceSeverity }) => {
  const isAhead = paceDiff >= 0;
  // Badge color reflects actual ahead/behind status, not just global severity
  const badgeSeverity: PaceSeverity = isAhead ? 'green' : (severity === 'red' ? 'red' : 'amber');
  const sc = severityConfig[badgeSeverity];

  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
      sc.bg, sc.text
    )}>
      {isAhead ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
      {isAhead ? '+' : ''}{formatFP(paceDiff)}
    </span>
  );
};

// =====================================================
// Mission Statement — single anchor for pace
// =====================================================

const MissionStatement = ({
  timeframe,
  data,
  current,
}: {
  timeframe: GoalTimeframe;
  data: GoalPaceData;
  current: TimeframeData;
}) => {
  const sc = severityConfig[data.severity];

  const missionText = (() => {
    switch (timeframe) {
      case 'D':
        return (
          <>
            <span className={cn("font-semibold tabular-nums", sc.text)}>{formatFP(data.dailyNeeded)} {data.metricLabel}</span>
            <span className="text-muted-foreground"> today</span>
          </>
        );
      case 'W':
        return (
          <>
            <span className={cn("font-semibold tabular-nums", sc.text)}>{formatFP(current.goal)} {data.metricLabel}</span>
            <span className="text-muted-foreground"> this week</span>
            <span className="text-muted-foreground/60 text-[10px]"> ({formatFP(data.dailyNeeded)}/day × {current.plannedDaysTotal}d)</span>
          </>
        );
      case 'M':
        return (
          <>
            <span className={cn("font-semibold tabular-nums", sc.text)}>{formatFP(current.goal)} {data.metricLabel}</span>
            <span className="text-muted-foreground"> this month</span>
            <span className="text-muted-foreground/60 text-[10px]"> ({formatFP(data.dailyNeeded)}/day × {current.plannedDaysTotal}d)</span>
          </>
        );
      case 'Y':
        return (
          <>
            <span className={cn("font-semibold tabular-nums", sc.text)}>{formatFP(current.goal)} {data.metricLabel}</span>
            <span className="text-muted-foreground"> goal</span>
            <span className="text-muted-foreground/60 text-[10px]"> · {formatFP(data.dailyNeeded)}/day to finish</span>
          </>
        );
    }
  })();

  return (
    <div className="flex items-center justify-between text-xs px-1">
      <div className="flex items-center gap-1 flex-wrap">
        <Zap className="w-3 h-3 text-primary shrink-0" />
        {missionText}
      </div>
      <span className="text-muted-foreground whitespace-nowrap">
        Avg <span className="font-semibold text-foreground tabular-nums">{formatFP(data.userDailyAvg)}</span>/day
      </span>
    </div>
  );
};

// =====================================================
// Full Mode Component
// =====================================================

const FullMode = ({
  data,
  showTierSelector = true,
  showPaceContext = true,
  showTimeframeToggle = true,
  initialTimeframe = 'D',
  hideHeader = false,
  hideDay = false,
  selectedDate,
  className,
}: Omit<UnifiedGoalProgressProps, 'mode' | 'compactTimeframes'>) => {
  const [timeframe, setTimeframe] = useState<GoalTimeframe>(initialTimeframe);
  const [showTierDrawer, setShowTierDrawer] = useState(false);

  const timeframeLabels: Record<GoalTimeframe, string> = {
    D: 'Day',
    W: 'Week',
    M: 'Month',
    Y: 'Season',
  };

  const getTimeframeData = (tf: GoalTimeframe): TimeframeData => {
    switch (tf) {
      case 'D': return data.day;
      case 'W': return data.week;
      case 'M': return data.month;
      case 'Y': return data.season;
    }
  };

  const current = getTimeframeData(timeframe);
  const totalProgress = current.actual + current.live;

  // Tier icon and color from config
  const tierKey = data.isPreseason ? 'preseason' : data.focusTier;
  const tierConfig = GOAL_TIER_CONFIG[tierKey as keyof typeof GOAL_TIER_CONFIG] || GOAL_TIER_CONFIG.willDo;
  const TierIcon = tierConfig.icon;

  return (
    <motion.div
      className={cn("p-4 rounded-xl border bg-card space-y-3", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header with tier selector */}
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Target className="w-4 h-4 text-primary" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">Goal Progress</h4>
          </div>

          {showTierSelector && (
            <button
              onClick={() => { hapticLight(); setShowTierDrawer(true); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted/50 hover:bg-muted transition-colors"
            >
              <TierIcon className={cn("w-3 h-3", tierConfig.color)} />
              <span className="text-xs font-medium text-foreground">{data.tierLabel}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* Progress Card */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-3">
        {/* Main numbers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{current.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="font-semibold tabular-nums text-foreground">
                {formatFP(Math.min(current.funded, current.actual))}
                {current.pending > 0 && (
                  <span className="text-warning font-normal"> +{formatFP(current.pending)} pending</span>
                )}
              </span>
              <span className="text-muted-foreground">/ {formatFP(data.unbufferedGoal || current.goal)} {data.metricLabel}</span>
            </div>
          </div>

          {/* Segmented bar */}
          <SegmentedBar
            finalized={current.actual}
            funded={current.funded}
            live={current.live}
            pending={current.pending}
            goal={current.goal}
            unbufferedGoal={timeframe === 'Y' ? data.unbufferedGoal : undefined}
            expected={current.expected}
            severity={data.severity}
            showExpectedMarker={data.knockingDaysCompleted >= 6}
          />

          {/* Pace diff + days context */}
          {timeframe !== 'D' && current.expected > 0 && data.knockingDaysCompleted >= 6 && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {current.plannedDaysElapsed} of {current.plannedDaysTotal} work days
              </span>
              <PaceBadge paceDiff={current.paceDiff} severity={data.severity} />
            </div>
          )}

          {/* Day mode: show goal hit status */}
          {timeframe === 'D' && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {Math.round((totalProgress / Math.max(current.goal, 0.01)) * 100)}% of daily goal
              </span>
              {current.isAhead && totalProgress > 0 && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <Check className="w-3 h-3" /> Goal hit
                </span>
              )}
            </div>
          )}

          {/* Legend */}
          {(current.live > 0 || current.pending > 0 || current.actual > 0) && (
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{formatFP(Math.min(current.funded, current.actual))} funded</span>
              </div>
              {current.live > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>{formatFP(current.live)} live</span>
                </div>
              )}
              {(current.actual - Math.min(current.funded, current.actual)) > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span>{formatFP(current.actual - Math.min(current.funded, current.actual))} unfunded</span>
                </div>
              )}
              {current.pending > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-warning" />
                  <span>{formatFP(current.pending)} pending</span>
                </div>
              )}
              {data.knockingDaysCompleted >= 6 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-3 bg-foreground/80 rounded-sm" />
                  <span>Expected</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mission statement */}
      {showPaceContext && data.hasGoals && data.dailyNeeded > 0 && (
        <MissionStatement
          timeframe={timeframe}
          data={data}
          current={current}
        />
      )}

      {/* Timeframe Toggle */}
      {showTimeframeToggle && (
        <div className="flex items-center justify-center gap-1 p-1 bg-muted/40 rounded-full">
          {(['D', 'W', 'M', 'Y'] as GoalTimeframe[]).filter(tf => !hideDay || tf !== 'D').map((tf) => (
            <button
              key={tf}
              onClick={() => { hapticLight(); setTimeframe(tf); }}
              className={cn(
                "relative px-3.5 py-1.5 text-xs font-medium rounded-full transition-colors",
                timeframe === tf ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
              )}
            >
              {timeframe === tf && (
                <motion.div
                  layoutId="unified-goal-timeframe"
                  className="absolute inset-0 bg-background shadow-sm rounded-full"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">{timeframeLabels[tf]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tier Selection Drawer */}
      <Drawer open={showTierDrawer} onOpenChange={setShowTierDrawer}>
        <DrawerContent className="z-[70]">
          <DrawerHeader>
            <DrawerTitle>Select Goal Tier</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 space-y-3 pb-8">
            {data.isPreseason ? (
              <TierOption
                label="Preseason"
                goal={data.activeGoal}
                progress={data.currentProgress}
                isSelected
                metricLabel={data.metricLabel}
              />
            ) : (
              data.allTiers.map((tier) => (
                <TierOption
                  key={tier.key}
                  label={tier.label}
                  goal={tier.funded || tier.goal}
                  progress={data.currentProgress}
                  isSelected={data.focusTier === tier.key}
                  isComplete={tier.complete}
                  metricLabel={data.metricLabel}
                  onClick={() => {
                    hapticLight();
                    data.onTierChange?.(tier.key as FocusTier);
                    setShowTierDrawer(false);
                  }}
                />
              ))
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </motion.div>
  );
};

// =====================================================
// Tier Option for drawer
// =====================================================

const TierOption = ({
  label,
  goal,
  progress,
  isSelected,
  isComplete,
  metricLabel,
  onClick,
}: {
  label: string;
  goal: number;
  progress: number;
  isSelected: boolean;
  isComplete?: boolean;
  metricLabel: string;
  onClick?: () => void;
}) => {
  const pct = goal > 0 ? Math.min(100, (progress / goal) * 100) : 0;

  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "w-full p-4 rounded-xl border text-left transition-colors",
        isSelected ? "bg-primary/10 border-primary/30" : "bg-muted/30 border-border/30 hover:bg-muted/50"
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h4 className={cn("font-semibold", isSelected && "text-primary")}>{label}</h4>
          <p className="text-sm text-muted-foreground">{isSelected ? 'Current focus' : isComplete ? '✓ Complete' : 'Tap to select'}</p>
        </div>
        <span className={cn("text-2xl font-bold tabular-nums", isSelected && "text-primary")}>{formatFP(goal)}</span>
      </div>
      <div className="mt-3 h-2 bg-muted/50 rounded-full overflow-hidden">
        <motion.div className="h-full bg-primary rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-1">
        <span>{formatFP(progress)} {metricLabel}</span>
        <span>{Math.round(pct)}%</span>
      </div>
    </button>
  );
};

// =====================================================
// Compact Mode Component
// =====================================================

const CompactMode = ({
  data,
  compactTimeframes = ['D', 'Y'],
  showPaceContext = true,
  cardless = false,
  className,
}: Pick<UnifiedGoalProgressProps, 'data' | 'compactTimeframes' | 'showPaceContext' | 'cardless' | 'className'>) => {
  const getTimeframeData = (tf: GoalTimeframe): TimeframeData => {
    switch (tf) {
      case 'D': return data.day;
      case 'W': return data.week;
      case 'M': return data.month;
      case 'Y': return data.season;
    }
  };

  const tfLabels: Record<GoalTimeframe, string> = { D: 'Today', W: 'Week', M: 'Month', Y: data.isPreseason ? 'Preseason' : 'Season' };
  const tierKey = data.isPreseason ? 'preseason' : data.focusTier;
  const tierConfig = GOAL_TIER_CONFIG[tierKey as keyof typeof GOAL_TIER_CONFIG] || GOAL_TIER_CONFIG.willDo;
  const TierIcon = tierConfig.icon;

  return (
    <motion.div
      className={cn(cardless ? "p-4 space-y-3" : "p-4 rounded-xl border bg-card space-y-3", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Goal Progress</span>
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          <TierIcon className={cn("w-3 h-3", tierConfig.color)} />
          {data.tierLabel}
        </span>
      </div>

      {/* Timeframe bars */}
      {compactTimeframes!.map((tf) => {
        const tfData = getTimeframeData(tf);
        const totalProgress = tfData.actual + tfData.live;
        const pct = tfData.goal > 0 ? Math.min(100, (totalProgress / tfData.goal) * 100) : 0;
        const goalHit = totalProgress >= tfData.goal && tfData.goal > 0;

        return (
          <div key={tf} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{tfLabels[tf]}</span>
              <div className="flex items-center gap-1.5">
                <span className={cn("font-medium tabular-nums", goalHit && "text-emerald-600 dark:text-emerald-400")}>
                  {formatFP(Math.min(tfData.funded, tfData.actual + tfData.live))}
                  {tfData.pending > 0 && <span className="text-warning text-xs"> +{formatFP(tfData.pending)} pending</span>}
                </span>
                <span className="text-muted-foreground">/ {formatFP(tf === 'Y' ? (data.unbufferedGoal || tfData.goal) : tfData.goal)} {data.metricLabel}</span>
                {goalHit && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              </div>
            </div>
            <SegmentedBar
              finalized={tfData.actual}
              funded={tfData.funded}
              live={tfData.live}
              pending={tfData.pending}
              goal={tfData.goal}
              unbufferedGoal={tf === 'Y' ? data.unbufferedGoal : undefined}
              expected={tf !== 'D' ? tfData.expected : 0}
              severity={data.severity}
              height="h-2"
              showExpectedMarker={data.knockingDaysCompleted >= 6}
            />
            {/* Pace badge for non-day timeframes */}
            {tf !== 'D' && tfData.expected > 0 && data.knockingDaysCompleted >= 6 && (
              <div className="flex items-center justify-end">
                <PaceBadge paceDiff={tfData.paceDiff} severity={data.severity} />
              </div>
            )}
          </div>
        );
      })}

      {/* Mission statement */}
      {showPaceContext && data.hasGoals && data.dailyNeeded > 0 && (
        <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/30">
          <div className="flex items-center gap-1">
            <Zap className="w-3 h-3 text-primary" />
            <span className={cn("font-semibold tabular-nums", severityConfig[data.severity].text)}>
              {formatFP(data.dailyNeeded)}/day needed
            </span>
          </div>
          <span className="text-muted-foreground">
            Avg <span className="font-semibold text-foreground tabular-nums">{formatFP(data.userDailyAvg)}</span>/day
          </span>
        </div>
      )}
    </motion.div>
  );
};

// =====================================================
// Main Export
// =====================================================

export const UnifiedGoalProgress = (props: UnifiedGoalProgressProps) => {
  const { data, mode = 'full' } = props;

  if (!data.hasGoals) {
    return (
      <div className={cn("p-4 rounded-xl border bg-card text-center", props.className)}>
        <Target className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No goals configured</p>
      </div>
    );
  }

  if (mode === 'compact') {
    return <CompactMode {...props} />;
  }

  return <FullMode {...props} />;
};
