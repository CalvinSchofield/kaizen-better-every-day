import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { startOfWeek, format } from 'date-fns';

export interface ClassRecordHolder {
  userId: string;
  name: string;
  value: number;
  date: string;
}

export interface ClassRecordSet {
  day: ClassRecordHolder | null;
  week: ClassRecordHolder | null;
  month: ClassRecordHolder | null;
}

export interface ClassRecordsData {
  Rookie: ClassRecordSet;
  Sophomore: ClassRecordSet;
  Vet: ClassRecordSet;
}

export const useClassRecords = () => {
  // Fetch all finalized entries
  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['class-records-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, fp_plus')
        .eq('is_finalized', true)
        .order('entry_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch all reps with user_id
  const { data: repsData, isLoading: repsLoading } = useQuery({
    queryKey: ['class-records-reps'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reps')
        .select('user_id, name, year')
        .not('user_id', 'is', null);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const classRecords = useMemo<ClassRecordsData>(() => {
    const emptySet = (): ClassRecordSet => ({ day: null, week: null, month: null });
    
    if (!entriesData?.length || !repsData?.length) {
      return { Rookie: emptySet(), Sophomore: emptySet(), Vet: emptySet() };
    }

    const repsMap = new Map(repsData.map(r => [r.user_id, r]));
    
    // Track bests per user
    const userDayBests = new Map<string, { value: number; date: string }>();
    const userWeekTotals = new Map<string, Map<string, number>>();
    const userMonthTotals = new Map<string, Map<string, number>>();

    entriesData.forEach(entry => {
      const userId = entry.user_id;
      const fpPlus = Number(entry.fp_plus) || 0;
      if (fpPlus <= 0) return;
      
      const entryDate = new Date(entry.entry_date + 'T12:00:00');
      
      // Day
      const currentDayBest = userDayBests.get(userId);
      if (!currentDayBest || fpPlus > currentDayBest.value) {
        userDayBests.set(userId, { value: fpPlus, date: entry.entry_date });
      }
      
      // Week
      const weekKey = format(startOfWeek(entryDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      if (!userWeekTotals.has(userId)) userWeekTotals.set(userId, new Map());
      const userWeeks = userWeekTotals.get(userId)!;
      userWeeks.set(weekKey, (userWeeks.get(weekKey) || 0) + fpPlus);
      
      // Month
      const monthKey = format(entryDate, 'yyyy-MM');
      if (!userMonthTotals.has(userId)) userMonthTotals.set(userId, new Map());
      const userMonths = userMonthTotals.get(userId)!;
      userMonths.set(monthKey, (userMonths.get(monthKey) || 0) + fpPlus);
    });

    // Get best week and month per user
    const userWeekBests = new Map<string, { value: number; date: string }>();
    const userMonthBests = new Map<string, { value: number; date: string }>();

    userWeekTotals.forEach((weeks, userId) => {
      let best = { value: 0, date: '' };
      weeks.forEach((total, weekKey) => {
        if (total > best.value) best = { value: total, date: weekKey };
      });
      if (best.value > 0) userWeekBests.set(userId, best);
    });

    userMonthTotals.forEach((months, userId) => {
      let best = { value: 0, date: '' };
      months.forEach((total, monthKey) => {
        if (total > best.value) best = { value: total, date: monthKey };
      });
      if (best.value > 0) userMonthBests.set(userId, best);
    });

    // Build class records
    const records: ClassRecordsData = {
      Rookie: emptySet(),
      Sophomore: emptySet(),
      Vet: emptySet(),
    };

    repsData.forEach(rep => {
      if (!rep.user_id) return;
      const year = rep.year as keyof ClassRecordsData;
      if (year !== 'Rookie' && year !== 'Sophomore' && year !== 'Vet') return;

      // Strip emojis from name - use comprehensive regex that catches all emoji types
      const cleanName = rep.name
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '')
        .trim() || rep.name.charAt(0) || 'Unknown';

      const dayBest = userDayBests.get(rep.user_id);
      const weekBest = userWeekBests.get(rep.user_id);
      const monthBest = userMonthBests.get(rep.user_id);

      if (dayBest && (!records[year].day || dayBest.value > records[year].day!.value)) {
        records[year].day = { userId: rep.user_id, name: cleanName, value: dayBest.value, date: dayBest.date };
      }
      if (weekBest && (!records[year].week || weekBest.value > records[year].week!.value)) {
        records[year].week = { userId: rep.user_id, name: cleanName, value: weekBest.value, date: weekBest.date };
      }
      if (monthBest && (!records[year].month || monthBest.value > records[year].month!.value)) {
        records[year].month = { userId: rep.user_id, name: cleanName, value: monthBest.value, date: monthBest.date };
      }
    });

    return records;
  }, [entriesData, repsData]);

  return {
    classRecords,
    isLoading: entriesLoading || repsLoading,
  };
};
