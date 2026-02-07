import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

interface DaySummary {
  date: string;
  doors: number;
  fp: number;
  prmr: number;
  hasSale: boolean;
  hasWork: boolean;
}

interface RepActivityCalendarData {
  summaries: DaySummary[];
  byDate: Record<string, DaySummary>;
}

export const useRepActivityCalendar = (
  userId: string | undefined,
  daysBack: number = 90
) => {
  return useQuery({
    queryKey: ['rep-activity-calendar', userId, daysBack],
    queryFn: async (): Promise<RepActivityCalendarData> => {
      if (!userId) throw new Error('No userId provided');
      
      const endDate = format(new Date(), 'yyyy-MM-dd');
      const startDate = format(subDays(new Date(), daysBack), 'yyyy-MM-dd');
      
      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, fp_plus, prmr, sales_log, work_start_time, closes')
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate)
        .order('entry_date', { ascending: true });
      
      if (error) throw error;
      
      const summaries: DaySummary[] = (entries || []).map(entry => {
        const salesLog = entry.sales_log as any[] | null;
        let fp = entry.fp_plus || 0;
        let prmr = entry.prmr || 0;
        
        if (salesLog && salesLog.length > 0) {
          const calculated = calculateFromSalesLog(salesLog);
          fp = calculated.fp;
          prmr = calculated.prmr;
        }
        
        // Check if has a sale (closes > 0 or fp sales in log)
        const hasSale = (entry.closes || 0) > 0 || 
          (salesLog?.some(s => s.type === 'fp') || false);
        
        return {
          date: entry.entry_date,
          doors: entry.doors_knocked || 0,
          fp,
          prmr,
          hasSale,
          hasWork: !!entry.work_start_time || (entry.doors_knocked || 0) > 0,
        };
      });
      
      // Create lookup map
      const byDate: Record<string, DaySummary> = {};
      summaries.forEach(s => {
        byDate[s.date] = s;
      });
      
      return { summaries, byDate };
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute cache for calendar data
  });
};
