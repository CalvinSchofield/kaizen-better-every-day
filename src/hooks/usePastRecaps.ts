import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, format, eachWeekOfInterval, eachMonthOfInterval, parseISO } from 'date-fns';

export interface PastRecap {
  id: string;
  period_type: 'week' | 'month' | 'blitz';
  period_start: string;
  period_end: string;
  period_label: string | null;
  days_worked: number;
  total_fp: number;
  total_prmr: number;
  stats_json: any;
  viewed_at: string;
  created_at: string;
}

interface AvailablePeriod {
  period_type: 'week' | 'month';
  period_start: Date;
  period_end: Date;
  period_label: string;
  days_worked: number;
  total_fp: number;
  total_prmr: number;
  hasStoredRecap: boolean;
  storedRecap?: PastRecap;
}

// Minimum days required for each recap type
const MIN_DAYS = {
  week: 2,
  month: 1,
  blitz: 1,
};

export function usePastRecaps() {
  const queryClient = useQueryClient();

  // Fetch all stored recaps
  const { data: storedRecaps, isLoading: isLoadingStored } = useQuery({
    queryKey: ['past-recaps'],
    queryFn: async (): Promise<PastRecap[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('personal_recaps')
        .select('*')
        .eq('user_id', user.id)
        .order('period_start', { ascending: false });

      if (error) throw error;
      return (data || []) as PastRecap[];
    },
  });

  // Fetch available periods from daily_entries
  const { data: availablePeriods, isLoading: isLoadingPeriods } = useQuery({
    queryKey: ['available-recap-periods'],
    queryFn: async (): Promise<AvailablePeriod[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get all finalized entries
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus, prmr, work_start_time, work_end_time, doors_knocked')
        .eq('user_id', user.id)
        .eq('is_finalized', true)
        .order('entry_date', { ascending: true });

      if (error || !entries || entries.length === 0) return [];

      const now = new Date();
      const periods: AvailablePeriod[] = [];
      const storedRecapsMap = new Map(
        (storedRecaps || []).map(r => [`${r.period_type}-${r.period_start}`, r])
      );

      // Get the date range of all entries
      const firstEntryDate = parseISO(entries[0].entry_date);
      const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });

      // Generate all weeks from first entry to last week
      const weeks = eachWeekOfInterval(
        { start: firstEntryDate, end: lastWeekStart },
        { weekStartsOn: 0 }
      );

      for (const weekStart of weeks) {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
        const startStr = format(weekStart, 'yyyy-MM-dd');
        const endStr = format(weekEnd, 'yyyy-MM-dd');

        // Filter entries for this week
        const weekEntries = entries.filter(e => 
          e.entry_date >= startStr && e.entry_date <= endStr
        );

        // Count "work days" (had start/end time and at least 4 doors)
        const daysWorked = weekEntries.filter(e => 
          e.work_start_time && e.work_end_time && (e.doors_knocked || 0) >= 4
        ).length;

        if (daysWorked >= MIN_DAYS.week) {
          const totalFp = weekEntries.reduce((sum, e) => sum + (e.fp_plus || 0), 0);
          const totalPrmr = weekEntries.reduce((sum, e) => sum + (e.prmr || 0), 0);
          const storedRecap = storedRecapsMap.get(`week-${startStr}`);

          periods.push({
            period_type: 'week',
            period_start: weekStart,
            period_end: weekEnd,
            period_label: `Week of ${format(weekStart, 'MMM d')}`,
            days_worked: daysWorked,
            total_fp: totalFp,
            total_prmr: totalPrmr,
            hasStoredRecap: !!storedRecap,
            storedRecap,
          });
        }
      }

      // Generate all months from first entry to last month
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const months = eachMonthOfInterval({ start: firstEntryDate, end: lastMonthStart });

      for (const monthStart of months) {
        const monthEnd = endOfMonth(monthStart);
        const startStr = format(monthStart, 'yyyy-MM-dd');
        const endStr = format(monthEnd, 'yyyy-MM-dd');

        // Filter entries for this month
        const monthEntries = entries.filter(e => 
          e.entry_date >= startStr && e.entry_date <= endStr
        );

        const daysWorked = monthEntries.filter(e => 
          e.work_start_time && e.work_end_time && (e.doors_knocked || 0) >= 4
        ).length;

        if (daysWorked >= MIN_DAYS.month) {
          const totalFp = monthEntries.reduce((sum, e) => sum + (e.fp_plus || 0), 0);
          const totalPrmr = monthEntries.reduce((sum, e) => sum + (e.prmr || 0), 0);
          const storedRecap = storedRecapsMap.get(`month-${startStr}`);

          periods.push({
            period_type: 'month',
            period_start: monthStart,
            period_end: monthEnd,
            period_label: format(monthStart, 'MMMM yyyy'),
            days_worked: daysWorked,
            total_fp: totalFp,
            total_prmr: totalPrmr,
            hasStoredRecap: !!storedRecap,
            storedRecap,
          });
        }
      }

      // Sort by start date descending
      periods.sort((a, b) => b.period_start.getTime() - a.period_start.getTime());

      return periods;
    },
    enabled: !isLoadingStored,
  });

  // Save a recap to the database
  const saveRecapMutation = useMutation({
    mutationFn: async (params: {
      period_type: 'week' | 'month' | 'blitz';
      period_start: string;
      period_end: string;
      period_label: string;
      days_worked: number;
      total_fp: number;
      total_prmr: number;
      stats_json: any;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('personal_recaps')
        .upsert({
          user_id: user.id,
          ...params,
          viewed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,period_type,period_start',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['past-recaps'] });
      queryClient.invalidateQueries({ queryKey: ['available-recap-periods'] });
    },
  });

  // Get weekly recaps only
  const weeklyRecaps = (availablePeriods || []).filter(p => p.period_type === 'week');
  
  // Get monthly recaps only
  const monthlyRecaps = (availablePeriods || []).filter(p => p.period_type === 'month');

  return {
    availablePeriods,
    weeklyRecaps,
    monthlyRecaps,
    storedRecaps,
    saveRecap: saveRecapMutation.mutateAsync,
    isLoading: isLoadingStored || isLoadingPeriods,
  };
}
