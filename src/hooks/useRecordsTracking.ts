import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, format } from 'date-fns';

export interface RecordEntry {
  userId: string;
  name: string;
  year: string;
  value: number;
  date: string;
  period: 'day' | 'week' | 'month';
}

export interface RecordBreaker {
  userId: string;
  name: string;
  year: string;
  recordType: 'personal' | 'class';
  period: 'day' | 'week' | 'month';
  newValue: number;
  previousValue: number;
  date: string;
}

export interface ClassRecords {
  Rookie: { day: RecordEntry | null; week: RecordEntry | null; month: RecordEntry | null };
  Sophomore: { day: RecordEntry | null; week: RecordEntry | null; month: RecordEntry | null };
  Vet: { day: RecordEntry | null; week: RecordEntry | null; month: RecordEntry | null };
}

interface UseRecordsTrackingOptions {
  enabled?: boolean;
  accessibleUserIds?: string[];
}

export const useRecordsTracking = ({ enabled = true, accessibleUserIds }: UseRecordsTrackingOptions = {}) => {
  // Fetch all finalized entries for accessible users
  const { data: entriesData, isLoading: entriesLoading } = useQuery({
    queryKey: ['records-entries', accessibleUserIds],
    queryFn: async () => {
      if (!accessibleUserIds?.length) return [];
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, fp_plus, prmr, is_finalized')
        .in('user_id', accessibleUserIds)
        .eq('is_finalized', true)
        .order('entry_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!accessibleUserIds?.length,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch rep info (name, year) for accessible users
  const { data: repsData, isLoading: repsLoading } = useQuery({
    queryKey: ['records-reps', accessibleUserIds],
    queryFn: async () => {
      if (!accessibleUserIds?.length) return [];
      
      const { data, error } = await supabase
        .from('reps')
        .select('user_id, name, year')
        .in('user_id', accessibleUserIds);
      
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!accessibleUserIds?.length,
    staleTime: 10 * 60 * 1000,
  });

  // Calculate personal and class records
  const records = useMemo(() => {
    if (!entriesData?.length || !repsData?.length) {
      return {
        personalRecords: new Map<string, { day: RecordEntry | null; week: RecordEntry | null; month: RecordEntry | null }>(),
        classRecords: {
          Rookie: { day: null, week: null, month: null },
          Sophomore: { day: null, week: null, month: null },
          Vet: { day: null, week: null, month: null },
        } as ClassRecords,
      };
    }

    const repsMap = new Map(repsData.map(r => [r.user_id, r]));
    const personalRecords = new Map<string, { day: RecordEntry | null; week: RecordEntry | null; month: RecordEntry | null }>();
    const classRecords: ClassRecords = {
      Rookie: { day: null, week: null, month: null },
      Sophomore: { day: null, week: null, month: null },
      Vet: { day: null, week: null, month: null },
    };

    // Group entries by user, week, and month
    const userDayBests = new Map<string, { value: number; date: string }>();
    const userWeekTotals = new Map<string, Map<string, number>>(); // userId -> weekKey -> total
    const userMonthTotals = new Map<string, Map<string, number>>(); // userId -> monthKey -> total

    entriesData.forEach(entry => {
      const userId = entry.user_id;
      const fpPlus = Number(entry.fp_plus) || 0;
      const entryDate = new Date(entry.entry_date + 'T12:00:00');
      
      // Day record
      const currentDayBest = userDayBests.get(userId);
      if (!currentDayBest || fpPlus > currentDayBest.value) {
        userDayBests.set(userId, { value: fpPlus, date: entry.entry_date });
      }
      
      // Week totals (Sunday start)
      const weekStart = startOfWeek(entryDate, { weekStartsOn: 0 });
      const weekKey = format(weekStart, 'yyyy-MM-dd');
      if (!userWeekTotals.has(userId)) {
        userWeekTotals.set(userId, new Map());
      }
      const userWeeks = userWeekTotals.get(userId)!;
      userWeeks.set(weekKey, (userWeeks.get(weekKey) || 0) + fpPlus);
      
      // Month totals
      const monthKey = format(entryDate, 'yyyy-MM');
      if (!userMonthTotals.has(userId)) {
        userMonthTotals.set(userId, new Map());
      }
      const userMonths = userMonthTotals.get(userId)!;
      userMonths.set(monthKey, (userMonths.get(monthKey) || 0) + fpPlus);
    });

    // Calculate best week and month for each user
    const userWeekBests = new Map<string, { value: number; date: string }>();
    const userMonthBests = new Map<string, { value: number; date: string }>();

    userWeekTotals.forEach((weeks, userId) => {
      let best = { value: 0, date: '' };
      weeks.forEach((total, weekKey) => {
        if (total > best.value) {
          best = { value: total, date: weekKey };
        }
      });
      if (best.value > 0) userWeekBests.set(userId, best);
    });

    userMonthTotals.forEach((months, userId) => {
      let best = { value: 0, date: '' };
      months.forEach((total, monthKey) => {
        if (total > best.value) {
          best = { value: total, date: monthKey };
        }
      });
      if (best.value > 0) userMonthBests.set(userId, best);
    });

    // Build personal records and class records
    repsData.forEach(rep => {
      const userId = rep.user_id;
      const year = rep.year || 'Rookie';
      const name = rep.name;

      const dayBest = userDayBests.get(userId);
      const weekBest = userWeekBests.get(userId);
      const monthBest = userMonthBests.get(userId);

      const personal = {
        day: dayBest ? { userId, name, year, value: dayBest.value, date: dayBest.date, period: 'day' as const } : null,
        week: weekBest ? { userId, name, year, value: weekBest.value, date: weekBest.date, period: 'week' as const } : null,
        month: monthBest ? { userId, name, year, value: monthBest.value, date: monthBest.date, period: 'month' as const } : null,
      };
      personalRecords.set(userId, personal);

      // Update class records
      if (year === 'Rookie' || year === 'Sophomore' || year === 'Vet') {
        const classYear = year as keyof ClassRecords;
        
        if (dayBest && (!classRecords[classYear].day || dayBest.value > classRecords[classYear].day!.value)) {
          classRecords[classYear].day = { userId, name, year, value: dayBest.value, date: dayBest.date, period: 'day' };
        }
        if (weekBest && (!classRecords[classYear].week || weekBest.value > classRecords[classYear].week!.value)) {
          classRecords[classYear].week = { userId, name, year, value: weekBest.value, date: weekBest.date, period: 'week' };
        }
        if (monthBest && (!classRecords[classYear].month || monthBest.value > classRecords[classYear].month!.value)) {
          classRecords[classYear].month = { userId, name, year, value: monthBest.value, date: monthBest.date, period: 'month' };
        }
      }
    });

    return { personalRecords, classRecords };
  }, [entriesData, repsData]);

  // Detect record breakers for current period
  const recordBreakers = useMemo(() => {
    if (!entriesData?.length || !repsData?.length) return [];

    const breakers: RecordBreaker[] = [];
    const repsMap = new Map(repsData.map(r => [r.user_id, r]));
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const currentWeekStart = format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd');
    const currentMonthKey = format(today, 'yyyy-MM');

    // Calculate current period totals
    const currentDayTotals = new Map<string, number>();
    const currentWeekTotals = new Map<string, number>();
    const currentMonthTotals = new Map<string, number>();

    entriesData.forEach(entry => {
      const userId = entry.user_id;
      const fpPlus = Number(entry.fp_plus) || 0;
      const entryDate = entry.entry_date;
      const entryDateObj = new Date(entryDate + 'T12:00:00');
      const entryWeekStart = format(startOfWeek(entryDateObj, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const entryMonthKey = format(entryDateObj, 'yyyy-MM');

      // Today's entries
      if (entryDate === todayStr) {
        currentDayTotals.set(userId, (currentDayTotals.get(userId) || 0) + fpPlus);
      }
      // Current week entries
      if (entryWeekStart === currentWeekStart) {
        currentWeekTotals.set(userId, (currentWeekTotals.get(userId) || 0) + fpPlus);
      }
      // Current month entries
      if (entryMonthKey === currentMonthKey) {
        currentMonthTotals.set(userId, (currentMonthTotals.get(userId) || 0) + fpPlus);
      }
    });

    // Check for personal record breakers
    records.personalRecords.forEach((personal, userId) => {
      const rep = repsMap.get(userId);
      if (!rep) return;

      const currentDay = currentDayTotals.get(userId) || 0;
      const currentWeek = currentWeekTotals.get(userId) || 0;
      const currentMonth = currentMonthTotals.get(userId) || 0;

      // Day record (only if today has data)
      if (currentDay > 0 && personal.day && currentDay > personal.day.value) {
        breakers.push({
          userId,
          name: rep.name,
          year: rep.year || 'Rookie',
          recordType: 'personal',
          period: 'day',
          newValue: currentDay,
          previousValue: personal.day.value,
          date: todayStr,
        });
      }

      // Week record
      if (currentWeek > 0 && personal.week && currentWeek > personal.week.value) {
        breakers.push({
          userId,
          name: rep.name,
          year: rep.year || 'Rookie',
          recordType: 'personal',
          period: 'week',
          newValue: currentWeek,
          previousValue: personal.week.value,
          date: currentWeekStart,
        });
      }

      // Month record
      if (currentMonth > 0 && personal.month && currentMonth > personal.month.value) {
        breakers.push({
          userId,
          name: rep.name,
          year: rep.year || 'Rookie',
          recordType: 'personal',
          period: 'month',
          newValue: currentMonth,
          previousValue: personal.month.value,
          date: currentMonthKey,
        });
      }
    });

    // Check for class record breakers
    (['Rookie', 'Sophomore', 'Vet'] as const).forEach(classYear => {
      const classRecord = records.classRecords[classYear];
      
      repsData.filter(r => r.year === classYear).forEach(rep => {
        const currentDay = currentDayTotals.get(rep.user_id) || 0;
        const currentWeek = currentWeekTotals.get(rep.user_id) || 0;
        const currentMonth = currentMonthTotals.get(rep.user_id) || 0;

        if (currentDay > 0 && classRecord.day && currentDay > classRecord.day.value && rep.user_id !== classRecord.day.userId) {
          breakers.push({
            userId: rep.user_id,
            name: rep.name,
            year: classYear,
            recordType: 'class',
            period: 'day',
            newValue: currentDay,
            previousValue: classRecord.day.value,
            date: todayStr,
          });
        }

        if (currentWeek > 0 && classRecord.week && currentWeek > classRecord.week.value && rep.user_id !== classRecord.week.userId) {
          breakers.push({
            userId: rep.user_id,
            name: rep.name,
            year: classYear,
            recordType: 'class',
            period: 'week',
            newValue: currentWeek,
            previousValue: classRecord.week.value,
            date: currentWeekStart,
          });
        }

        if (currentMonth > 0 && classRecord.month && currentMonth > classRecord.month.value && rep.user_id !== classRecord.month.userId) {
          breakers.push({
            userId: rep.user_id,
            name: rep.name,
            year: classYear,
            recordType: 'class',
            period: 'month',
            newValue: currentMonth,
            previousValue: classRecord.month.value,
            date: currentMonthKey,
          });
        }
      });
    });

    return breakers;
  }, [entriesData, repsData, records]);

  return {
    personalRecords: records.personalRecords,
    classRecords: records.classRecords,
    recordBreakers,
    isLoading: entriesLoading || repsLoading,
  };
};

// Helper to get a user's personal records
export const usePersonalRecords = (userId?: string) => {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['personal-records', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, fp_plus')
        .eq('user_id', userId)
        .eq('is_finalized', true)
        .order('entry_date', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(() => {
    if (!entries?.length) return { dayRecord: 0, weekRecord: 0, monthRecord: 0, isLoading };

    let dayRecord = 0;
    const weekTotals = new Map<string, number>();
    const monthTotals = new Map<string, number>();

    entries.forEach(entry => {
      const fpPlus = Number(entry.fp_plus) || 0;
      const entryDate = new Date(entry.entry_date + 'T12:00:00');
      
      if (fpPlus > dayRecord) dayRecord = fpPlus;
      
      const weekKey = format(startOfWeek(entryDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      weekTotals.set(weekKey, (weekTotals.get(weekKey) || 0) + fpPlus);
      
      const monthKey = format(entryDate, 'yyyy-MM');
      monthTotals.set(monthKey, (monthTotals.get(monthKey) || 0) + fpPlus);
    });

    let weekRecord = 0;
    weekTotals.forEach(total => { if (total > weekRecord) weekRecord = total; });

    let monthRecord = 0;
    monthTotals.forEach(total => { if (total > monthRecord) monthRecord = total; });

    return { dayRecord, weekRecord, monthRecord, isLoading };
  }, [entries, isLoading]);
};
