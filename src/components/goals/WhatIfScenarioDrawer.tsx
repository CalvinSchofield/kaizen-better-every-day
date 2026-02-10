import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { parseISO, isBefore } from 'date-fns';

const GLOBAL_SUMMER_START = '2026-04-12';

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
}

interface TierResult {
  label: string;
  goal: number;
  dailyNeeded: number;
  weeklyNeeded: number;
  severity: 'green' | 'amber' | 'red';
  contextLine: string;
}

const AnimatedNumber = ({ value, suffix = '' }: { value: number; suffix?: string }) => (
  <AnimatePresence mode="wait">
    <motion.span
      key={value}
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -8, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="inline-block"
    >
      {value}{suffix}
    </motion.span>
  </AnimatePresence>
);

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

function getContextLine(dailyNeeded: number, efpLabel: string): string {
  if (dailyNeeded <= 0) return "You're already there! 🎉";
  if (dailyNeeded < 0.5) return `Less than 1 ${efpLabel} every other day`;
  if (dailyNeeded < 1) return `About 1 ${efpLabel} every ${Math.round(1 / dailyNeeded)} days`;
  if (dailyNeeded < 2) return `About 1 ${efpLabel} per day — very doable`;
  if (dailyNeeded < 3) return `Solid pace — ${Math.round(dailyNeeded)} per day`;
  if (dailyNeeded < 5) return `Aggressive — gotta bring it every day`;
  return `Elite pace — every door counts`;
}

function getSeverity(dailyNeeded: number): 'green' | 'amber' | 'red' {
  if (dailyNeeded <= 0) return 'green';
  if (dailyNeeded <= 2) return 'green';
  if (dailyNeeded <= 4) return 'amber';
  return 'red';
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
}: WhatIfScenarioDrawerProps) => {
  const [hypothetical, setHypothetical] = useState<number | ''>(Math.round(forecastedPreseasonTotal * 10) / 10);

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';

  // Reset when opened
  const handleOpenChange = useCallback((o: boolean) => {
    if (o) {
      setHypothetical(Math.round(forecastedPreseasonTotal * 10) / 10);
    }
    onOpenChange(o);
  }, [forecastedPreseasonTotal, onOpenChange]);

  // Count planned summer days
  const summerStats = useMemo(() => {
    const summerStart = parseISO(GLOBAL_SUMMER_START);
    const futureSummerPlanned = plannedDays?.filter(d => {
      const date = parseISO(d.planned_date);
      return !isBefore(date, summerStart);
    }).length || 0;

    // Estimate weeks: summer days / 6 (assuming ~6 day work weeks)
    const summerWeeks = futureSummerPlanned > 0 ? futureSummerPlanned / 6 : 1;
    return { days: futureSummerPlanned, weeks: Math.max(1, summerWeeks) };
  }, [plannedDays]);

  // Presets
  const presets = useMemo(() => {
    const base = Math.round(forecastedPreseasonTotal * 10) / 10;
    return [
      { label: 'Current pace', value: base },
      { label: `+5 more`, value: Math.round((base + 5) * 10) / 10 },
      { label: `+10 more`, value: Math.round((base + 10) * 10) / 10 },
    ];
  }, [forecastedPreseasonTotal]);

  // Tier results
  const tierResults = useMemo((): TierResult[] => {
    const hyp = typeof hypothetical === 'number' ? hypothetical : 0;
    const cancelRate = goals?.cancel_rate || 0;
    const buffer = (goal: number) => cancelRate > 0 && cancelRate < 1 ? goal / (1 - cancelRate) : goal;

    const tiers = [
      { label: 'Must Do', goal: goals?.must_do_fp_goal || 0 },
      { label: 'Will Do', goal: goals?.will_do_fp_goal || 0 },
      { label: 'Could Do', goal: goals?.could_do_fp_goal || 0 },
    ];

    return tiers.map(tier => {
      const funded = buffer(tier.goal);
      const remaining = Math.max(0, funded - hyp);
      const dailyNeeded = summerStats.days > 0 ? remaining / summerStats.days : 0;
      const weeklyNeeded = summerStats.weeks > 0 ? remaining / summerStats.weeks : 0;
      const roundedDaily = Math.round(dailyNeeded * 10) / 10;
      const roundedWeekly = Math.round(weeklyNeeded * 10) / 10;

      return {
        label: tier.label,
        goal: tier.goal,
        dailyNeeded: roundedDaily,
        weeklyNeeded: roundedWeekly,
        severity: getSeverity(roundedDaily),
        contextLine: getContextLine(roundedDaily, efpLabel),
      };
    });
  }, [hypothetical, goals, summerStats, efpLabel]);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent className="max-h-[92svh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-xl">Plan Your Summer Pace</DrawerTitle>
          <DrawerDescription>
            Explore how your preseason total changes your summer workload
          </DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-6 space-y-5 overflow-y-auto">
          {/* Input section */}
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

          {/* Summer days context */}
          <div className="text-center text-xs text-muted-foreground">
            Based on <span className="font-semibold text-foreground">{summerStats.days}</span> planned summer days
            {' '}(~{Math.round(summerStats.weeks)} weeks)
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
                      <span className={cn("text-2xl font-bold", colors.text)}>
                        <AnimatedNumber value={tier.dailyNeeded} />
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">/day</span>
                    </div>
                    <div>
                      <span className={cn("text-lg font-semibold", colors.text)}>
                        <AnimatedNumber value={tier.weeklyNeeded} />
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">/week</span>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">{tier.contextLine}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
