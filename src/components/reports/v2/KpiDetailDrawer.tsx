import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { MicroSparkline } from "./MicroSparkline";

export type KpiMetricKey = 'doors' | 'dms' | 'pitches' | 'transitions' | 'presentations' | 'fp';

interface KpiDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricKey: KpiMetricKey | null;
  metricLabel: string;
  totalValue: number;
  sparklineData?: number[];
  sparklineAvg?: number;
  userIds: string[];
  dateRange: { start: string; end: string };
  onClose?: () => void;
}

const METRIC_TO_COLUMN: Record<KpiMetricKey, string> = {
  doors: 'doors_knocked',
  dms: 'decision_makers',
  pitches: 'pitches',
  transitions: 'transitions',
  presentations: 'presentations',
  fp: 'fp_plus',
};

const METRIC_LABELS: Record<KpiMetricKey, string> = {
  doors: 'Doors',
  dms: 'Decision Makers',
  pitches: 'Pitches',
  transitions: 'Transitions',
  presentations: 'Presentations',
  fp: 'FP+',
};

interface RepContribution {
  userId: string;
  name: string;
  photoUrl?: string | null;
  value: number;
}

const formatValue = (key: KpiMetricKey, value: number): string => {
  if (key === 'fp') return value.toFixed(1);
  return Math.round(value).toLocaleString();
};

export const KpiDetailDrawer = ({
  open, onOpenChange, metricKey, metricLabel, totalValue,
  sparklineData, sparklineAvg, userIds, dateRange, onClose,
}: KpiDetailDrawerProps) => {
  const column = metricKey ? METRIC_TO_COLUMN[metricKey] : null;

  const { data: contributions, isLoading } = useQuery({
    queryKey: ['kpi-rep-breakdown', metricKey, dateRange?.start, dateRange?.end, userIds],
    queryFn: async () => {
      if (!column || userIds.length === 0) return [];

      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select(`user_id, ${column}`)
        .in('user_id', userIds)
        .gte('entry_date', dateRange.start)
        .lte('entry_date', dateRange.end);

      if (error) throw error;

      const totals = new Map<string, number>();
      (entries || []).forEach((e: any) => {
        const val = Number(e[column]) || 0;
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
    enabled: open && !!column && userIds.length > 0,
    staleTime: 60000,
  });

  const total = useMemo(() =>
    (contributions || []).reduce((s, c) => s + c.value, 0),
    [contributions]
  );

  if (!metricKey) return null;

  const handleOpenChange = (o: boolean) => {
    onOpenChange(o);
    if (!o) onClose?.();
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{metricLabel || METRIC_LABELS[metricKey]}</DrawerTitle>
          <DrawerDescription>Rep contributions for this period</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Big sparkline */}
          {sparklineData && sparklineData.length >= 2 && (
            <div className="bg-card rounded-xl border border-border/50 p-4">
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-bold text-foreground">
                  {formatValue(metricKey, totalValue)}
                </span>
                <span className="text-sm text-muted-foreground">{metricLabel}</span>
              </div>
              <MicroSparkline
                data={sparklineData}
                width={300}
                height={60}
                goldLine={sparklineAvg}
              />
            </div>
          )}

          {/* Rep breakdown */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : !contributions || contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No breakdown available
            </p>
          ) : (
            <div className="space-y-1.5">
              {contributions.map((rep, idx) => {
                const pct = total > 0 ? (rep.value / total) * 100 : 0;
                return (
                  <div
                    key={rep.userId}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/50"
                  >
                    <span className={cn(
                      "w-5 text-center text-xs font-bold",
                      idx === 0 ? "text-amber-500" : idx === 1 ? "text-muted-foreground" : "text-muted-foreground/60"
                    )}>
                      {idx + 1}
                    </span>

                    <ProfileAvatar
                      userId={rep.userId}
                      name={rep.name}
                      photoUrl={rep.photoUrl}
                      className="h-8 w-8"
                      fallbackClassName="text-[10px] bg-muted"
                      onBeforeNavigate={() => handleOpenChange(false)}
                    />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{rep.name}</p>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "text-sm font-bold",
                        idx === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                      )}>
                        {formatValue(metricKey, rep.value)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {pct.toFixed(0)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
