import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { hapticLight, hapticMedium } from '@/utils/haptics';
import { TrendingUp, TrendingDown, Minus, SlidersHorizontal } from 'lucide-react';
import { parseISO, isBefore } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  isVet: boolean;
}

interface TierResult {
  label: string;
  goal: number;
  dailyNeeded: number;
  weeklyNeeded: number;
  severity: 'green' | 'amber' | 'red';
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
  isVet,
}: WhatIfScenarioDrawerProps) => {
  const [hypothetical, setHypothetical] = useState<number | ''>(Math.round(forecastedPreseasonTotal * 10) / 10);
  const [customCancelRate, setCustomCancelRate] = useState<number | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const efpLabel = efpModeEnabled ? 'EFP' : 'FP+';
  const baseCancelRate = goals?.cancel_rate || 0;
  const activeCancelRate = customCancelRate !== null ? customCancelRate : baseCancelRate;

  // Reset when opened
  const handleOpenChange = useCallback((o: boolean) => {
    if (o) {
      setHypothetical(Math.round(forecastedPreseasonTotal * 10) / 10);
      setCustomCancelRate(null);
      setAdvancedOpen(false);
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

    const summerWeeks = futureSummerPlanned > 0 ? futureSummerPlanned / 6 : 1;
    return { days: futureSummerPlanned, weeks: Math.max(1, summerWeeks) };
  }, [plannedDays]);

  // Presets differ by vet/rookie
  const presets = useMemo(() => {
    const base = Math.round(forecastedPreseasonTotal * 10) / 10;
    const increments = isVet ? [10, 20] : [5, 10];
    return [
      { label: 'Current pace', value: base },
      { label: `+${increments[0]} more`, value: Math.round((base + increments[0]) * 10) / 10 },
      { label: `+${increments[1]} more`, value: Math.round((base + increments[1]) * 10) / 10 },
    ];
  }, [forecastedPreseasonTotal, isVet]);

  // Tier results
  const tierResults = useMemo((): TierResult[] => {
    const hyp = typeof hypothetical === 'number' ? hypothetical : 0;
    const buffer = (goal: number) => activeCancelRate > 0 && activeCancelRate < 1 ? goal / (1 - activeCancelRate) : goal;

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
      };
    });
  }, [hypothetical, goals, summerStats, activeCancelRate]);

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
                </motion.div>
              );
            })}
          </div>

          {/* Advanced: Cancel rate override */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <SlidersHorizontal className="w-4 h-4" />
              <span className="font-medium">Fine-tune assumptions</span>
              <motion.span
                animate={{ rotate: advancedOpen ? 90 : 0 }}
                transition={{ duration: 0.15 }}
                className="ml-auto text-xs"
              >
                ▸
              </motion.span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="pt-2 pb-1 space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-foreground">
                      Summer cancel rate
                    </label>
                    <span className="text-sm font-semibold text-foreground">
                      {Math.round((customCancelRate !== null ? customCancelRate : baseCancelRate) * 1000) / 10}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={0.25}
                    step={0.001}
                    value={customCancelRate !== null ? customCancelRate : baseCancelRate}
                    onChange={(e) => {
                      hapticLight();
                      setCustomCancelRate(parseFloat(e.target.value));
                    }}
                    className="w-full h-2 rounded-full appearance-none bg-muted accent-primary cursor-pointer"
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
            </CollapsibleContent>
          </Collapsible>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
