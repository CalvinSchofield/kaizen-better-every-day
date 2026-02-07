import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, differenceInDays, parseISO, isAfter, isBefore } from "date-fns";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";

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
  // Personal comparison indicators
  aboveAvgDoors?: boolean;
  aboveAvgFP?: boolean;
}

interface RepGoalData {
  preseasonGoal?: number;
  mustGoal?: number;
  willGoal?: number;
  couldGoal?: number;
  focusTier?: string | null;
}

interface GoalPaceInfo {
  daysElapsed: number;
  totalPlannedDays: number;
  expectedAtThisPoint: number;
  pacePercent: number;
  status: 'on_pace' | 'at_risk' | 'behind';
}

interface TodayActivityData {
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
  workStartTime?: string;
  workEndTime?: string;
  isFinalized?: boolean;
}

interface RepDrillDownExtendedData {
  last14DaysEntries: DayActivity[];
  goals: RepGoalData | null;
  totalSeasonFP: number;
  preseasonFP: number;
  // Personal averages for comparison
  avgDoorsPerDay: number;
  avgFPPerDay: number;
  daysAboveAvg: number;
  // Time-aware goal pace
  goalPace: {
    preseason?: GoalPaceInfo;
    mustDo?: GoalPaceInfo;
    willDo?: GoalPaceInfo;
    couldDo?: GoalPaceInfo;
  };
  // Is currently in preseason?
  isPreseason: boolean;
  // Purpose statement
  purposeStatement?: string | null;
  purposeUpdatedAt?: string | null;
  // Today's activity timeline data
  todayActivity?: TodayActivityData;
}

// Season date constants
const PRESEASON_START = '2026-01-13';
const PRESEASON_END = '2026-04-11';
const SUMMER_START = '2026-04-12';
const SUMMER_END = '2026-09-15';

export const useRepDrillDownData = (userId: string | undefined) => {
  return useQuery({
    queryKey: ['rep-drill-down-data', userId],
    queryFn: async (): Promise<RepDrillDownExtendedData> => {
      if (!userId) throw new Error('No userId provided');

      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const fourteenDaysAgo = subDays(today, 14);
      const startDate = format(fourteenDaysAgo, 'yyyy-MM-dd');
      const endDate = todayStr;
      
      // Determine if we're in preseason
      const isPreseason = !isAfter(today, parseISO(PRESEASON_END));

      // Fetch all data in parallel
      const [entriesResult, goalsResult, seasonFPResult, preseasonFPResult, plannedDaysResult, todayEntryResult] = await Promise.all([
        // Last 14 days of entries
        supabase
          .from('daily_entries')
          .select('entry_date, doors_knocked, decision_makers, pitches, transitions, presentations, closes, prmr, fp_plus, work_start_time, work_end_time, sales_log, is_finalized')
          .eq('user_id', userId)
          .gte('entry_date', startDate)
          .lte('entry_date', endDate)
          .order('entry_date', { ascending: true }),
        
        // Goals (including purpose)
        supabase
          .from('rep_goals')
          .select('preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier, purpose_statement, purpose_updated_at')
          .eq('user_id', userId)
          .maybeSingle(),
        
        // Total season FP (from preseason start to now)
        supabase
          .from('daily_entries')
          .select('fp_plus, prmr, sales_log, is_finalized')
          .eq('user_id', userId)
          .gte('entry_date', PRESEASON_START),
        
        // Preseason FP only
        supabase
          .from('daily_entries')
          .select('fp_plus, prmr, sales_log, is_finalized')
          .eq('user_id', userId)
          .gte('entry_date', PRESEASON_START)
          .lte('entry_date', PRESEASON_END),
        
        // Planned work days for pace calculation
        supabase
          .from('planned_work_days')
          .select('planned_date')
          .eq('user_id', userId)
          .gte('planned_date', PRESEASON_START)
          .lte('planned_date', SUMMER_END),
        
        // Today's entry with counter_timestamps for activity flow
        supabase
          .from('daily_entries')
          .select('counter_timestamps, sales_log, work_start_time, work_end_time, is_finalized')
          .eq('user_id', userId)
          .eq('entry_date', todayStr)
          .maybeSingle(),
      ]);

      // Helper to calculate FP from entry (prioritize sales_log)
      const getFpFromEntry = (entry: any): number => {
        const salesLog = entry.sales_log as any[];
        const hasSalesLog = salesLog && salesLog.length > 0;
        if (hasSalesLog) {
          return calculateFromSalesLog(salesLog).fp;
        }
        return entry.fp_plus || 0;
      };
      
      // Calculate personal averages from 14-day entries
      const workDays = (entriesResult.data || []).filter(e => (e.doors_knocked || 0) > 0);
      const avgDoorsPerDay = workDays.length > 0 
        ? workDays.reduce((sum, e) => sum + (e.doors_knocked || 0), 0) / workDays.length 
        : 0;
      const avgFPPerDay = workDays.length > 0
        ? workDays.reduce((sum, e) => sum + getFpFromEntry(e), 0) / workDays.length
        : 0;

      // Process entries with personal comparison
      const last14DaysEntries: DayActivity[] = (entriesResult.data || []).map(entry => {
        let hoursWorked = 0;
        if (entry.work_start_time && entry.work_end_time) {
          const start = new Date(entry.work_start_time);
          const end = new Date(entry.work_end_time);
          hoursWorked = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
        }
        
        const doors = entry.doors_knocked || 0;
        // Always prioritize sales_log if it has entries
        const salesLog = entry.sales_log as any[];
        const hasSalesLog = salesLog && salesLog.length > 0;
        let fp: number;
        let prmr: number;
        if (hasSalesLog) {
          const calculated = calculateFromSalesLog(salesLog);
          fp = calculated.fp;
          prmr = calculated.prmr;
        } else {
          fp = entry.fp_plus || 0;
          prmr = entry.prmr || 0;
        }
        
        return {
          date: entry.entry_date,
          doors,
          dms: entry.decision_makers || 0,
          pitches: entry.pitches || 0,
          transitions: entry.transitions || 0,
          presentations: entry.presentations || 0,
          closes: entry.closes || 0,
          fp,
          prmr,
          hoursWorked,
          startTime: entry.work_start_time || undefined,
          endTime: entry.work_end_time || undefined,
          aboveAvgDoors: doors > avgDoorsPerDay && avgDoorsPerDay > 0,
          aboveAvgFP: fp > avgFPPerDay && avgFPPerDay > 0,
        };
      });

      const daysAboveAvg = last14DaysEntries.filter(e => e.aboveAvgDoors).length;

      // Process goals
      const goals: RepGoalData | null = goalsResult.data ? {
        preseasonGoal: goalsResult.data.preseason_fp_goal || undefined,
        mustGoal: goalsResult.data.must_do_fp_goal || undefined,
        willGoal: goalsResult.data.will_do_fp_goal || undefined,
        couldGoal: goalsResult.data.could_do_fp_goal || undefined,
        focusTier: goalsResult.data.focus_tier || null,
      } : null;

      // Calculate total FP (prioritize sales_log)
      const totalSeasonFP = (seasonFPResult.data || []).reduce((sum, e) => sum + getFpFromEntry(e), 0);
      const preseasonFP = (preseasonFPResult.data || []).reduce((sum, e) => sum + getFpFromEntry(e), 0);

      // Calculate time-aware goal pace
      const plannedDates = (plannedDaysResult.data || []).map(d => d.planned_date);
      
      const calculateGoalPace = (goal: number | undefined, current: number, periodStart: string, periodEnd: string): GoalPaceInfo | undefined => {
        if (!goal || goal === 0) return undefined;
        
        const periodStartDate = parseISO(periodStart);
        const periodEndDate = parseISO(periodEnd);
        
        // Days elapsed since period start (capped at today)
        const effectiveEnd = isBefore(today, periodEndDate) ? today : periodEndDate;
        const daysElapsed = Math.max(0, differenceInDays(effectiveEnd, periodStartDate));
        
        // Total planned days in this period
        const totalPlannedDays = plannedDates.filter(d => {
          const date = parseISO(d);
          return !isBefore(date, periodStartDate) && !isAfter(date, periodEndDate);
        }).length || Math.round(differenceInDays(periodEndDate, periodStartDate) * 0.6); // Fallback: 60% of days
        
        // Expected progress at this point
        const elapsedPlannedDays = plannedDates.filter(d => {
          const date = parseISO(d);
          return !isBefore(date, periodStartDate) && !isAfter(date, effectiveEnd);
        }).length || Math.round(daysElapsed * 0.6);
        
        const expectedAtThisPoint = totalPlannedDays > 0 
          ? (goal / totalPlannedDays) * elapsedPlannedDays
          : 0;
        
        const pacePercent = expectedAtThisPoint > 0 
          ? (current / expectedAtThisPoint) * 100 
          : (current > 0 ? 100 : 0);
        
        const status: 'on_pace' | 'at_risk' | 'behind' = 
          pacePercent >= 90 ? 'on_pace' : 
          pacePercent >= 70 ? 'at_risk' : 'behind';
        
        return {
          daysElapsed,
          totalPlannedDays,
          expectedAtThisPoint,
          pacePercent,
          status,
        };
      };

      const goalPace = {
        preseason: calculateGoalPace(goals?.preseasonGoal, preseasonFP, PRESEASON_START, PRESEASON_END),
        mustDo: calculateGoalPace(goals?.mustGoal, totalSeasonFP, PRESEASON_START, SUMMER_END),
        willDo: calculateGoalPace(goals?.willGoal, totalSeasonFP, PRESEASON_START, SUMMER_END),
        couldDo: calculateGoalPace(goals?.couldGoal, totalSeasonFP, PRESEASON_START, SUMMER_END),
      };

      // Process today's activity data for timeline
      const todayActivity: TodayActivityData | undefined = todayEntryResult.data ? {
        counterTimestamps: todayEntryResult.data.counter_timestamps as Record<string, string[]> | undefined,
        salesLog: todayEntryResult.data.sales_log as Array<{ type: string; prmr: number; timestamp?: string }> | undefined,
        workStartTime: todayEntryResult.data.work_start_time || undefined,
        workEndTime: todayEntryResult.data.work_end_time || undefined,
        isFinalized: todayEntryResult.data.is_finalized || false,
      } : undefined;

      return {
        last14DaysEntries,
        goals,
        totalSeasonFP,
        preseasonFP,
        avgDoorsPerDay,
        avgFPPerDay,
        daysAboveAvg,
        goalPace,
        isPreseason,
        purposeStatement: goalsResult.data?.purpose_statement || null,
        purposeUpdatedAt: goalsResult.data?.purpose_updated_at || null,
        todayActivity,
      };
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });
};
