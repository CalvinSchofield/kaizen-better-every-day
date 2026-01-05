import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

interface DayActivity {
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
  startTime?: string;
  endTime?: string;
}

interface RepGoalData {
  preseasonGoal?: number;
  mustGoal?: number;
  willGoal?: number;
  couldGoal?: number;
  focusTier?: string | null;
}

interface RepDrillDownExtendedData {
  last14DaysEntries: DayActivity[];
  goals: RepGoalData | null;
  totalSeasonFP: number;
  preseasonFP: number;
}

export const useRepDrillDownData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['rep-drill-down-data', userId],
    queryFn: async (): Promise<RepDrillDownExtendedData> => {
      if (!userId) throw new Error('No userId provided');

      const today = new Date();
      const fourteenDaysAgo = subDays(today, 14);
      const startDate = format(fourteenDaysAgo, 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');
      
      // Preseason dates for FP calculation
      const preseasonStart = '2026-01-13';
      const preseasonEnd = '2026-04-11';
      const summerStart = '2026-04-12';

      // Fetch last 14 days of entries
      const [entriesResult, goalsResult, seasonFPResult, preseasonFPResult] = await Promise.all([
        supabase
          .from('daily_entries')
          .select('entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, prmr, fp_plus, work_start_time, work_end_time')
          .eq('user_id', userId)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate)
          .order('entry_date', { ascending: true }),
        
        supabase
          .from('rep_goals')
          .select('preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier')
          .eq('user_id', userId)
          .maybeSingle(),
        
        // Total season FP (from preseason start to now)
        supabase
          .from('daily_entries')
          .select('fp_plus')
          .eq('user_id', userId)
          .gte('entry_date', preseasonStart),
        
        // Preseason FP only
        supabase
          .from('daily_entries')
          .select('fp_plus')
          .eq('user_id', userId)
          .gte('entry_date', preseasonStart)
          .lte('entry_date', preseasonEnd),
      ]);

      // Process entries
      const last14DaysEntries: DayActivity[] = (entriesResult.data || []).map(entry => {
        let hoursWorked = 0;
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          hoursWorked = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
        }
        
        return {
          date: entry.entry_date,
          doors: entry.doors_knocked || 0,
          dms: entry.decision_makers || 0,
          pitches: entry.pitches || 0,
          transitions: entry.transitions || 0,
          presentations: entry.presentations || 0,
          closes: entry.closes || 0,
          fp: entry.fp_plus || 0,
          prmr: entry.prmr || 0,
          hoursWorked,
          startTime: entry.work_start_time || undefined,
          endTime: entry.work_end_time || undefined,
        };
      });

      // Process goals
      const goals: RepGoalData | null = goalsResult.data ? {
        preseasonGoal: goalsResult.data.preseason_fp_goal || undefined,
        mustGoal: goalsResult.data.must_do_fp_goal || undefined,
        willGoal: goalsResult.data.will_do_fp_goal || undefined,
        couldGoal: goalsResult.data.could_do_fp_goal || undefined,
        focusTier: goalsResult.data.focus_tier || null,
      } : null;

      // Calculate total FP
      const totalSeasonFP = (seasonFPResult.data || []).reduce((sum, e) => sum + (e.fp_plus || 0), 0);
      const preseasonFP = (preseasonFPResult.data || []).reduce((sum, e) => sum + (e.fp_plus || 0), 0);

      return {
        last14DaysEntries,
        goals,
        totalSeasonFP,
        preseasonFP,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds
  });
};
