import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useMemo } from 'react';
import { startOfWeek, format } from 'date-fns';
import { calculateFromSalesLog } from '@/utils/salesLogCalculations';

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
        .select('user_id, entry_date, fp_plus, prmr, sales_log')
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

  const { classRecords, prmrClassRecords } = useMemo(() => {
    const emptySet = (): ClassRecordSet => ({ day: null, week: null, month: null });
    
    if (!entriesData?.length || !repsData?.length) {
      return {
        classRecords: { Rookie: emptySet(), Sophomore: emptySet(), Vet: emptySet() } as ClassRecordsData,
        prmrClassRecords: { Rookie: emptySet(), Sophomore: emptySet(), Vet: emptySet() } as ClassRecordsData,
      };
    }

    const repsMap = new Map(repsData.map(r => [r.user_id, r]));
    
    // Track bests per user for FP+ and PRMR
    const userDayBests = new Map<string, { value: number; date: string }>();
    const userWeekTotals = new Map<string, Map<string, number>>();
    const userMonthTotals = new Map<string, Map<string, number>>();
    const prmrUserDayBests = new Map<string, { value: number; date: string }>();
    const prmrUserWeekTotals = new Map<string, Map<string, number>>();
    const prmrUserMonthTotals = new Map<string, Map<string, number>>();

    entriesData.forEach(entry => {
      const userId = entry.user_id;
      const salesLog = (entry as any).sales_log as any[] | null;
      const hasSalesLog = salesLog && Array.isArray(salesLog) && salesLog.length > 0;
      const calculated = hasSalesLog ? calculateFromSalesLog(salesLog) : null;
      const fpPlus = calculated ? calculated.fp : (Number(entry.fp_plus) || 0);
      const prmr = calculated ? calculated.prmr : (Number((entry as any).prmr) || 0);
      if (fpPlus <= 0 && prmr <= 0) return;
      
      const entryDate = new Date(entry.entry_date + 'T12:00:00');
      const weekKey = format(startOfWeek(entryDate, { weekStartsOn: 0 }), 'yyyy-MM-dd');
      const monthKey = format(entryDate, 'yyyy-MM');
      
      // FP+ tracking
      if (fpPlus > 0) {
        const currentDayBest = userDayBests.get(userId);
        if (!currentDayBest || fpPlus > currentDayBest.value) {
          userDayBests.set(userId, { value: fpPlus, date: entry.entry_date });
        }
        if (!userWeekTotals.has(userId)) userWeekTotals.set(userId, new Map());
        const userWeeks = userWeekTotals.get(userId)!;
        userWeeks.set(weekKey, (userWeeks.get(weekKey) || 0) + fpPlus);
        if (!userMonthTotals.has(userId)) userMonthTotals.set(userId, new Map());
        const userMonths = userMonthTotals.get(userId)!;
        userMonths.set(monthKey, (userMonths.get(monthKey) || 0) + fpPlus);
      }
      
      // PRMR tracking
      if (prmr > 0) {
        const currentDayBest = prmrUserDayBests.get(userId);
        if (!currentDayBest || prmr > currentDayBest.value) {
          prmrUserDayBests.set(userId, { value: prmr, date: entry.entry_date });
        }
        if (!prmrUserWeekTotals.has(userId)) prmrUserWeekTotals.set(userId, new Map());
        const userWeeks = prmrUserWeekTotals.get(userId)!;
        userWeeks.set(weekKey, (userWeeks.get(weekKey) || 0) + prmr);
        if (!prmrUserMonthTotals.has(userId)) prmrUserMonthTotals.set(userId, new Map());
        const userMonths = prmrUserMonthTotals.get(userId)!;
        userMonths.set(monthKey, (userMonths.get(monthKey) || 0) + prmr);
      }
    });

    // Helper to get bests from totals maps
    const getBests = (totalsMap: Map<string, Map<string, number>>) => {
      const bests = new Map<string, { value: number; date: string }>();
      totalsMap.forEach((periods, userId) => {
        let best = { value: 0, date: '' };
        periods.forEach((total, key) => {
          if (total > best.value) best = { value: total, date: key };
        });
        if (best.value > 0) bests.set(userId, best);
      });
      return bests;
    };

    const userWeekBests = getBests(userWeekTotals);
    const userMonthBests = getBests(userMonthTotals);
    const prmrUserWeekBests = getBests(prmrUserWeekTotals);
    const prmrUserMonthBests = getBests(prmrUserMonthTotals);

    // Build class records for both metrics
    const records: ClassRecordsData = { Rookie: emptySet(), Sophomore: emptySet(), Vet: emptySet() };
    const prmrRecords: ClassRecordsData = { Rookie: emptySet(), Sophomore: emptySet(), Vet: emptySet() };

    repsData.forEach(rep => {
      if (!rep.user_id) return;
      const year = rep.year as keyof ClassRecordsData;
      if (year !== 'Rookie' && year !== 'Sophomore' && year !== 'Vet') return;

      const cleanName = rep.name
        .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2300}-\u{23FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '')
        .trim() || rep.name.charAt(0) || 'Unknown';

      // FP+ records
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

      // PRMR records
      const prmrDayBest = prmrUserDayBests.get(rep.user_id);
      const prmrWeekBest = prmrUserWeekBests.get(rep.user_id);
      const prmrMonthBest = prmrUserMonthBests.get(rep.user_id);

      if (prmrDayBest && (!prmrRecords[year].day || prmrDayBest.value > prmrRecords[year].day!.value)) {
        prmrRecords[year].day = { userId: rep.user_id, name: cleanName, value: prmrDayBest.value, date: prmrDayBest.date };
      }
      if (prmrWeekBest && (!prmrRecords[year].week || prmrWeekBest.value > prmrRecords[year].week!.value)) {
        prmrRecords[year].week = { userId: rep.user_id, name: cleanName, value: prmrWeekBest.value, date: prmrWeekBest.date };
      }
      if (prmrMonthBest && (!prmrRecords[year].month || prmrMonthBest.value > prmrRecords[year].month!.value)) {
        prmrRecords[year].month = { userId: rep.user_id, name: cleanName, value: prmrMonthBest.value, date: prmrMonthBest.date };
      }
    });

    return { classRecords: records, prmrClassRecords: prmrRecords };
  }, [entriesData, repsData]);

  return {
    classRecords,
    prmrClassRecords,
    isLoading: entriesLoading || repsLoading,
  };
};
