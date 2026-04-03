import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, differenceInDays, getDay, parseISO,
  eachWeekOfInterval, eachMonthOfInterval, addDays,
} from "date-fns";

export interface ComparisonTotals {
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  prmr: number;
  hoursWorked: number;
}

export interface SparklinePoint {
  label: string;
  doors: number;
  dms: number;
  pitches: number;
  presentations: number;
  closes: number;
  fp: number;
  prmr: number;
}

export interface ComparisonResult {
  comparisonTotals: ComparisonTotals | null;
  sparklineHistory: SparklinePoint[];
  comparisonLabel: string;
  isLoading: boolean;
}

type Preset = 'today' | 'yesterday' | 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'preseason' | 'ytd' | 'custom';

/**
 * Calculate the comparison date range for a given preset.
 */
function getComparisonRange(
  preset: Preset,
  dateRange: { start: string; end: string },
): { start: string; end: string; label: string } | null {
  const today = new Date();

  switch (preset) {
    case 'today': {
      // Same weekday last week
      const d = subWeeks(today, 1);
      const s = format(d, 'yyyy-MM-dd');
      return { start: s, end: s, label: 'vs same day last week' };
    }
    case 'yesterday': {
      const yest = subDays(today, 1);
      const sameLastWeek = subWeeks(yest, 1);
      const s = format(sameLastWeek, 'yyyy-MM-dd');
      return { start: s, end: s, label: 'vs same day prior week' };
    }
    case 'week': {
      const prevWeekStart = startOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
      const prevWeekEnd = endOfWeek(subWeeks(today, 1), { weekStartsOn: 0 });
      return { start: format(prevWeekStart, 'yyyy-MM-dd'), end: format(prevWeekEnd, 'yyyy-MM-dd'), label: 'vs last week' };
    }
    case 'lastWeek': {
      const twoWeeksAgo = subWeeks(today, 2);
      const s = startOfWeek(twoWeeksAgo, { weekStartsOn: 0 });
      const e = endOfWeek(twoWeeksAgo, { weekStartsOn: 0 });
      return { start: format(s, 'yyyy-MM-dd'), end: format(e, 'yyyy-MM-dd'), label: 'vs week before' };
    }
    case 'month': {
      const prevMonth = subMonths(today, 1);
      return { start: format(startOfMonth(prevMonth), 'yyyy-MM-dd'), end: format(endOfMonth(prevMonth), 'yyyy-MM-dd'), label: 'vs last month' };
    }
    case 'lastMonth': {
      const twoMonthsAgo = subMonths(today, 2);
      return { start: format(startOfMonth(twoMonthsAgo), 'yyyy-MM-dd'), end: format(endOfMonth(twoMonthsAgo), 'yyyy-MM-dd'), label: 'vs month before' };
    }
    case 'custom': {
      const rangeStart = parseISO(dateRange.start);
      const rangeEnd = parseISO(dateRange.end);
      const length = differenceInDays(rangeEnd, rangeStart) + 1;
      const compEnd = subDays(rangeStart, 1);
      const compStart = subDays(compEnd, length - 1);
      return { start: format(compStart, 'yyyy-MM-dd'), end: format(compEnd, 'yyyy-MM-dd'), label: 'vs prior period' };
    }
    default:
      return null; // preseason, ytd — no comparison
  }
}

/**
 * Compute the sparkline history date ranges.
 * Returns an array of { start, end, label } for each sparkline point.
 */
function getSparklineRanges(
  preset: Preset,
  dateRange: { start: string; end: string },
): Array<{ start: string; end: string; label: string }> {
  const today = new Date();

  switch (preset) {
    case 'today':
    case 'yesterday': {
      // Last 7 same-weekdays
      const refDate = preset === 'today' ? today : subDays(today, 1);
      const ranges: Array<{ start: string; end: string; label: string }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = subWeeks(refDate, i);
        const s = format(d, 'yyyy-MM-dd');
        ranges.push({ start: s, end: s, label: format(d, 'M/d') });
      }
      return ranges;
    }
    case 'week':
    case 'lastWeek': {
      // Last 8 weeks
      const refWeek = preset === 'week' ? today : subWeeks(today, 1);
      const ranges: Array<{ start: string; end: string; label: string }> = [];
      for (let i = 7; i >= 0; i--) {
        const ws = startOfWeek(subWeeks(refWeek, i), { weekStartsOn: 0 });
        const we = endOfWeek(subWeeks(refWeek, i), { weekStartsOn: 0 });
        ranges.push({ start: format(ws, 'yyyy-MM-dd'), end: format(we, 'yyyy-MM-dd'), label: format(ws, 'M/d') });
      }
      return ranges;
    }
    case 'month':
    case 'lastMonth': {
      // Last 6 months
      const refMonth = preset === 'month' ? today : subMonths(today, 1);
      const ranges: Array<{ start: string; end: string; label: string }> = [];
      for (let i = 5; i >= 0; i--) {
        const m = subMonths(refMonth, i);
        const ms = startOfMonth(m);
        const me = endOfMonth(m);
        ranges.push({ start: format(ms, 'yyyy-MM-dd'), end: format(me, 'yyyy-MM-dd'), label: format(ms, 'MMM') });
      }
      return ranges;
    }
    default:
      return [];
  }
}

/**
 * Hook that provides comparison period data and sparkline history.
 */
export function useReportsV2Comparison({
  userIds,
  dateRange,
  preset,
}: {
  userIds: string[];
  dateRange: { start: string; end: string };
  preset: string;
}): ComparisonResult {
  const typedPreset = preset as Preset;
  const compRange = useMemo(() => getComparisonRange(typedPreset, dateRange), [typedPreset, dateRange]);
  const sparkRanges = useMemo(() => getSparklineRanges(typedPreset, dateRange), [typedPreset, dateRange]);

  // Compute the full fetch range (min of all sparkline ranges + comparison range)
  const fetchRange = useMemo(() => {
    const allStarts: string[] = [];
    const allEnds: string[] = [];
    if (compRange) {
      allStarts.push(compRange.start);
      allEnds.push(compRange.end);
    }
    sparkRanges.forEach(r => {
      allStarts.push(r.start);
      allEnds.push(r.end);
    });
    if (allStarts.length === 0) return null;
    allStarts.sort();
    allEnds.sort();
    return { start: allStarts[0], end: allEnds[allEnds.length - 1] };
  }, [compRange, sparkRanges]);

  const enabled = userIds.length > 0 && fetchRange !== null;

  const query = useQuery({
    queryKey: ['reports-v2-comparison', userIds, fetchRange?.start, fetchRange?.end],
    queryFn: async () => {
      if (!fetchRange) return [];
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, work_start_time, work_end_time, break_periods')
        .in('user_id', userIds)
        .gte('entry_date', fetchRange.start)
        .lte('entry_date', fetchRange.end);
      if (error) throw error;
      return data || [];
    },
    enabled,
    staleTime: 2 * 60 * 1000,
  });

  const result = useMemo((): Omit<ComparisonResult, 'isLoading'> => {
    const entries = query.data || [];

    // Helper: aggregate entries within a date range
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
      };
    };

    const comparisonTotals = compRange ? aggregate(compRange.start, compRange.end) : null;

    const sparklineHistory: SparklinePoint[] = sparkRanges.map(r => {
      const agg = aggregate(r.start, r.end);
      return { label: r.label, ...agg };
    });

    return {
      comparisonTotals,
      sparklineHistory,
      comparisonLabel: compRange?.label || '',
    };
  }, [query.data, compRange, sparkRanges]);

  return {
    ...result,
    isLoading: query.isLoading && enabled,
  };
}
