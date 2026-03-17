import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserId } from "@/hooks/useCurrentUserId";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { formatInTimeZone } from "date-fns-tz";

export interface BlitzDetailData {
  // Overview
  daysWorked: number;
  totalDoors: number;
  totalFp: number;
  totalPrmr: number;
  totalCloses: number;
  totalHoursWorked: number;
  // Inputs / funnel
  totalDMs: number;
  totalPitches: number;
  totalTransitions: number;
  totalPresentations: number;
  doorsPerHour: number;
  dmsPerDoor: number;
  closeRate: number;
  // Customers (sales log entries)
  sales: Array<{
    id: string;
    date: string;
    type: string;
    prmr: number;
    installStatus: string;
    customerName?: string;
    soldAtLocal?: string; // e.g. "7:11 PM" in the rep's local tz
  }>;
  // Daily breakdown
  dailyEntries: Array<{
    date: string;
    doors: number;
    fp: number;
    prmr: number;
    hoursWorked: number;
  }>;
}

export function useBlitzDetailStats(startDate: string | null, endDate: string | null) {
  const { userId } = useCurrentUserId();

  return useQuery({
    queryKey: ['blitz-detail-stats', userId, startDate, endDate],
    queryFn: async (): Promise<BlitzDetailData> => {
      if (!userId || !startDate || !endDate) throw new Error('Missing params');

      const { data: entries, error } = await supabase
        .from('daily_entries')
        .select('entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, fp_plus, prmr, work_start_time, work_end_time, break_periods, sales_log, timezone')
        .eq('user_id', userId)
        .gte('entry_date', startDate)
        .lte('entry_date', endDate);

      if (error) throw error;

      const workEntries = (entries || []).filter(e => e.work_start_time);
      
      let totalHours = 0;
      for (const e of workEntries) {
        if (e.work_start_time && e.work_end_time) {
          const start = new Date(e.work_start_time).getTime();
          const end = new Date(e.work_end_time).getTime();
          let breakMs = 0;
          if (Array.isArray(e.break_periods)) {
            for (const bp of e.break_periods as any[]) {
              if (bp?.start && bp?.end) {
                breakMs += new Date(bp.end).getTime() - new Date(bp.start).getTime();
              }
            }
          }
          totalHours += Math.max(0, (end - start - breakMs) / (1000 * 60 * 60));
        }
      }

      const totalDoors = (entries || []).reduce((s, e) => s + (e.doors_knocked || 0), 0);
      const totalDMs = (entries || []).reduce((s, e) => s + (e.decision_makers || 0), 0);
      const totalPitches = (entries || []).reduce((s, e) => s + (e.pitches || 0), 0);
      const totalTransitions = (entries || []).reduce((s, e) => s + (e.transitions || 0), 0);
      const totalPresentations = (entries || []).reduce((s, e) => s + (e.presentations || 0), 0);
      const totalCloses = (entries || []).reduce((s, e) => s + (e.closes || 0), 0);

      // Aggregate sales from all entries
      const allSales: BlitzDetailData['sales'] = [];
      let totalFp = 0;
      let totalPrmr = 0;

      for (const e of entries || []) {
        const salesLog = Array.isArray(e.sales_log) ? e.sales_log : [];
        if (salesLog.length > 0) {
          const calc = calculateFromSalesLog(salesLog as any[]);
          totalFp += calc.fp;
          totalPrmr += calc.prmr;
          for (const sale of salesLog as any[]) {
            if (sale?.install_status === 'never_installed') continue;
            allSales.push({
              id: sale.id || crypto.randomUUID(),
              date: e.entry_date,
              type: sale.type || 'fp',
              prmr: Number(sale.prmr) || 0,
              installStatus: sale.install_status || 'installed',
              customerName: sale.customer_name || sale.name,
            });
          }
        } else {
          totalFp += Number(e.fp_plus) || 0;
          totalPrmr += Number(e.prmr) || 0;
        }
      }

      const dailyEntries = (entries || []).map(e => {
        let hours = 0;
        if (e.work_start_time && e.work_end_time) {
          const start = new Date(e.work_start_time).getTime();
          const end = new Date(e.work_end_time).getTime();
          let breakMs = 0;
          if (Array.isArray(e.break_periods)) {
            for (const bp of e.break_periods as any[]) {
              if (bp?.start && bp?.end) breakMs += new Date(bp.end).getTime() - new Date(bp.start).getTime();
            }
          }
          hours = Math.max(0, (end - start - breakMs) / (1000 * 60 * 60));
        }
        return {
          date: e.entry_date,
          doors: e.doors_knocked || 0,
          fp: Number(e.fp_plus) || 0,
          prmr: Number(e.prmr) || 0,
          hoursWorked: hours,
        };
      }).sort((a, b) => a.date.localeCompare(b.date));

      return {
        daysWorked: workEntries.length,
        totalDoors,
        totalFp,
        totalPrmr,
        totalCloses,
        totalHoursWorked: totalHours,
        totalDMs,
        totalPitches,
        totalTransitions,
        totalPresentations,
        doorsPerHour: totalHours > 0 ? totalDoors / totalHours : 0,
        dmsPerDoor: totalDoors > 0 ? totalDMs / totalDoors : 0,
        closeRate: totalDMs > 0 ? totalCloses / totalDMs : 0,
        sales: allSales,
        dailyEntries,
      };
    },
    enabled: !!userId && !!startDate && !!endDate,
    staleTime: 10 * 60 * 1000,
  });
}
