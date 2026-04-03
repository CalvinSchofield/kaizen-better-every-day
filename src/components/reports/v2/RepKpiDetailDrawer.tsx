import { useMemo } from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { MicroSparkline } from "./MicroSparkline";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight, TrendingUp, TrendingDown, Minus, Trophy, BarChart3 } from "lucide-react";
import type { ComparisonTotals, SparklinePoint } from "@/hooks/useReportsV2Comparison";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, getDay, differenceInDays } from "date-fns";

type MetricKey = 'doors' | 'dms' | 'pitches' | 'transitions' | 'presentations' | 'fp';

interface RepKpiDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricKey: MetricKey | null;
  current: ComparisonTotals;
  comparison: ComparisonTotals | null;
  sparklineHistory: SparklinePoint[];
  repName: string;
  periodLabel: string;
  comparisonLabel: string;
  userId: string;
  dateRange: { start: string; end: string };
}

const METRIC_LABELS: Record<MetricKey, string> = {
  doors: 'Doors',
  dms: 'Decision Makers',
  pitches: 'Pitches',
  transitions: 'Transitions',
  presentations: 'Presentations',
  fp: 'FP+',
};

const FUNNEL_CONFIG: Record<Exclude<MetricKey, 'fp'>, { steps: { label: string; fromKey: MetricKey; toKey: MetricKey }[] }> = {
  doors: {
    steps: [
      { label: 'Decision Makers', fromKey: 'doors', toKey: 'dms' },
      { label: 'Pitches (from DMs)', fromKey: 'dms', toKey: 'pitches' },
    ],
  },
  dms: {
    steps: [
      { label: 'from Doors', fromKey: 'doors', toKey: 'dms' },
      { label: '→ Pitches', fromKey: 'dms', toKey: 'pitches' },
    ],
  },
  pitches: {
    steps: [
      { label: 'from DMs', fromKey: 'dms', toKey: 'pitches' },
      { label: '→ Transitions', fromKey: 'pitches', toKey: 'transitions' },
    ],
  },
  transitions: {
    steps: [
      { label: 'from Pitches', fromKey: 'pitches', toKey: 'transitions' },
      { label: '→ Presentations', fromKey: 'transitions', toKey: 'presentations' },
    ],
  },
  presentations: {
    steps: [
      { label: 'from Transitions', fromKey: 'transitions', toKey: 'presentations' },
      { label: '→ Close (FP+)', fromKey: 'presentations', toKey: 'fp' },
    ],
  },
};

const formatValue = (key: MetricKey, value: number): string => {
  if (key === 'fp') return value.toFixed(1);
  return Math.round(value).toLocaleString();
};

/** Determine period granularity from the date range span */
function getPeriodGranularity(dateRange: { start: string; end: string }): 'day' | 'week' | 'month' | 'multi-month' {
  const days = differenceInDays(parseISO(dateRange.end), parseISO(dateRange.start)) + 1;
  if (days <= 1) return 'day';
  if (days <= 7) return 'week';
  if (days <= 31) return 'month';
  return 'multi-month';
}

function getPeriodLabels(granularity: 'day' | 'week' | 'month' | 'multi-month') {
  switch (granularity) {
    case 'day': return { avgLabel: 'Daily Avg', bestLabel: 'Best Day', sparkUnit: '/day' };
    case 'week': return { avgLabel: 'Daily Avg', bestLabel: 'Best Day', sparkUnit: '/day' };
    case 'month': return { avgLabel: 'Daily Avg', bestLabel: 'Best Day', sparkUnit: '/day' };
    case 'multi-month': return { avgLabel: 'Monthly Avg', bestLabel: 'Best Month', sparkUnit: '/mo' };
  }
}

export const RepKpiDetailDrawer = ({
  open, onOpenChange, metricKey, current, comparison, sparklineHistory,
  repName, periodLabel, comparisonLabel, userId, dateRange,
}: RepKpiDetailDrawerProps) => {
  if (!metricKey) return null;

  const granularity = getPeriodGranularity(dateRange);
  const labels = getPeriodLabels(granularity);

  if (metricKey === 'fp') {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88vh] overflow-y-auto z-[80]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              FP+ Details
            </DrawerTitle>
            <DrawerDescription>{repName} · {periodLabel}</DrawerDescription>
          </DrawerHeader>
          <DealBreakdownContent
            userId={userId}
            dateRange={dateRange}
            totalFP={current.fp}
            totalPRMR={current.prmr}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh] overflow-y-auto z-[80]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>{METRIC_LABELS[metricKey]}</DrawerTitle>
          <DrawerDescription>{repName} · {periodLabel}</DrawerDescription>
        </DrawerHeader>
        <EffortMetricContent
          metricKey={metricKey}
          current={current}
          comparison={comparison}
          sparklineHistory={sparklineHistory}
          granularity={granularity}
          labels={labels}
          comparisonLabel={comparisonLabel}
        />
      </DrawerContent>
    </Drawer>
  );
};

// ─── Effort Metric Content ───────────────────────────────────────────

const EffortMetricContent = ({
  metricKey, current, comparison, sparklineHistory, granularity, labels, comparisonLabel,
}: {
  metricKey: Exclude<MetricKey, 'fp'>;
  current: ComparisonTotals;
  comparison: ComparisonTotals | null;
  sparklineHistory: SparklinePoint[];
  granularity: 'day' | 'week' | 'month' | 'multi-month';
  labels: { avgLabel: string; bestLabel: string; sparkUnit: string };
  comparisonLabel: string;
}) => {
  const sparkData = sparklineHistory.map(p => (p as any)[metricKey] || 0);
  const total = current[metricKey];

  // For multi-month ranges, sparkline points are monthly — avg/best are monthly
  const isMonthly = granularity === 'multi-month';
  const daysWorked = sparkData.filter(v => v > 0).length || 1;
  const avg = isMonthly
    ? (sparkData.length > 0 ? sparkData.reduce((a, b) => a + b, 0) / sparkData.length : 0)
    : total / daysWorked;
  const best = sparkData.length > 0 ? Math.max(...sparkData) : 0;
  const sparkAvg = sparkData.length > 0 ? sparkData.reduce((a, b) => a + b, 0) / sparkData.length : 0;

  const funnel = FUNNEL_CONFIG[metricKey];

  return (
    <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60vh]">
      {/* Big value + sparkline */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border/50 p-4"
      >
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-foreground">
            {formatValue(metricKey, total)}
          </span>
          <span className="text-sm text-muted-foreground">{METRIC_LABELS[metricKey]}</span>
        </div>
        {sparkData.length >= 2 && (
          <MicroSparkline
            data={sparkData}
            width={300}
            height={60}
            goldLine={sparkAvg}
            showGoldLabel
            formatGoldLabel={(v) => `${Math.round(v)}${labels.sparkUnit}`}
          />
        )}
      </motion.div>

      {/* Benchmarks */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
          <TrendingUp className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
          <div className="text-lg font-bold text-foreground">{avg.toFixed(1)}</div>
          <div className="text-[11px] text-muted-foreground">{labels.avgLabel}</div>
        </div>
        <div className="bg-card rounded-xl border border-border/50 p-3 text-center">
          <Trophy className="w-4 h-4 mx-auto mb-1 text-amber-500" />
          <div className="text-lg font-bold text-foreground">{best}</div>
          <div className="text-[11px] text-muted-foreground">{labels.bestLabel}</div>
        </div>
      </motion.div>

      {/* Conversion Funnel with Momentum */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
          Conversion Funnel
        </div>
        <div className="space-y-2">
          {funnel.steps.map((step, i) => {
            const from = current[step.fromKey];
            const to = current[step.toKey];
            const pct = from > 0 ? (to / from) * 100 : 0;

            // Comparison momentum
            let compPct: number | null = null;
            let delta: number | null = null;
            if (comparison) {
              const compFrom = comparison[step.fromKey];
              const compTo = comparison[step.toKey];
              compPct = compFrom > 0 ? (compTo / compFrom) * 100 : null;
              if (compPct !== null && compPct > 0) {
                delta = pct - compPct;
              }
            }

            return (
              <div
                key={i}
                className="bg-card rounded-xl border border-border/50 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 text-sm">
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-muted-foreground">{step.label}</span>
                    </div>
                    <div className="mt-1.5 h-2 bg-muted/30 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, pct)}%` }}
                        transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
                        className={cn(
                          "h-full rounded-full",
                          pct >= 50 ? "bg-green-500/60" : pct >= 25 ? "bg-amber-500/60" : "bg-destructive/60"
                        )}
                      />
                    </div>
                  </div>
                  <span className={cn(
                    "text-lg font-bold tabular-nums min-w-[3rem] text-right",
                    pct >= 50 ? "text-green-600 dark:text-green-400" : pct >= 25 ? "text-amber-600 dark:text-amber-400" : "text-destructive"
                  )}>
                    {pct.toFixed(1)}%
                  </span>
                </div>

                {/* Momentum comparison */}
                {delta !== null && compPct !== null && (
                  <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/30">
                    <div className={cn(
                      "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
                      delta > 2 ? "text-green-600 dark:text-green-400 bg-green-500/10" :
                      delta < -2 ? "text-destructive bg-destructive/10" :
                      "text-muted-foreground bg-muted/50"
                    )}>
                      {delta > 2 ? <TrendingUp className="w-2.5 h-2.5" /> :
                       delta < -2 ? <TrendingDown className="w-2.5 h-2.5" /> :
                       <Minus className="w-2.5 h-2.5" />}
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}pp
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      vs {compPct.toFixed(1)}% {comparisonLabel}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

// ─── Deal Breakdown Content (for FP+) ────────────────────────────────

interface Sale {
  type: 'fp' | 'upgrade';
  prmr: number;
  timestamp?: string;
  deal_type?: 'fresh' | 'takeover' | 'diy';
  money_spent?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  time_to_sell_minutes?: number;
  install_status?: string;
  entry_date: string;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', emoji: '🟢' },
  medium: { label: 'Medium', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', emoji: '🟡' },
  hard: { label: 'Hard', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', emoji: '🔴' },
};

const DealBreakdownContent = ({
  userId, dateRange, totalFP, totalPRMR,
}: {
  userId: string;
  dateRange: { start: string; end: string };
  totalFP: number;
  totalPRMR: number;
}) => {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['rep-deal-analytics', userId, dateRange],
    enabled: !!userId,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, sales_log')
        .eq('user_id', userId)
        .gte('entry_date', dateRange.start)
        .lte('entry_date', dateRange.end)
        .not('sales_log', 'is', null)
        .neq('sales_log', '[]');
      if (error) throw error;

      const allSales: Sale[] = [];
      for (const entry of data || []) {
        const salesLog = entry.sales_log as any[] | null;
        if (salesLog && Array.isArray(salesLog)) {
          for (const sale of salesLog) {
            if (sale.install_status === 'never_installed') continue;
            if (sale.prmr !== undefined) {
              allSales.push({ ...sale, entry_date: entry.entry_date });
            }
          }
        }
      }
      return allSales;
    },
  });

  const analytics = useMemo(() => {
    if (sales.length === 0) return null;
    const fpSales = sales.filter(s => s.type === 'fp');
    const upgradeSales = sales.filter(s => s.type === 'upgrade');
    const avgFpPrmr = fpSales.length > 0 ? fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0) / fpSales.length : 0;
    const avgUpgradePrmr = upgradeSales.length > 0 ? upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0) / upgradeSales.length : 0;
    const salesWithTime = sales.filter(s => s.time_to_sell_minutes && s.time_to_sell_minutes > 0);
    const avgTime = salesWithTime.length > 0 ? salesWithTime.reduce((sum, s) => sum + s.time_to_sell_minutes!, 0) / salesWithTime.length : 0;
    const fastest = salesWithTime.length > 0 ? Math.min(...salesWithTime.map(s => s.time_to_sell_minutes!)) : 0;
    const slowest = salesWithTime.length > 0 ? Math.max(...salesWithTime.map(s => s.time_to_sell_minutes!)) : 0;
    const salesWithDifficulty = sales.filter(s => s.difficulty);
    const difficultyDist = { easy: 0, medium: 0, hard: 0 };
    salesWithDifficulty.forEach(s => { if (s.difficulty) difficultyDist[s.difficulty]++; });
    const totalDiff = salesWithDifficulty.length || 1;
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
    sales.forEach(s => { try { dayOfWeekCounts[getDay(parseISO(s.entry_date))]++; } catch {} });
    const maxDayCount = Math.max(...dayOfWeekCounts, 1);

    return {
      fpCount: fpSales.length, upgradeCount: upgradeSales.length,
      avgFpPrmr, avgUpgradePrmr, avgTime, fastest, slowest,
      hasTimeData: salesWithTime.length > 0,
      difficultyDist, hasDifficultyData: salesWithDifficulty.length > 0, totalDiff,
      dayOfWeekCounts, maxDayCount,
    };
  }, [sales]);

  const formatMinutes = (mins: number): string => {
    if (mins < 60) return `${Math.round(mins)}m`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="px-4 pb-6 overflow-y-auto space-y-5 max-h-[60vh]">
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : !analytics || sales.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12">
          No deal data available for this period
        </div>
      ) : (
        <>
          {/* FP vs Upgrade */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">FP vs Upgrade</div>
            <div className="flex gap-3">
              <div className="flex-1 bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{analytics.fpCount}</div>
                <div className="text-[11px] text-muted-foreground">FP Sales</div>
              </div>
              <div className="flex-1 bg-accent/50 border border-border/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-bold">{analytics.upgradeCount}</div>
                <div className="text-[11px] text-muted-foreground">Upgrades</div>
              </div>
            </div>
            <div className="mt-2 h-3 rounded-full overflow-hidden flex bg-muted/30">
              {analytics.fpCount > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(analytics.fpCount / (analytics.fpCount + analytics.upgradeCount)) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="bg-primary/70 rounded-l-full"
                />
              )}
              {analytics.upgradeCount > 0 && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(analytics.upgradeCount / (analytics.fpCount + analytics.upgradeCount)) * 100}%` }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="bg-muted-foreground/30 rounded-r-full"
                />
              )}
            </div>
          </motion.div>

          {/* Avg PRMR */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Avg PRMR per Deal</div>
            <div className="space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">FP</span>
                  <span className="font-bold">${Math.round(analytics.avgFpPrmr)}</span>
                </div>
                <div className="h-4 bg-muted/20 rounded-full overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (analytics.avgFpPrmr / Math.max(analytics.avgFpPrmr, analytics.avgUpgradePrmr, 1)) * 100)}%` }} transition={{ duration: 0.6, delay: 0.3 }} className="h-full bg-primary/60 rounded-full" />
                </div>
              </div>
              {analytics.upgradeCount > 0 && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Upgrade</span>
                    <span className="font-bold">${Math.round(analytics.avgUpgradePrmr)}</span>
                  </div>
                  <div className="h-4 bg-muted/20 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, (analytics.avgUpgradePrmr / Math.max(analytics.avgFpPrmr, analytics.avgUpgradePrmr, 1)) * 100)}%` }} transition={{ duration: 0.6, delay: 0.4 }} className="h-full bg-muted-foreground/40 rounded-full" />
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Time to Sell */}
          {analytics.hasTimeData && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">⏱ Time to Sell</div>
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <div className="relative h-10 mb-4">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-green-500/40 via-amber-500/40 to-red-500/40" />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${Math.min(95, Math.max(5, (analytics.fastest / analytics.slowest) * 100))}%` }}>
                    <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${Math.min(95, Math.max(5, (analytics.avgTime / analytics.slowest) * 100))}%` }}>
                    <div className="w-5 h-5 rounded-full bg-primary border-2 border-background shadow-md" />
                  </div>
                </div>
                <div className="grid grid-cols-3 text-center text-xs">
                  <div><span className="font-bold text-green-600 dark:text-green-400">{formatMinutes(analytics.fastest)}</span><br /><span className="text-muted-foreground">Fastest</span></div>
                  <div><span className="font-bold text-foreground">{formatMinutes(analytics.avgTime)}</span><br /><span className="text-muted-foreground">Avg</span></div>
                  <div><span className="font-bold text-red-600 dark:text-red-400">{formatMinutes(analytics.slowest)}</span><br /><span className="text-muted-foreground">Slowest</span></div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Difficulty */}
          {analytics.hasDifficultyData && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Difficulty</div>
              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map(d => {
                  const count = analytics.difficultyDist[d];
                  const pct = (count / analytics.totalDiff) * 100;
                  const config = DIFFICULTY_CONFIG[d];
                  return (
                    <div key={d} className="flex-1 bg-card rounded-xl border border-border/50 p-2.5 text-center">
                      <div className="text-sm mb-0.5">{config.emoji}</div>
                      <div className={cn("text-lg font-bold", config.textColor)}>{count}</div>
                      <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% {config.label}</div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Day of Week */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Sales by Day of Week</div>
            <div className="flex items-end gap-1.5 h-16">
              {analytics.dayOfWeekCounts.map((count, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(count / analytics.maxDayCount) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
                    className={cn("w-full rounded-t-sm min-h-[2px]", count > 0 ? "bg-primary/60" : "bg-muted/30")}
                    style={{ minHeight: count > 0 ? 4 : 2 }}
                  />
                  <span className="text-[9px] text-muted-foreground">{DAY_LABELS[i]}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};
