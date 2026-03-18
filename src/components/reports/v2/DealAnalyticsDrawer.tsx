import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { DollarSign, Clock, Zap, TrendingUp, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseISO, getDay } from "date-fns";
import { motion } from "framer-motion";

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

interface DealAnalyticsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIds: string[];
  dateRange: { start: string; end: string };
  totalFP: number;
  totalPRMR: number;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'bg-green-500', textColor: 'text-green-600 dark:text-green-400', emoji: '🟢' },
  medium: { label: 'Medium', color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', emoji: '🟡' },
  hard: { label: 'Hard', color: 'bg-red-500', textColor: 'text-red-600 dark:text-red-400', emoji: '🔴' },
};

export const DealAnalyticsDrawer = ({
  open,
  onOpenChange,
  userIds,
  dateRange,
  totalFP,
  totalPRMR,
}: DealAnalyticsDrawerProps) => {
  // Fetch raw sales data for all team reps in date range
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['team-deal-analytics', userIds, dateRange],
    enabled: open && userIds.length > 0,
    staleTime: 3 * 60 * 1000,
    queryFn: async () => {
      if (userIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, sales_log, user_id')
        .in('user_id', userIds)
        .gte('entry_date', dateRange.start)
        .lte('entry_date', dateRange.end)
        .not('sales_log', 'is', null);

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

    // PRMR averages
    const avgFpPrmr = fpSales.length > 0
      ? fpSales.reduce((sum, s) => sum + (s.prmr || 0), 0) / fpSales.length : 0;
    const avgUpgradePrmr = upgradeSales.length > 0
      ? upgradeSales.reduce((sum, s) => sum + (s.prmr || 0), 0) / upgradeSales.length : 0;

    // Time to sell
    const salesWithTime = sales.filter(s => s.time_to_sell_minutes && s.time_to_sell_minutes > 0);
    const avgTime = salesWithTime.length > 0
      ? salesWithTime.reduce((sum, s) => sum + s.time_to_sell_minutes!, 0) / salesWithTime.length : 0;
    const fastest = salesWithTime.length > 0
      ? Math.min(...salesWithTime.map(s => s.time_to_sell_minutes!)) : 0;
    const slowest = salesWithTime.length > 0
      ? Math.max(...salesWithTime.map(s => s.time_to_sell_minutes!)) : 0;

    // Difficulty distribution
    const salesWithDifficulty = sales.filter(s => s.difficulty);
    const difficultyDist = { easy: 0, medium: 0, hard: 0 };
    salesWithDifficulty.forEach(s => { if (s.difficulty) difficultyDist[s.difficulty]++; });
    const totalDiff = salesWithDifficulty.length || 1;

    // Money spent
    const salesWithSpend = sales.filter(s => s.money_spent && s.money_spent > 0);
    const totalSpent = salesWithSpend.reduce((sum, s) => sum + (s.money_spent || 0), 0);
    const fpPlusCount = fpSales.length + upgradeSales.reduce((sum, s) => sum + (s.prmr || 0) / 85, 0);
    const costPerFpPlus = fpPlusCount > 0 ? totalSpent / fpPlusCount : 0;

    // Day of week heatmap
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0]; // Sun-Sat
    sales.forEach(s => {
      try {
        const day = getDay(parseISO(s.entry_date));
        dayOfWeekCounts[day]++;
      } catch {}
    });
    const maxDayCount = Math.max(...dayOfWeekCounts, 1);

    return {
      fpCount: fpSales.length,
      upgradeCount: upgradeSales.length,
      avgFpPrmr,
      avgUpgradePrmr,
      avgTime,
      fastest,
      slowest,
      hasTimeData: salesWithTime.length > 0,
      difficultyDist,
      hasDifficultyData: salesWithDifficulty.length > 0,
      totalDiff,
      totalSpent,
      costPerFpPlus,
      hasSpendData: salesWithSpend.length > 0,
      dayOfWeekCounts,
      maxDayCount,
    };
  }, [sales]);

  const formatMinutes = (mins: number): string => {
    if (mins < 60) return `${Math.round(mins)}m`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[88vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Deal Breakdown
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-6 overflow-y-auto space-y-5">
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
              {/* FP vs Upgrade Split */}
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
                {/* Visual split bar */}
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

              {/* Avg PRMR Comparison */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Avg PRMR per Deal</div>
                <div className="space-y-2">
                  {/* FP bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">FP</span>
                      <span className="font-bold">${Math.round(analytics.avgFpPrmr)}</span>
                    </div>
                    <div className="h-4 bg-muted/20 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.min(100, (analytics.avgFpPrmr / Math.max(analytics.avgFpPrmr, analytics.avgUpgradePrmr, 1)) * 100)}%`,
                        }}
                        transition={{ duration: 0.6, delay: 0.3 }}
                        className="h-full bg-primary/60 rounded-full"
                      />
                    </div>
                  </div>
                  {/* Upgrade bar */}
                  {analytics.upgradeCount > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Upgrade</span>
                        <span className="font-bold">${Math.round(analytics.avgUpgradePrmr)}</span>
                      </div>
                      <div className="h-4 bg-muted/20 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{
                            width: `${Math.min(100, (analytics.avgUpgradePrmr / Math.max(analytics.avgFpPrmr, analytics.avgUpgradePrmr, 1)) * 100)}%`,
                          }}
                          transition={{ duration: 0.6, delay: 0.4 }}
                          className="h-full bg-muted-foreground/40 rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Time to Sell Spectrum */}
              {analytics.hasTimeData && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Time to Sell
                  </div>
                  <div className="bg-card rounded-xl border border-border/50 p-4">
                    {/* Spectrum visual */}
                    <div className="relative h-10 mb-4">
                      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-green-500/40 via-amber-500/40 to-red-500/40" />
                      {/* Fastest marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                        style={{ left: `${Math.min(95, Math.max(5, (analytics.fastest / analytics.slowest) * 100))}%` }}
                      >
                        <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                      </div>
                      {/* Average marker */}
                      <div
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                        style={{ left: `${Math.min(95, Math.max(5, (analytics.avgTime / analytics.slowest) * 100))}%` }}
                      >
                        <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-background shadow-md" />
                      </div>
                      {/* Slowest marker */}
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: '95%' }}>
                        <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-background shadow-sm" />
                      </div>
                    </div>
                    {/* Labels */}
                    <div className="flex justify-between text-center">
                      <div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatMinutes(analytics.fastest)}</div>
                        <div className="text-[10px] text-muted-foreground">Fastest</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold">{formatMinutes(analytics.avgTime)}</div>
                        <div className="text-[10px] text-muted-foreground">Average</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-600 dark:text-red-400">{formatMinutes(analytics.slowest)}</div>
                        <div className="text-[10px] text-muted-foreground">Longest</div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Difficulty Distribution */}
              {analytics.hasDifficultyData && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Difficulty
                  </div>
                  <div className="flex gap-2">
                    {(Object.entries(DIFFICULTY_CONFIG) as [keyof typeof DIFFICULTY_CONFIG, typeof DIFFICULTY_CONFIG.easy][]).map(([key, config]) => {
                      const count = analytics.difficultyDist[key];
                      const pct = Math.round((count / analytics.totalDiff) * 100);
                      return (
                        <motion.div
                          key={key}
                          initial={{ scale: 0.9, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.4 }}
                          className="flex-1 bg-card rounded-xl border border-border/50 p-3 text-center"
                        >
                          <div className="text-lg mb-0.5">{config.emoji}</div>
                          <div className={cn("text-xl font-bold", config.textColor)}>{count}</div>
                          <div className="text-[10px] text-muted-foreground">{config.label} · {pct}%</div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Cost per FP+ */}
              {analytics.hasSpendData && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    Spend
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1 bg-card rounded-xl border border-border/50 p-3 text-center">
                      <div className="text-2xl font-bold">${Math.round(analytics.totalSpent).toLocaleString()}</div>
                      <div className="text-[10px] text-muted-foreground">Total Spent</div>
                    </div>
                    <div className="flex-1 bg-card rounded-xl border border-border/50 p-3 text-center">
                      <div className="text-2xl font-bold">${Math.round(analytics.costPerFpPlus)}</div>
                      <div className="text-[10px] text-muted-foreground">per FP+</div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Day of Week Heatmap */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Deals by Day
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAY_LABELS.map((label, i) => {
                    // Skip Sunday (0) since we don't work Sundays typically
                    const count = analytics.dayOfWeekCounts[i];
                    const intensity = count / analytics.maxDayCount;
                    return (
                      <div key={label} className="text-center">
                        <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5 + i * 0.05 }}
                          className={cn(
                            "aspect-square rounded-lg flex items-center justify-center text-sm font-bold transition-colors",
                            count === 0 && "bg-muted/20 text-muted-foreground/40",
                            count > 0 && intensity < 0.33 && "bg-primary/15 text-primary/70",
                            count > 0 && intensity >= 0.33 && intensity < 0.66 && "bg-primary/30 text-primary",
                            count > 0 && intensity >= 0.66 && "bg-primary/50 text-primary-foreground",
                          )}
                        >
                          {count || '·'}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Summary line */}
              <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/30">
                {sales.length} total deals across the team
              </div>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
