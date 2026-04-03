import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, differenceInDays, parseISO,
} from "date-fns";
import type { ComparisonTotals, SparklinePoint } from "@/hooks/useReportsV2Comparison";

type Preset = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'ytd' | 'custom';

function getComparisonRange(
  preset: Preset,
  dateRange: { start: string; end: string },
): { start: string; end: string; label: string } | null {
  const today = new Date();
  switch (preset) {
    case 'today': {
      const d = subWeeks(today, 1);
      const s = format(d, 'yyyy-MM-dd');
      return { start: s, end: s, label: 'vs same day last week' };
    }
    case 'yesterday': {
      const sameLastWeek = subWeeks(subDays(today, 1), 1);
      const s = format(sameLastWeek, 'yyyy-MM-dd');
      return { start: s, end: s, label: 'vs same day prior week' };
    }
    case 'week': {
      const prev = subWeeks(today, 1);
      return { start: format(startOfWeek(prev, { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(prev, { weekStartsOn: 0 }), 'yyyy-MM-dd'), label: 'vs last week' };
    }
    case 'lastWeek': {
      const tw = subWeeks(today, 2);
      return { start: format(startOfWeek(tw, { weekStartsOn: 0 }), 'yyyy-MM-dd'), end: format(endOfWeek(tw, { weekStartsOn: 0 }), 'yyyy-MM-dd'), label: 'vs week before' };
    }
    case 'month': {
      const pm = subMonths(today, 1);
      return { start: format(startOfMonth(pm), 'yyyy-MM-dd'), end: format(endOfMonth(pm), 'yyyy-MM-dd'), label: 'vs last month' };
    }
    case 'lastMonth': {
      const tm = subMonths(today, 2);
      return { start: format(startOfMonth(tm), 'yyyy-MM-dd'), end: format(endOfMonth(tm), 'yyyy-MM-dd'), label: 'vs month before' };
    }
    case 'custom': {
      const rangeStart = parseISO(dateRange.start);
      const rangeEnd = parseISO(dateRange.end);
      const length = differenceInDays(rangeEnd, rangeStart) + 1;
      const compEnd = subDays(rangeStart, 1);
      const compStart = subDays(compEnd, length - 1);
      const fmtS = format(compStart, 'MMM d');
      const fmtE = format(compEnd, 'MMM d');
      return { start: format(compStart, 'yyyy-MM-dd'), end: format(compEnd, 'yyyy-MM-dd'), label: fmtS === fmtE ? `vs ${fmtS}` : `vs ${fmtS} – ${fmtE}` };
    }
    default:
      return null;
  }
}

function getSparklineRanges(
  preset: Preset,
  dateRange: { start: string; end: string },
): Array<{ start: string; end: string; label: string }> {
  const today = new Date();
  switch (preset) {
    case 'today':
    case 'yesterday': {
      const ref = preset === 'today' ? today : subDays(today, 1);
      const ranges: Array<{ start: string; end: string; label: string }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = subWeeks(ref, i);
        const s = format(d, 'yyyy-MM-dd');
        ranges.push({ start: s, end: s, label: format(d, 'M/d') });
      }
      return ranges;
    }
    case 'week':
    case 'lastWeek': {
      const ref = preset === 'week' ? today : subWeeks(today, 1);
      const ranges: Array<{ start: string; end: string; label: string }> = [];
      for (let i = 7; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(ref, i), { weekStartsOn: 0 });
        const we = endOfWeek(subWeeks(ref, i), { weekStartsOn: 0 });
        ranges.push({ start: format(ws, 'yyyy-MM-dd'), end: format(we, 'yyyy-MM-dd'), label: format(ws, 'M/d') });
      }
      return ranges;
    }
    case 'month':
    case 'lastMonth': {
      const ref = preset === 'month' ? today : subMonths(today, 1);
      const ranges: Array<{ start: string; end: string; label: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(ref, i);
        ranges.push({ start: format(startOfMonth(m), 'yyyy-MM-dd'), end: format(endOfMonth(m), 'yyyy-MM-dd'), label: format(startOfMonth(m), 'MMM') });
      }
      return ranges;
    }
    default:
      return [];
  }
}

export interface RepComparisonResult {
  currentTotals: ComparisonTotals;
  comparisonTotals: ComparisonTotals | null;
  sparklineHistory: SparklinePoint[];
  comparisonLabel: string;
  isLoading: boolean;
}

export function useRepComparison({
  userId,
  dateRange,
  preset,
}: {
  userId: string | undefined;
  dateRange: { start: string; end: string };
  preset: string;
}): RepComparisonResult {
  const typedPreset = preset as Preset;
  const compRange = useMemo(() => getComparisonRange(typedPreset, dateRange), [typedPreset, dateRange]);
  const sparkRanges = useMemo(() => getSparklineRanges(typedPreset, dateRange), [typedPreset, dateRange]);

  const fetchRange = useMemo(() => {
    const allStarts: string[] = [dateRange.start];
    const allEnds: string[] = [dateRange.end];
    if (compRange) { allStarts.push(compRange.start); allEnds.push(compRange.end); }
    sparkRanges.forEach(r => { allStarts.push(r.start); allEnds.push(r.end); });
    allStarts.sort();
    allEnds.sort();
    return { start: allStarts[0], end: allEnds[allEnds.length - 1] };
  }, [dateRange, compRange, sparkRanges]);

  const enabled = !!userId;

  const query = useQuery({
    queryKey: ['rep-comparison', userId, fetchRange.start, fetchRange.end],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, work_start_time, work_end_time, break_periods')
        .eq('user_id', userId)
        .gte('entry_date', fetchRange.start)
        .lte('entry_date', fetchRange.end);
      if (error) throw error;
      return data || [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const result = useMemo(() => {
    const entries = query.data || [];

    const aggregate = (start: string, end: string): ComparisonTotals => {
      const filtered = entries.filter(e => e.entry_date >= start && e.entry_date <= end);
      let hoursWorked = 0;
      filtered.forEach(e => {
        if (e.work_start_time && e.work_end_time) {
          const s = new Date(e.work_start_time).getTime();
          const en = new Date(e.work_end_time).getTime();
          let mins = (en - s) / 60000;
          if (e.break_periods && Array.isArray(e.break_periods)) {
            (e.break_periods as any[]).forEach((bp: any) => {
              const bMins = (new Date(bp.end).getTime() - new Date(bp.start).getTime()) / 60000;
              if (bMins > 0) mins -= bMins;
            });
          }
          hoursWorked += Math.max(0, mins) / 60;
        }
      });
      return {
        doors: filtered.reduce((s, e) => s + (e.doors_knocked || 0), 0),
        dms: filtered.reduce((s, e) => s + (e.decision_makers || 0), 0),
        pitches: filtered.reduce((s, e) => s + (e.pitches || 0), 0),
        transitions: filtered.reduce((s, e) => s + (e.transitions || 0), 0),
        presentations: filtered.reduce((s, e) => s + (e.presentations || 0), 0),
        closes: filtered.reduce((s, e) => s + (e.closes || 0), 0),
        fp: filtered.reduce((s, e) => s + (Number(e.fp_plus) || 0), 0),
        prmr: filtered.reduce((s, e) => s + (Number(e.prmr) || 0), 0),
        hoursWorked,
        daysWorked: filtered.length,
      };
    };

    const currentTotals = aggregate(dateRange.start, dateRange.end);
    const comparisonTotals = compRange ? aggregate(compRange.start, compRange.end) : null;
    const sparklineHistory: SparklinePoint[] = sparkRanges.map(r => {
      const agg = aggregate(r.start, r.end);
      return { label: r.label, ...agg };
    });

    return { currentTotals, comparisonTotals, sparklineHistory, comparisonLabel: compRange?.label || '' };
  }, [query.data, dateRange, compRange, sparkRanges]);

  return { ...result, isLoading: query.isLoading && enabled };
}
