import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription,
} from "@/components/ui/drawer";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ActiveRecord, GRANULARITY_LABELS, minutesToTimeStr } from "@/utils/teamRecordDetection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RecordRepBreakdownDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: ActiveRecord | null;
  userIds: string[];
  dateRange?: { start: string; end: string };
}

interface RepContribution {
  userId: string;
  name: string;
  photoUrl?: string | null;
  value: number;
}

// Map metricKey to the daily_entries column
const METRIC_TO_COLUMN: Record<string, string> = {
  doors: 'doors_knocked',
  dms: 'decision_makers',
  pitches: 'pitches',
  presentations: 'presentations',
  closes: 'closes',
  fp: 'fp_plus',
  prmr: 'prmr',
};

export const RecordRepBreakdownDrawer = ({
  open, onOpenChange, record, userIds, dateRange,
}: RecordRepBreakdownDrawerProps) => {
  const metricKey = record?.metricKey;
  const column = metricKey ? METRIC_TO_COLUMN[metricKey] : null;

  // Fetch rep contributions for this metric in the current date range
  const { data: contributions, isLoading } = useQuery({
    queryKey: ['record-rep-breakdown', metricKey, dateRange?.start, dateRange?.end, userIds],
    queryFn: async () => {
      if (!column || !dateRange || userIds.length === 0) return [];

      // Fetch entries
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select(`user_id, ${column}`)
        .in('user_id', userIds)
        .gte('entry_date', dateRange.start)
        .lte('entry_date', dateRange.end);

      if (error) throw error;

      // Aggregate by user
      const totals = new Map<string, number>();
      (entries || []).forEach((e: any) => {
        const val = Number(e[column]) || 0;
        totals.set(e.user_id, (totals.get(e.user_id) || 0) + val);
      });

      // Fetch rep info
      const activeUserIds = [...totals.keys()].filter(id => (totals.get(id) || 0) > 0);
      if (activeUserIds.length === 0) return [];

      const { data: reps } = await supabase
        .from('reps')
        .select('user_id, name, photo_url')
        .in('user_id', activeUserIds);

      const repsMap = new Map((reps || []).map(r => [r.user_id, r]));

      const result: RepContribution[] = activeUserIds.map(id => ({
        userId: id,
        name: repsMap.get(id)?.name || 'Unknown',
        photoUrl: repsMap.get(id)?.photo_url,
        value: totals.get(id) || 0,
      }));

      // Sort by value desc
      result.sort((a, b) => b.value - a.value);
      return result;
    },
    enabled: open && !!column && !!dateRange && userIds.length > 0,
    staleTime: 60000,
  });

  const formatValue = (key: string, value: number): string => {
    if (key === 'avgStartMinutes') return minutesToTimeStr(value);
    if (key === 'activeHours') return `${value.toFixed(1)}h`;
    if (key === 'fp') return value.toFixed(1);
    if (key === 'prmr') return `$${Math.round(value).toLocaleString()}`;
    return Math.round(value).toLocaleString();
  };

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : name.substring(0, 2).toUpperCase();
  };

  const total = useMemo(() =>
    (contributions || []).reduce((s, c) => s + c.value, 0),
    [contributions]
  );

  if (!record) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            {record.contextualLabel || record.label}
          </DrawerTitle>
          <DrawerDescription>
            Rep contributions to this record
          </DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-3 overflow-y-auto max-h-[60vh]">
          {/* Summary */}
          <div className="flex items-baseline gap-2 px-1">
            <span className="text-2xl font-bold text-foreground">
              {formatValue(record.metricKey, record.currentValue)}
            </span>
            <span className="text-sm text-muted-foreground">total {record.label}</span>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => (
                <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
              ))}
            </div>
          ) : !contributions || contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No breakdown available for this metric
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
                    {/* Rank */}
                    <span className={cn(
                      "w-5 text-center text-xs font-bold",
                      idx === 0 ? "text-amber-500" : idx === 1 ? "text-muted-foreground" : "text-muted-foreground/60"
                    )}>
                      {idx + 1}
                    </span>

                    {/* Avatar */}
                    <Avatar className="h-8 w-8">
                      {rep.photoUrl && <AvatarImage src={rep.photoUrl} alt={rep.name} />}
                      <AvatarFallback className="text-[10px] bg-muted">
                        {getInitials(rep.name)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Name */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{rep.name}</p>
                    </div>

                    {/* Value + percentage */}
                    <div className="text-right flex-shrink-0">
                      <p className={cn(
                        "text-sm font-bold",
                        idx === 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
                      )}>
                        {formatValue(record.metricKey, rep.value)}
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
