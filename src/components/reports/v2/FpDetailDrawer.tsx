import { useState } from "react";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import { KpiDetailDrawer } from "./KpiDetailDrawer";
import { DealAnalyticsDrawer } from "./DealAnalyticsDrawer";

interface FpDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userIds: string[];
  dateRange: { start: string; end: string };
  totalFP: number;
  totalPRMR: number;
  sparklineData?: number[];
  sparklineAvg?: number;
  sparklineAvgLabel?: string;
}

/**
 * FP+ detail drawer with two tabs:
 * 1. Deal Breakdown (existing DealAnalyticsDrawer content)
 * 2. Rep Breakdown (KpiDetailDrawer pattern)
 */
export const FpDetailDrawer = ({
  open, onOpenChange, userIds, dateRange,
  totalFP, totalPRMR, sparklineData, sparklineAvg, sparklineAvgLabel,
}: FpDetailDrawerProps) => {
  // Instead of nesting drawers, we render tabs inline
  // We reuse the internal content of DealAnalytics and KpiDetail

  return (
    <>
      {/* Tab 1: Deal Breakdown — reuse existing drawer */}
      {/* Tab 2: Rep Breakdown — reuse KpiDetailDrawer */}
      {/* Since both are drawers, we compose them as a single drawer with tabs */}
      <FpTabsDrawer
        open={open}
        onOpenChange={onOpenChange}
        userIds={userIds}
        dateRange={dateRange}
        totalFP={totalFP}
        totalPRMR={totalPRMR}
        sparklineData={sparklineData}
        sparklineAvg={sparklineAvg}
        sparklineAvgLabel={sparklineAvgLabel}
      />
    </>
  );
};

const FpTabsDrawer = ({
  open, onOpenChange, userIds, dateRange,
  totalFP, totalPRMR, sparklineData, sparklineAvg, sparklineAvgLabel,
}: FpDetailDrawerProps) => {
  const [showRepBreakdown, setShowRepBreakdown] = useState(false);

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              FP+ Details
            </DrawerTitle>
          </DrawerHeader>
          <Tabs defaultValue="deals" className="w-full">
            <div className="px-4 pb-3">
              <TabsList className="w-full">
                <TabsTrigger value="deals" className="flex-1">Deal Breakdown</TabsTrigger>
                <TabsTrigger value="reps" className="flex-1">Rep Breakdown</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="deals" className="mt-0">
              {/* Inline the DealAnalytics content */}
              <DealAnalyticsInline
                userIds={userIds}
                dateRange={dateRange}
                totalFP={totalFP}
                totalPRMR={totalPRMR}
              />
            </TabsContent>

            <TabsContent value="reps" className="mt-0">
              <RepBreakdownInline
                userIds={userIds}
                dateRange={dateRange}
                totalFP={totalFP}
                sparklineData={sparklineData}
                sparklineAvg={sparklineAvg}
                sparklineAvgLabel={sparklineAvgLabel}
                onClose={() => onOpenChange(false)}
              />
            </TabsContent>
          </Tabs>
        </DrawerContent>
      </Drawer>
    </>
  );
};

// We need to extract the content from DealAnalyticsDrawer into a reusable component.
// For now, let's just render the DealAnalyticsDrawer as a nested drawer triggered from the tab.
// Actually, a cleaner approach: render the KpiDetailDrawer content inline.

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { MicroSparkline } from "./MicroSparkline";
import { DollarSign, Clock, Zap, TrendingUp } from "lucide-react";
import { parseISO, getDay } from "date-fns";
import { motion } from "framer-motion";

interface RepContribution {
  userId: string;
  name: string;
  photoUrl?: string | null;
  value: number;
}

const RepBreakdownInline = ({
  userIds, dateRange, totalFP, sparklineData, sparklineAvg, onClose,
}: {
  userIds: string[];
  dateRange: { start: string; end: string };
  totalFP: number;
  sparklineData?: number[];
  sparklineAvg?: number;
  onClose: () => void;
}) => {
  const { data: contributions, isLoading } = useQuery({
    queryKey: ['kpi-rep-breakdown', 'fp', dateRange?.start, dateRange?.end, userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus')
        .in('user_id', userIds)
        .gte('entry_date', dateRange.start)
        .lte('entry_date', dateRange.end);
      if (error) throw error;

      const totals = new Map<string, number>();
      (entries || []).forEach((e: any) => {
        const val = Number(e.fp_plus) || 0;
        totals.set(e.user_id, (totals.get(e.user_id) || 0) + val);
      });

      const activeUserIds = [...totals.keys()].filter(id => (totals.get(id) || 0) > 0);
      if (activeUserIds.length === 0) return [];

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, profile_photo_url')
        .in('user_id', activeUserIds);

      const repsMap = new Map((reps || []).map(r => [r.user_id, r]));
      const result: RepContribution[] = activeUserIds.map(id => ({
        userId: id,
        name: repsMap.get(id)?.name || 'Unknown',
        photoUrl: repsMap.get(id)?.profile_photo_url,
        value: totals.get(id) || 0,
      }));
      result.sort((a, b) => b.value - a.value);
      return result;
    },
    enabled: userIds.length > 0,
    staleTime: 60000,
  });

  const total = useMemo(() =>
    (contributions || []).reduce((s, c) => s + c.value, 0),
    [contributions]
  );

  return (
    <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60vh]">
      {sparklineData && sparklineData.length >= 2 && (
        <div className="bg-card rounded-xl border border-border/50 p-4">
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-3xl font-bold text-foreground">{totalFP.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground">FP+</span>
          </div>
          <MicroSparkline data={sparklineData} width={300} height={60} goldLine={sparklineAvg} />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />)}
        </div>
      ) : !contributions || contributions.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No breakdown available</p>
      ) : (
        <div className="space-y-1.5">
          {contributions.map((rep, idx) => {
            const pct = total > 0 ? (rep.value / total) * 100 : 0;
            return (
              <div key={rep.userId} className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/50">
                <span className={cn(
                  "w-5 text-center text-xs font-bold",
                  idx === 0 ? "text-amber-500" : idx === 1 ? "text-muted-foreground" : "text-muted-foreground/60"
                )}>{idx + 1}</span>
                <ProfileAvatar
                  userId={rep.userId}
                  name={rep.name}
                  photoUrl={rep.photoUrl}
                  className="h-8 w-8"
                  fallbackClassName="text-[10px] bg-muted"
                  onBeforeNavigate={onClose}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{rep.name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className={cn("text-sm font-bold", idx === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                    {rep.value.toFixed(1)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Inline deal analytics content (extracted from DealAnalyticsDrawer)
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

const DealAnalyticsInline = ({
  userIds, dateRange, totalFP, totalPRMR,
}: {
  userIds: string[];
  dateRange: { start: string; end: string };
  totalFP: number;
  totalPRMR: number;
}) => {
  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['team-deal-analytics', userIds, dateRange],
    enabled: userIds.length > 0,
    staleTime: 3 * 60 * 1000,
    retry: 2,
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, sales_log, user_id')
        .in('user_id', userIds)
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
    const salesWithSpend = sales.filter(s => s.money_spent && s.money_spent > 0);
    const totalSpent = salesWithSpend.reduce((sum, s) => sum + (s.money_spent || 0), 0);
    const fpPlusCount = fpSales.length + upgradeSales.reduce((sum, s) => sum + (s.prmr || 0) / 85, 0);
    const costPerFpPlus = fpPlusCount > 0 ? totalSpent / fpPlusCount : 0;
    const dayOfWeekCounts = [0, 0, 0, 0, 0, 0, 0];
    sales.forEach(s => { try { dayOfWeekCounts[getDay(parseISO(s.entry_date))]++; } catch {} });
    const maxDayCount = Math.max(...dayOfWeekCounts, 1);

    return {
      fpCount: fpSales.length, upgradeCount: upgradeSales.length,
      avgFpPrmr, avgUpgradePrmr, avgTime, fastest, slowest,
      hasTimeData: salesWithTime.length > 0,
      difficultyDist, hasDifficultyData: salesWithDifficulty.length > 0, totalDiff,
      totalSpent, costPerFpPlus, hasSpendData: salesWithSpend.length > 0,
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
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Time to Sell
              </div>
              <div className="bg-card rounded-xl border border-border/50 p-4">
                <div className="relative h-10 mb-4">
                  <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-green-500/40 via-amber-500/40 to-red-500/40" />
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${Math.min(95, Math.max(5, (analytics.fastest / analytics.slowest) * 100))}%` }}>
                    <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-background shadow-sm" />
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${Math.min(95, Math.max(5, (analytics.avgTime / analytics.slowest) * 100))}%` }}>
                    <div className="w-5 h-5 rounded-full bg-amber-500 border-2 border-background shadow-md" />
                  </div>
                  <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: '95%' }}>
                    <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-background shadow-sm" />
                  </div>
                </div>
                <div className="flex justify-between text-center">
                  <div><div className="text-lg font-bold text-green-600 dark:text-green-400">{formatMinutes(analytics.fastest)}</div><div className="text-[10px] text-muted-foreground">Fastest</div></div>
                  <div><div className="text-lg font-bold">{formatMinutes(analytics.avgTime)}</div><div className="text-[10px] text-muted-foreground">Average</div></div>
                  <div><div className="text-lg font-bold text-red-600 dark:text-red-400">{formatMinutes(analytics.slowest)}</div><div className="text-[10px] text-muted-foreground">Longest</div></div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Difficulty */}
          {analytics.hasDifficultyData && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Difficulty
              </div>
              <div className="flex gap-2">
                {(Object.entries(DIFFICULTY_CONFIG) as [keyof typeof DIFFICULTY_CONFIG, typeof DIFFICULTY_CONFIG['easy']][]).map(([key, config]) => {
                  const count = analytics.difficultyDist[key];
                  const pct = Math.round((count / analytics.totalDiff) * 100);
                  return (
                    <motion.div key={key} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4 }} className="flex-1 bg-card rounded-xl border border-border/50 p-3 text-center">
                      <div className="text-lg mb-0.5">{config.emoji}</div>
                      <div className={cn("text-xl font-bold", config.textColor)}>{count}</div>
                      <div className="text-[10px] text-muted-foreground">{config.label} · {pct}%</div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Spend */}
          {analytics.hasSpendData && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Spend
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

          {/* Day of Week */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> Deals by Day
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAY_LABELS.map((label, i) => {
                const count = analytics.dayOfWeekCounts[i];
                const intensity = count / analytics.maxDayCount;
                return (
                  <div key={label} className="text-center">
                    <div className="text-[10px] text-muted-foreground mb-1">{label}</div>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.5 + i * 0.05 }} className={cn("mx-auto w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold", count === 0 ? "bg-muted/20 text-muted-foreground/40" : "text-foreground")} style={{ backgroundColor: count > 0 ? `hsl(var(--primary) / ${0.1 + intensity * 0.4})` : undefined }}>
                      {count}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
};
