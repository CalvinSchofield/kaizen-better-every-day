import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { TrendingUp, TrendingDown, Minus, CalendarPlus, CalendarMinus } from 'lucide-react';
import { isBefore, isAfter, eachDayOfInterval, getDay } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Slider } from '@/components/ui/slider';
import { GOAL_TIER_CONFIG } from '@/config/goalTiers';

const GLOBAL_SUMMER_START = '2026-04-12';
const GLOBAL_SUMMER_END = '2026-09-27';

interface PlannedDay {
  planned_date: string;
}

interface WhatIfScenarioDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: any;
  currentProgress: number;
  knockingDays: number;
  plannedDays: PlannedDay[] | undefined;
  efpModeEnabled: boolean;
  calculateEfp: (prmr: number) => number;
  forecastedPreseasonTotal: number;
  isVet: boolean;
  personalSummerStart?: string | null;
  personalSummerEnd?: string | null;
  excludedSummerDays?: string[];
  // Summer-specific stats for severity calibration (once summer starts)
  summerProgress?: number;
  summerKnockingDays?: number;
  // Historical summer daily average (from prior year) for preseason severity calibration
  historicalSummerAvg?: number;
}

interface TierResult {
  label: string;
  goal: number;
  dailyNeeded: number;
  weeklyNeeded: number;
  severity: 'green' | 'amber' | 'red';
}


const severityColors = {
  green: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: TrendingDown,
  },
  amber: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    icon: Minus,
  },
  red: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-600 dark:text-red-400',
    icon: TrendingUp,
  },
};

function getSeverity(dailyNeeded: number, userDailyAvg: number): 'green' | 'amber' | 'red' {
  if (dailyNeeded <= 0) return 'green';
  // Green: at or below user's current average (achievable at current pace)
  // Amber: up to 50% stretch beyond their average (a push but doable)
  // Red: more than 50% above their average (significantly out of reach)
  if (userDailyAvg <= 0) {
    // No data yet — use conservative thresholds
    if (dailyNeeded <= 2) return 'green';
    if (dailyNeeded <= 4) return 'amber';
    return 'red';
  }
  const stretchThreshold = userDailyAvg * 1.5;
  if (dailyNeeded <= userDailyAvg) return 'green';
  if (dailyNeeded <= stretchThreshold) return 'amber';
  return 'red';
}

// Calculate work days (Mon-Sat) in a date range
function getWorkDaysInRange(startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (isAfter(start, end)) return 0;
  const days = eachDayOfInterval({ start, end });
  return days.filter(d => getDay(d) !== 0).length; // Exclude Sundays
}

export const WhatIfScenarioDrawer = ({
  open,
  onOpenChange,
  goals,
  currentProgress,
  knockingDays,
  plannedDays,
  efpModeEnabled,
  calculateEfp,
  forecastedPreseasonTotal,
  isVet,
  personalSummerStart,
  personalSummerEnd,
  excludedSummerDays = [],
  summerProgress = 0,
  summerKnockingDays = 0,
  historicalSummerAvg = 0,
}: WhatIfScenarioDrawerProps) => {
  const [hypothetical, setHypothetical] = useState<number | ''>(Math.round(forecastedPreseasonTotal * 10) / 10);
  const [customCancelRate, setCustomCancelRate] = useState<number | null>(null);
  const [customDaysAdjustment, setCustomDaysAdjustment] = useState(0);
  const prevForecastRef = useRef(forecastedPreseasonTotal);

  // Sync hypothetical when forecastedPreseasonTotal actually changes (data loads)
  // but only if user hasn't manually edited the value
  useEffect(() => {
    if (forecastedPreseasonTotal !== prevForecastRef.current) {
      const oldRounded = Math.round(prevForecastRef.current * 10) / 10;
      const currentVal = typeof hypothetical === 'number' ? hypothetical : 0;
      // Only auto-sync if user hasn't manually changed it from the previous forecast
      if (currentVal === oldRounded || currentVal === 0) {
        setHypothetical(Math.round(forecastedPreseasonTotal * 10) / 10);
      }
      prevForecastRef.current = forecastedPreseasonTotal;
    }
  }, [forecastedPreseasonTotal, hypothetical]);

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';
  const baseCancelRate = goals?.cancel_rate || 0;
  const activeCancelRate = customCancelRate !== null ? customCancelRate : baseCancelRate;

  // Determine if summer has started for this rep
  const effectiveSummerStart = personalSummerStart || GLOBAL_SUMMER_START;
  const effectiveSummerEnd = personalSummerEnd || GLOBAL_SUMMER_END;
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const isSummerStarted = !isBefore(today, parseISO(effectiveSummerStart));

  // Calculate summer day stats
  const summerDayStats = useMemo(() => {
    const summerStart = parseISO(effectiveSummerStart);

    // For summer mode, count remaining days from today; for preseason, count all summer days
    const rangeStart = isSummerStarted ? todayStr : effectiveSummerStart;
    const rangeEnd = effectiveSummerEnd;

    // Current planned summer days from calendar (future only if summer started)
    // Defensively exclude any days in excludedSummerDays that may still exist in planned_days
    const currentPlanned = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      if (excludedSummerDays.includes(d.planned_date)) return false;
      if (isSummerStarted) {
        return !isBefore(date, today) && !isBefore(date, summerStart);
      }
      return !isBefore(date, summerStart);
    }).length || 0;

    // Max possible work days (Mon-Sat) in the relevant range
    const maxPossible = getWorkDaysInRange(rangeStart, rangeEnd);

    // Days currently excluded
    const excludedCount = excludedSummerDays.length;

    // Room to add = max possible - current planned
    const roomToAdd = Math.max(0, maxPossible - currentPlanned);

    // Room to remove = current planned (can't go below 1)
    const roomToRemove = Math.max(0, currentPlanned - 1);

    return {
      currentPlanned,
      maxPossible,
      excludedCount,
      roomToAdd,
      roomToRemove,
    };
  }, [plannedDays, effectiveSummerStart, effectiveSummerEnd, excludedSummerDays, isSummerStarted, todayStr]);

  // Effective summer days = current planned + adjustment
  const effectiveSummerDays = Math.max(1, summerDayStats.currentPlanned + customDaysAdjustment);

  // Reset when opened
  const handleOpenChange = useCallback((o: boolean) => {
    if (o) {
      setHypothetical(isSummerStarted ? Math.round(currentProgress * 10) / 10 : Math.round(forecastedPreseasonTotal * 10) / 10);
      setCustomCancelRate(null);
      setCustomDaysAdjustment(0);
    }
    onOpenChange(o);
  }, [forecastedPreseasonTotal, currentProgress, isSummerStarted, onOpenChange]);

  // Presets differ by vet/rookie (only for preseason mode)
  const presets = useMemo(() => {
    const base = Math.round(forecastedPreseasonTotal * 10) / 10;
    const increments = isVet ? [10, 20] : [5, 10];
    return [
      { label: 'Current pace', value: base },
      { label: `+${increments[0]} more`, value: Math.round((base + increments[0]) * 10) / 10 },
      { label: `+${increments[1]} more`, value: Math.round((base + increments[1]) * 10) / 10 },
    ];
  }, [forecastedPreseasonTotal, isVet]);

  // The starting point for summer calculations
  // In summer mode: this is the actual progress so far (locked, not adjustable)
  // In preseason mode: this is the hypothetical preseason total (adjustable)
  const startingPoint = isSummerStarted
    ? currentProgress
    : (typeof hypothetical === 'number' ? hypothetical : 0);

  // User's daily average for severity calibration
  // Priority logic:
  // - Preseason: use historical summer avg (proven capacity) if available, else preseason avg
  // - Summer (< 18 days): use whichever is greater between live summer avg and historical avg
  // - Summer (18+ days): use live summer avg regardless
  const userDailyAvg = useMemo(() => {
    if (isSummerStarted) {
      const liveSummerAvg = summerKnockingDays > 0 ? summerProgress / summerKnockingDays : 0;
      if (summerKnockingDays >= 18) {
        // Enough summer data — use current summer pace
        return liveSummerAvg;
      }
      if (summerKnockingDays >= 7) {
        // Warm-up complete but < 18 days — use whichever is greater
        return Math.max(liveSummerAvg, historicalSummerAvg);
      }
      // < 7 summer days — prefer historical if available
      return historicalSummerAvg > 0 ? historicalSummerAvg : liveSummerAvg;
    }
    // Preseason: use historical summer avg if available (reflects summer capacity)
    if (historicalSummerAvg > 0) return historicalSummerAvg;
    return knockingDays > 0 ? currentProgress / knockingDays : 0;
  }, [isSummerStarted, summerKnockingDays, summerProgress, historicalSummerAvg, knockingDays, currentProgress]);

  // Tier results
  const tierResults = useMemo((): TierResult[] => {
    const tiers = [
      { label: GOAL_TIER_CONFIG.mustDo.label, goal: goals?.must_do_fp_goal || 0 },
      { label: GOAL_TIER_CONFIG.willDo.label, goal: goals?.will_do_fp_goal || 0 },
      { label: GOAL_TIER_CONFIG.couldDo.label, goal: goals?.could_do_fp_goal || 0 },
    ];

    return tiers.map(tier => {
      // Apply preseason cancel rate to preseason progress (startingPoint)
      // to get net funded preseason accounts
      const netPreseason = startingPoint * (1 - baseCancelRate);
      // Remaining to fund in summer
      const remainingToFund = Math.max(0, tier.goal - netPreseason);
      // Apply summer cancel rate only to summer sales
      const summerSellNeeded = activeCancelRate > 0 && activeCancelRate < 1
        ? remainingToFund / (1 - activeCancelRate)
        : remainingToFund;
      const dailyNeeded = effectiveSummerDays > 0 ? summerSellNeeded / effectiveSummerDays : 0;
      // Use 2 decimal places for precision so small cancel rate changes are visible
      const roundedDaily = Math.round(dailyNeeded * 100) / 100;
      const roundedWeekly = Math.round(roundedDaily * 6 * 100) / 100;

      return {
        label: tier.label,
        goal: tier.goal,
        dailyNeeded: roundedDaily,
        weeklyNeeded: roundedWeekly,
        severity: getSeverity(roundedDaily, userDailyAvg),
      };
    });
  }, [startingPoint, goals, effectiveSummerDays, activeCancelRate, baseCancelRate, userDailyAvg]);

  // Slider range for days adjustment
  const minAdjustment = -Math.min(summerDayStats.roomToRemove, 24);
  const maxAdjustment = summerDayStats.roomToAdd;
  const canAdjustDays = maxAdjustment > 0 || minAdjustment < 0;

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92svh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-xl">
            {isSummerStarted ? 'Adjust Your Pace' : 'Plan Your Summer Pace'}
          </DrawerTitle>
          <DrawerDescription>
            {isSummerStarted
              ? 'See how work days and cancel rate affect your needed pace'
              : 'Explore how your preseason total changes your summer workload'}
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-5 overflow-y-auto">
          {/* Preseason input - only shown before summer starts */}
          {!isSummerStarted && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  What if I start summer with…
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={hypothetical}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setHypothetical('');
                      } else {
                        setHypothetical(parseFloat(val));
                      }
                    }}
                    className="text-2xl font-bold h-14 pr-16 text-center"
                    min={0}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                    {efpLabel}
                  </span>
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2">
                {presets.map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      hapticLight();
                      setHypothetical(preset.value);
                    }}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all active:scale-[0.96]",
                      hypothetical === preset.value
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Summer mode: show current progress as fixed context */}
          {isSummerStarted && (
            <div className="rounded-2xl border border-border bg-muted/40 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your progress so far</span>
                <span className="text-xl font-bold">
                  {Math.round(currentProgress * 10) / 10} <span className="text-sm font-normal text-muted-foreground">{efpLabel}</span>
                </span>
              </div>
            </div>
          )}

          {/* Summer days adjustment */}
          <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {isSummerStarted ? 'Remaining work days' : 'Summer work days'}
                </span>
              </div>
              <span className="text-sm font-semibold text-foreground">
                {effectiveSummerDays} days
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  (~{Math.round(effectiveSummerDays / 6)} wks)
                </span>
              </span>
            </div>

            {canAdjustDays && (
              <>
                <Slider
                  value={[customDaysAdjustment]}
                  onValueChange={([val]) => {
                    hapticLight();
                    setCustomDaysAdjustment(val);
                  }}
                  min={minAdjustment}
                  max={maxAdjustment}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{summerDayStats.currentPlanned + minAdjustment} days</span>
                  <span>{summerDayStats.currentPlanned} (current)</span>
                  <span>{summerDayStats.currentPlanned + maxAdjustment} days</span>
                </div>
                {customDaysAdjustment !== 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {customDaysAdjustment > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          +{customDaysAdjustment} more days
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400">
                          {customDaysAdjustment} fewer days
                        </span>
                      )}
                      {' '}vs your current plan
                    </span>
                    <button
                      onClick={() => {
                        hapticLight();
                        setCustomDaysAdjustment(0);
                      }}
                      className="text-xs text-primary font-medium"
                    >
                      Reset
                    </button>
                  </div>
                )}
                {summerDayStats.roomToAdd === 0 && (
                  <p className="text-[10px] text-muted-foreground/70">
                    You're already working every available day (Mon–Sat) in your {isSummerStarted ? 'remaining' : 'summer'} range
                  </p>
                )}
              </>
            )}

            {!canAdjustDays && (
              <p className="text-xs text-muted-foreground">
                You're working every available day in your {isSummerStarted ? 'remaining' : 'summer'} range — no room to adjust.
              </p>
            )}
          </div>

          {/* Tier results */}
          <div className="space-y-3">
            {tierResults.map((tier) => {
              const colors = severityColors[tier.severity];
              const Icon = colors.icon;
              return (
                <motion.div
                  key={tier.label}
                  layout
                  className={cn(
                    "rounded-2xl border p-4 space-y-2 transition-colors",
                    colors.bg,
                    colors.border,
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("w-4 h-4", colors.text)} />
                      <span className="font-semibold text-sm">{tier.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Goal: {tier.goal} {efpLabel}
                    </span>
                  </div>

                  <div className="flex items-baseline gap-4">
                    <div>
                    <span className={cn("text-2xl font-bold tabular-nums", colors.text)}>
                        {tier.dailyNeeded.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">/day</span>
                    </div>
                    <div>
                      <span className={cn("text-lg font-semibold tabular-nums", colors.text)}>
                        {tier.weeklyNeeded.toFixed(2)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">/week</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Cancel rate section */}
          <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Summer cancel rate
              </span>
              <span className="text-sm font-semibold text-foreground">
                {Math.round((customCancelRate !== null ? customCancelRate : baseCancelRate) * 1000) / 10}%
              </span>
            </div>
            <Slider
              value={[(customCancelRate !== null ? customCancelRate : baseCancelRate) * 100]}
              onValueChange={([val]) => {
                hapticLight();
                setCustomCancelRate(val / 100);
              }}
              min={0}
              max={25}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>25%</span>
            </div>
            {customCancelRate !== null && customCancelRate !== baseCancelRate && (
              <button
                onClick={() => {
                  hapticLight();
                  setCustomCancelRate(null);
                }}
                className="text-xs text-primary font-medium"
              >
                Reset to your rate ({Math.round(baseCancelRate * 1000) / 10}%)
              </button>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
