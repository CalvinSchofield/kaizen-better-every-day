import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

interface DayActivityData {
  date: string;
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  prmr: number;
  hoursWorked: number;
  workStartTime?: string;
  workEndTime?: string;
  breakMinutes: number;
  breakPeriods?: Array<{ start: string; end: string }>;
  gapMinutes: number;
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
  isFinalized: boolean;
  hasData: boolean;
}

export const useRepDayActivity = (userId: string | undefined, selectedDate: Date) => {
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  
  return useQuery({
    queryKey: ['rep-day-activity', userId, dateStr],
    queryFn: async (): Promise<DayActivityData> => {
      if (!userId) throw new Error('No userId provided');
      
      const { data: entry, error } = await supabase
        .from('daily_entries')
        .select('*')
        .eq('user_id', userId)
        .eq('entry_date', dateStr)
        .maybeSingle();
      
      if (error) throw error;
      
      if (!entry) {
        return {
          date: dateStr,
          doors: 0,
          dms: 0,
          pitches: 0,
          transitions: 0,
          presentations: 0,
          closes: 0,
          fp: 0,
          prmr: 0,
          hoursWorked: 0,
          breakMinutes: 0,
          gapMinutes: 0,
          isFinalized: false,
          hasData: false,
        };
      }
      
      // Calculate hours worked
      let hoursWorked = 0;
      let breakMinutes = 0;
      
      if (entry.work_start_time && entry.work_end_time) {
        const start = parseISO(entry.work_start_time);
        const end = parseISO(entry.work_end_time);
        const totalMinutes = Math.max(0, differenceInMinutes(end, start));
        
        // Calculate break time
        if (entry.break_periods && Array.isArray(entry.break_periods)) {
          (entry.break_periods as any[]).forEach((bp: any) => {
            if (bp.start && bp.end) {
              const breakStart = parseISO(bp.start);
              const breakEnd = parseISO(bp.end);
              if (!isNaN(breakStart.getTime()) && !isNaN(breakEnd.getTime())) {
                const mins = differenceInMinutes(breakEnd, breakStart);
                if (mins > 0) breakMinutes += mins;
              }
            }
          });
        }
        
        hoursWorked = Math.max(0, (totalMinutes - breakMinutes) / 60);
      }
      
      // Calculate gap time from counter timestamps
      let gapMinutes = 0;
      const timestamps = entry.counter_timestamps as Record<string, string[]> | null;
      if (timestamps && entry.work_start_time && entry.work_end_time) {
        const allTimes: Date[] = [];
        Object.values(timestamps).forEach(times => {
          if (Array.isArray(times)) {
            times.forEach(t => {
              try {
                allTimes.push(parseISO(t));
              } catch {}
            });
          }
        });
        
        if (allTimes.length > 1) {
          allTimes.sort((a, b) => a.getTime() - b.getTime());
          
          for (let i = 1; i < allTimes.length; i++) {
            const gap = differenceInMinutes(allTimes[i], allTimes[i - 1]);
            // Count gaps > 20 minutes as "gap time" (excluding breaks)
            if (gap > 20) {
              gapMinutes += gap;
            }
          }
        }
      }
      
      // Calculate FP/PRMR from sales log
      const salesLog = entry.sales_log as any[] | null;
      let fp = entry.fp_plus || 0;
      let prmr = entry.prmr || 0;
      
      if (salesLog && salesLog.length > 0) {
        const calculated = calculateFromSalesLog(salesLog);
        fp = calculated.fp;
        prmr = calculated.prmr;
      }
      
      // Parse break periods for ring visualization
      const breakPeriods = entry.break_periods && Array.isArray(entry.break_periods)
        ? (entry.break_periods as any[]).filter(bp => bp.start && bp.end).map(bp => ({
            start: bp.start as string,
            end: bp.end as string,
          }))
        : [];
      
      return {
        date: dateStr,
        doors: entry.doors_knocked || 0,
        dms: entry.decision_makers || 0,
        pitches: entry.pitches || 0,
        transitions: entry.transitions || 0,
        presentations: entry.presentations || 0,
        closes: entry.closes || 0,
        fp,
        prmr,
        hoursWorked,
        workStartTime: entry.work_start_time || undefined,
        workEndTime: entry.work_end_time || undefined,
        breakMinutes,
        breakPeriods,
        gapMinutes,
        counterTimestamps: timestamps || undefined,
        salesLog: salesLog || undefined,
        isFinalized: entry.is_finalized || false,
        hasData: true,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData, // Keep previous data while loading new day
  });
};
