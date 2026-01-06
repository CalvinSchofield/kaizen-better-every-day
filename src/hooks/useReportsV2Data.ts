import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfYear } from "date-fns";
import { useTeamLiveData } from "./useTeamLiveData";
import { useTeamInsightsData } from "./useTeamInsightsData";
import { 
  calculateEffortScore, 
  calculateTeamEffortSummary, 
  getLocalTimeMinutes,
  RepEffortData,
  EffortResult,
  TeamEffortSummary,
  DEFAULT_EFFORT_THRESHOLDS,
  EffortThresholds,
} from "@/utils/effortScore";
import {
  detectPrimaryConstraint,
  generateLeaderActions,
  analyzeFunnelBottleneck,
  calculateImpactPotential,
  ConstraintResult,
  LeaderAction,
  TeamMetrics,
  FunnelStage,
  RepPerformanceData,
} from "@/utils/constraintAnalysis";
import { TeamGoalStatus, TeamGoalStatusWithDetails } from "@/components/reports/v2/TeamGoalSummary";
import { 
  calculateRepBaseline,
  calculateTeamBaseline,
  TeamBaseline,
  RepBaseline,
} from "@/utils/baselineCalculations";
import { GoalPaceResult } from "@/utils/goalPaceCalculations";
import { calculateSalesPace } from "@/utils/salesPaceCalculator";

type RepGoalsLike = {
  preseason_fp_goal: number | null;
  must_do_fp_goal: number | null;
  will_do_fp_goal: number | null;
  could_do_fp_goal: number | null;
  cancel_rate: number | null;
  focus_tier: string | null;
  setup_complete: boolean | null;
};

const hasConfiguredGoals = (g: RepGoalsLike | undefined | null): boolean => {
  if (!g) return false;
  if (g.setup_complete === true) return true;
  return (
    (g.preseason_fp_goal ?? 0) > 0 ||
    (g.must_do_fp_goal ?? 0) > 0 ||
    (g.will_do_fp_goal ?? 0) > 0 ||
    (g.could_do_fp_goal ?? 0) > 0
  );
};

interface UseReportsV2DataParams {
  userIds: string[];
  dateRange: { start: string; end: string };
  excludeUserIds?: string[];
  isLiveView?: boolean; // true for "Today" view
  customThresholds?: EffortThresholds; // Optional custom thresholds from leader settings
}

export interface RepWithEffort {
  userId: string;
  name: string;
  year?: string;
  teamName?: string;
  phone?: string;
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
  effort: EffortResult;
}

export interface ReportsV2Data {
  // Loading states
  isLoading: boolean;
  
  // Summary metrics
  totalFP: number;
  totalPRMR: number;
  activeReps: number;
  workingCount: number;
  workingNames: string[]; // Names of reps currently working (for live view)
  
  // Analysis results
  constraint: ConstraintResult;
  actions: LeaderAction[];
  effortSummary: TeamEffortSummary;
  skillBottleneck: FunnelStage | null;
  impactPotential: string | null;
  
  // Team goal status
  teamGoalStatus: TeamGoalStatus;
  teamGoalStatusDetails?: TeamGoalStatusWithDetails;
  
  // Team baseline
  teamBaseline?: TeamBaseline;
  
  // Rep-level data
  repsWithEffort: RepWithEffort[];
  
  // Funnel data
  funnelData: {
    doors: number;
    decisionMakers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
  };
  
  // For drill-down
  getRepById: (userId: string) => RepWithEffort | undefined;
}

export const useReportsV2Data = ({
  userIds,
  dateRange,
  excludeUserIds = [],
  isLiveView = false,
  customThresholds,
}: UseReportsV2DataParams): ReportsV2Data => {
  // Use custom thresholds or defaults
  const effortThresholds = customThresholds || DEFAULT_EFFORT_THRESHOLDS;

  // Fetch live data (for today view)
  const liveQuery = useTeamLiveData({
    userIds,
    excludeUserIds,
  });
  
  // Fetch aggregated data (for date range views)
  // For today/live views, include unfinalized entries
  const insightsQuery = useTeamInsightsData({
    userIds,
    dateRange,
    excludeUserIds,
    includeLive: isLiveView,
  });

  // Fetch 14-day entries for baseline calculation
  const today = new Date();
  const fourteenDaysAgo = format(subDays(today, 14), 'yyyy-MM-dd');
  const yesterday = format(subDays(today, 1), 'yyyy-MM-dd');
  const todayStr = format(today, 'yyyy-MM-dd');
  const yearStart = format(startOfYear(today), 'yyyy-MM-dd');

  const baselineQuery = useQuery({
    queryKey: ['team-baseline', userIds, fourteenDaysAgo],
    queryFn: async () => {
      if (userIds.length === 0) return null;

      // Fetch 14-day entries for all reps
      const { data: entries, error: entriesError } = await supabase
        .from('daily_entries')
        .select('user_id, entry_date, doors_knocked, fp_plus, prmr, work_start_time, work_end_time')
        .in('user_id', userIds)
        .gte('entry_date', fourteenDaysAgo)
        .lte('entry_date', yesterday);

      if (entriesError) throw entriesError;

      // Fetch planned work days for today
      const { data: plannedDays, error: plannedError } = await supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .in('user_id', userIds)
        .eq('planned_date', todayStr);

      if (plannedError) throw plannedError;

      // Fetch rep names
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name')
        .in('user_id', userIds);

      if (repsError) throw repsError;

      return { entries, plannedDays, reps };
    },
    enabled: userIds.length > 0 && isLiveView,
    staleTime: 60000, // 1 minute
  });

  // Fetch rep_goals for team goal pace calculation
  const goalsQuery = useQuery({
    queryKey: ['team-rep-goals', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return null;

      // Fetch rep_goals for all team members
      const { data: goals, error: goalsError } = await supabase
        .from('rep_goals')
        .select('user_id, preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier, setup_complete, cancel_rate')
        .in('user_id', userIds);

      if (goalsError) throw goalsError;

      // Fetch rep names for goals
      const { data: reps, error: repsError } = await supabase
        .from('reps')
        .select('user_id, name')
        .in('user_id', userIds);

      if (repsError) throw repsError;

      // Fetch year-to-date FP for progress
      const { data: ytdEntries, error: ytdError } = await supabase
        .from('daily_entries')
        .select('user_id, fp_plus, doors_knocked')
        .in('user_id', userIds)
        .gte('entry_date', yearStart);

      if (ytdError) throw ytdError;

      // Fetch all planned work days for proper daily goal calculation
      const { data: allPlannedDays, error: plannedError } = await supabase
        .from('planned_work_days')
        .select('user_id, planned_date')
        .in('user_id', userIds);

      if (plannedError) throw plannedError;

      // Fetch season_config for personal_summer_start
      const { data: seasonConfigs, error: configError } = await supabase
        .from('season_config')
        .select('user_id, personal_summer_start')
        .in('user_id', userIds);

      if (configError) throw configError;

      return { goals, reps, ytdEntries, allPlannedDays, seasonConfigs };
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const isLoading = isLiveView ? liveQuery.isLoading : insightsQuery.isLoading;

  // Process data into unified format
  const processedData = useMemo(() => {
    if (isLiveView && liveQuery.data) {
      // Process live data
      const { liveReps, workingCount } = liveQuery.data;
      
      const repsWithEffort: RepWithEffort[] = liveReps.map(rep => {
        // Calculate hours worked
        let hoursWorked = 0;
        if (rep.workStartTime) {
          const start = new Date(rep.workStartTime);
          const end = rep.workEndTime ? new Date(rep.workEndTime) : new Date();
          hoursWorked = Math.max(0, (end.getTime() - start.getTime()) / (1000 * 60 * 60));
          hoursWorked -= (rep.breakMinutes || 0) / 60;
        }
        
        // Prepare effort data
        const effortData: RepEffortData = {
          userId: rep.userId,
          name: rep.name,
          year: rep.year,
          doors: rep.todayStats.doors,
          hoursWorked,
          startTimeMinutes: rep.workStartTime 
            ? getLocalTimeMinutes(rep.workStartTime, rep.timezone)
            : undefined,
          endTimeMinutes: rep.workEndTime
            ? getLocalTimeMinutes(rep.workEndTime, rep.timezone)
            : undefined,
          avgDoorsLast14Days: rep.avgDoorsPerHour,
        };
        
        const effort = calculateEffortScore(effortData, effortThresholds);
        
        return {
          userId: rep.userId,
          name: rep.name,
          year: rep.year,
          teamName: rep.teamName,
          phone: rep.phone,
          doors: rep.todayStats.doors,
          dms: rep.todayStats.dms,
          pitches: rep.todayStats.pitches,
          transitions: rep.todayStats.transitions,
          presentations: rep.todayStats.presentations,
          closes: rep.todayStats.closes,
          fp: rep.todayStats.fp,
          prmr: rep.todayStats.prmr,
          hoursWorked,
          workStartTime: rep.workStartTime,
          workEndTime: rep.workEndTime,
          effort,
        };
      });
      
      // Calculate totals
      const totals = repsWithEffort.reduce(
        (acc, rep) => ({
          fp: acc.fp + rep.fp,
          prmr: acc.prmr + rep.prmr,
          doors: acc.doors + rep.doors,
          dms: acc.dms + rep.dms,
          pitches: acc.pitches + rep.pitches,
          transitions: acc.transitions + rep.transitions,
          presentations: acc.presentations + rep.presentations,
          closes: acc.closes + rep.closes,
          hours: acc.hours + rep.hoursWorked,
        }),
        { fp: 0, prmr: 0, doors: 0, dms: 0, pitches: 0, transitions: 0, presentations: 0, closes: 0, hours: 0 }
      );
      
      // Calculate effort summary
      const effortResults = repsWithEffort.map(rep => ({
        rep: {
          userId: rep.userId,
          name: rep.name,
          year: rep.year,
          doors: rep.doors,
          hoursWorked: rep.hoursWorked,
        },
        result: rep.effort,
      }));
      const effortSummary = calculateTeamEffortSummary(effortResults);
      
      // Build team metrics for constraint analysis
      const teamMetrics: TeamMetrics = {
        avgDoorsPerHour: totals.hours > 0 ? totals.doors / totals.hours : 0,
        doorsPerHourBenchmark: 13,
        lateStartCount: repsWithEffort.filter(r => 
          r.effort.flags.some(f => f.type === 'late_start')
        ).length,
        earlyEndCount: repsWithEffort.filter(r => 
          r.effort.flags.some(f => f.type === 'early_end')
        ).length,
        totalReps: repsWithEffort.length,
        totalDoors: totals.doors,
        totalDMs: totals.dms,
        totalPitches: totals.pitches,
        totalTransitions: totals.transitions,
        totalPresentations: totals.presentations,
        totalCloses: totals.closes,
        totalFP: totals.fp,
        repsWithActivity: repsWithEffort.filter(r => r.doors > 0 || r.fp > 0).length,
      };
      
      const constraint = detectPrimaryConstraint(teamMetrics);
      const skillBottleneck = analyzeFunnelBottleneck(teamMetrics);
      const impactPotential = calculateImpactPotential(teamMetrics, skillBottleneck);
      
      // Generate leader actions
      const repPerformanceData: RepPerformanceData[] = repsWithEffort.map(rep => ({
        name: rep.name,
        effortScore: rep.effort.score,
        effortCategory: rep.effort.category,
        fp: rep.fp,
        hasLateStart: rep.effort.flags.some(f => f.type === 'late_start'),
        hasEarlyEnd: rep.effort.flags.some(f => f.type === 'early_end'),
        hasLowDoors: rep.effort.flags.some(f => f.type === 'low_doors'),
      }));
      const actions = generateLeaderActions(repPerformanceData, constraint);
      
      // Calculate team goal status from goals query data
      // For live view: show daily goals for reps working TODAY only
      let teamGoalStatus: TeamGoalStatus = {
        onPace: [],
        atRisk: [],
        behind: [],
        noGoals: repsWithEffort.map(r => r.name),
      };
      let teamGoalStatusDetails: TeamGoalStatusWithDetails | undefined;
      
      if (goalsQuery.data) {
        const { goals, reps: _reps, ytdEntries, allPlannedDays, seasonConfigs } = goalsQuery.data;
        
        // Map data by user_id for quick lookup
        const goalsMap = new Map(goals.map(g => [g.user_id, g]));
        const plannedDaysMap = new Map<string, Array<{ planned_date: string }>>();
        (allPlannedDays || []).forEach(p => {
          if (!plannedDaysMap.has(p.user_id)) {
            plannedDaysMap.set(p.user_id, []);
          }
          plannedDaysMap.get(p.user_id)!.push({ planned_date: p.planned_date });
        });
        const seasonConfigMap = new Map(
          (seasonConfigs || []).map(c => [c.user_id, c.personal_summer_start])
        );
        
        // Calculate knocking days (days with 5+ doors) per user from YTD entries
        const knockingDaysMap = new Map<string, number>();
        (ytdEntries || []).forEach(e => {
          if ((e.doors_knocked || 0) >= 5) {
            knockingDaysMap.set(e.user_id, (knockingDaysMap.get(e.user_id) || 0) + 1);
          }
        });
        
        // For live view: only show reps who are currently working today
        // Calculate their daily goal and today's progress
        const dailyPaceResults: GoalPaceResult[] = [];
        
        for (const rep of repsWithEffort) {
          const goal = goalsMap.get(rep.userId) as RepGoalsLike | undefined;
          const todayFP = rep.fp; // Today's FP from live data

          if (!hasConfiguredGoals(goal)) {
            dailyPaceResults.push({
              userId: rep.userId,
              name: rep.name,
              status: 'no_goals',
              activeGoal: 0,
              currentProgress: todayFP,
              expectedAtThisPoint: 0,
              percentOfExpected: 0,
              focusTier: null,
            });
            continue;
          }

          // Use calculateSalesPace for proper daily goal calculation
          const personalSummerStart = seasonConfigMap.get(rep.userId);
          const plannedDays = plannedDaysMap.get(rep.userId) || [];
          const knockingDays = knockingDaysMap.get(rep.userId) || 0;

          const summerTier = (
            goal.focus_tier === 'mustDo' || goal.focus_tier === 'willDo' || goal.focus_tier === 'couldDo'
              ? goal.focus_tier
              : 'willDo'
          ) as 'mustDo' | 'willDo' | 'couldDo';

          const baseInput = {
            goals: {
              preseason_fp_goal: goal.preseason_fp_goal,
              must_do_fp_goal: goal.must_do_fp_goal,
              will_do_fp_goal: goal.will_do_fp_goal,
              could_do_fp_goal: goal.could_do_fp_goal,
              cancel_rate: goal.cancel_rate,
              setup_complete: true,
            },
            plannedDays,
            knockingDays,
            currentFpPlus: 0, // We only need the daily goal
            currentPrmr: 0,
            efpModeEnabled: false,
            calculateEfp: (prmr: number) => prmr / 85,
            personalSummerStart,
          };

          // 1) Let the shared calculator decide if this rep is still preseason (personal summer start aware)
          // 2) If they're in summer, rerun with the rep's focus tier
          let usedTier: 'preseason' | 'mustDo' | 'willDo' | 'couldDo' = 'preseason';
          let paceResult = calculateSalesPace(baseInput);

          // 1) Let the shared calculator decide if this rep is still preseason (personal summer start aware)
          // 2) If they're in summer, rerun with the rep's focus tier
          // 3) If preseason goal is missing, fall back to the rep's focus tier so they don't show as "No Goals"
          if (paceResult) {
            if (!paceResult.isInPreseason) {
              usedTier = summerTier;
              paceResult = calculateSalesPace({ ...baseInput, activeTier: summerTier });
            }
          } else {
            usedTier = summerTier;
            paceResult = calculateSalesPace({ ...baseInput, activeTier: summerTier });
          }

          const dailyGoal = paceResult?.dailyGoal || 0;
          const focusTier = usedTier;
          
          if (dailyGoal <= 0) {
            dailyPaceResults.push({
              userId: rep.userId,
              name: rep.name,
              status: 'no_goals',
              activeGoal: 0,
              currentProgress: todayFP,
              expectedAtThisPoint: 0,
              percentOfExpected: 0,
              focusTier,
            });
            continue;
          }
          
          const percentOfDaily = (todayFP / dailyGoal) * 100;
          
          // Determine status based on today's progress vs daily goal
          let status: 'on_pace' | 'at_risk' | 'behind' | 'no_goals';
          if (percentOfDaily >= 90) {
            status = 'on_pace';
          } else if (percentOfDaily >= 50) {
            status = 'at_risk';
          } else {
            status = 'behind';
          }
          
          dailyPaceResults.push({
            userId: rep.userId,
            name: rep.name,
            status,
            activeGoal: dailyGoal,
            currentProgress: todayFP,
            expectedAtThisPoint: dailyGoal,
            percentOfExpected: percentOfDaily,
            focusTier,
          });
        }
        
        teamGoalStatus = {
          onPace: dailyPaceResults.filter(r => r.status === 'on_pace').map(r => r.name),
          atRisk: dailyPaceResults.filter(r => r.status === 'at_risk').map(r => r.name),
          behind: dailyPaceResults.filter(r => r.status === 'behind').map(r => r.name),
          noGoals: dailyPaceResults.filter(r => r.status === 'no_goals').map(r => r.name),
        };
        
        // Store full details for tier breakdown
        teamGoalStatusDetails = {
          onPace: dailyPaceResults.filter(r => r.status === 'on_pace'),
          atRisk: dailyPaceResults.filter(r => r.status === 'at_risk'),
          behind: dailyPaceResults.filter(r => r.status === 'behind'),
          noGoals: dailyPaceResults.filter(r => r.status === 'no_goals'),
        };
      }
      
      // Calculate team baseline from 14-day data
      let teamBaseline: TeamBaseline | undefined;
      if (baselineQuery.data) {
        const { entries, plannedDays, reps } = baselineQuery.data;
        
        // Build per-rep baselines
        const repBaselines: RepBaseline[] = reps
          .filter(r => r.user_id)
          .map(rep => {
            const repEntries = entries
              .filter(e => e.user_id === rep.user_id)
              .map(e => ({
                entry_date: e.entry_date,
                doors_knocked: e.doors_knocked,
                fp_plus: e.fp_plus,
                prmr: e.prmr,
                work_start_time: e.work_start_time,
                work_end_time: e.work_end_time,
              }));
            
            const isWorkingToday = plannedDays.some(
              p => p.user_id === rep.user_id
            );
            
            return calculateRepBaseline(
              rep.user_id!,
              rep.name,
              repEntries,
              isWorkingToday
            );
          });
        
        teamBaseline = calculateTeamBaseline(repBaselines);
      }
      
      // Get names of reps currently working (unfinalized entries)
      const workingNames = liveQuery.data.liveReps
        .filter(r => r.isWorking)
        .map(r => r.name);
      
      return {
        totalFP: totals.fp,
        totalPRMR: totals.prmr,
        activeReps: repsWithEffort.length,
        workingCount,
        workingNames,
        constraint,
        actions,
        effortSummary,
        skillBottleneck,
        impactPotential,
        teamGoalStatus,
        teamGoalStatusDetails,
        teamBaseline,
        repsWithEffort,
        funnelData: {
          doors: totals.doors,
          decisionMakers: totals.dms,
          pitches: totals.pitches,
          transitions: totals.transitions,
          presentations: totals.presentations,
          closes: totals.closes,
        },
      };
    }
    
    if (!isLiveView && insightsQuery.data) {
      // Process aggregated insights data
      const data = insightsQuery.data;
      
      const repsWithEffort: RepWithEffort[] = data.repBreakdown.map(rep => {
        const effortData: RepEffortData = {
          userId: rep.userId,
          name: rep.name,
          year: rep.year,
          doors: rep.doors,
          hoursWorked: rep.hoursWorked,
        };
        
        const effort = calculateEffortScore(effortData, effortThresholds);
        
        return {
          userId: rep.userId,
          name: rep.name,
          year: rep.year,
          teamName: rep.teamName,
          doors: rep.doors,
          dms: rep.dms,
          pitches: rep.pitches,
          transitions: rep.transitions,
          presentations: rep.presentations,
          closes: rep.closes,
          fp: rep.fp,
          prmr: rep.prmr,
          hoursWorked: rep.hoursWorked,
          effort,
        };
      });
      
      const effortResults = repsWithEffort.map(rep => ({
        rep: {
          userId: rep.userId,
          name: rep.name,
          year: rep.year,
          doors: rep.doors,
          hoursWorked: rep.hoursWorked,
        },
        result: rep.effort,
      }));
      const effortSummary = calculateTeamEffortSummary(effortResults);
      
      const teamMetrics: TeamMetrics = {
        avgDoorsPerHour: data.doorsPerHour,
        doorsPerHourBenchmark: 13,
        lateStartCount: 0, // Not available in aggregated view
        earlyEndCount: 0,
        totalReps: data.uniqueRepsWorked,
        totalDoors: data.totalDoors,
        totalDMs: data.totalDMs,
        totalPitches: data.totalPitches,
        totalTransitions: data.totalTransitions,
        totalPresentations: data.totalPresentations,
        totalCloses: data.totalCloses,
        totalFP: data.totalFP,
        repsWithActivity: data.uniqueRepsWorked,
      };
      
      const constraint = detectPrimaryConstraint(teamMetrics);
      const skillBottleneck = analyzeFunnelBottleneck(teamMetrics);
      const impactPotential = calculateImpactPotential(teamMetrics, skillBottleneck);
      
      const repPerformanceData: RepPerformanceData[] = repsWithEffort.map(rep => ({
        name: rep.name,
        effortScore: rep.effort.score,
        effortCategory: rep.effort.category,
        fp: rep.fp,
        hasLateStart: false,
        hasEarlyEnd: false,
        hasLowDoors: rep.effort.flags.some(f => f.type === 'low_doors'),
      }));
      const actions = generateLeaderActions(repPerformanceData, constraint);
      
      // Calculate team goal status from goals query data
      // ONLY include reps who worked in the selected date range
      const activeUserIds = new Set(repsWithEffort.map(r => r.userId));
      
      let teamGoalStatus: TeamGoalStatus = {
        onPace: [],
        atRisk: [],
        behind: [],
        noGoals: repsWithEffort.map(r => r.name),
      };
      let teamGoalStatusDetails: TeamGoalStatusWithDetails | undefined;
      
      if (goalsQuery.data && repsWithEffort.length > 0) {
        const { goals, reps: _reps, ytdEntries, allPlannedDays, seasonConfigs } = goalsQuery.data;
        
        // Calculate number of days in the selected period
        const startDate = new Date(dateRange.start);
        const endDate = new Date(dateRange.end);
        const periodDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        
        // Map goals by user_id for quick lookup
        const goalsMap = new Map(goals.map(g => [g.user_id, g]));
        
        // Build planned days map for calculateSalesPace
        const plannedDaysMap = new Map<string, Array<{ planned_date: string }>>();
        (allPlannedDays || []).forEach(p => {
          if (!plannedDaysMap.has(p.user_id)) {
            plannedDaysMap.set(p.user_id, []);
          }
          plannedDaysMap.get(p.user_id)!.push({ planned_date: p.planned_date });
        });
        const seasonConfigMap = new Map(
          (seasonConfigs || []).map(c => [c.user_id, c.personal_summer_start])
        );
        
        // Calculate knocking days (days with 5+ doors) per user from YTD entries
        const knockingDaysMap = new Map<string, number>();
        (ytdEntries || []).forEach(e => {
          if ((e.doors_knocked || 0) >= 5) {
            knockingDaysMap.set(e.user_id, (knockingDaysMap.get(e.user_id) || 0) + 1);
          }
        });
        
        // Calculate period-specific goal pacing for each active rep
        const periodPaceResults: GoalPaceResult[] = [];
        
        for (const rep of repsWithEffort) {
          const goal = goalsMap.get(rep.userId) as RepGoalsLike | undefined;
          const periodFP = rep.fp; // FP earned in this period
          
          if (!hasConfiguredGoals(goal)) {
            periodPaceResults.push({
              userId: rep.userId,
              name: rep.name,
              status: 'no_goals',
              activeGoal: 0,
              currentProgress: periodFP,
              expectedAtThisPoint: 0,
              percentOfExpected: 0,
              focusTier: null,
            });
            continue;
          }
          
          // Use calculateSalesPace for proper daily goal calculation
          const personalSummerStart = seasonConfigMap.get(rep.userId);
          const plannedDays = plannedDaysMap.get(rep.userId) || [];
          const knockingDays = knockingDaysMap.get(rep.userId) || 0;

          const summerTier = (
            goal.focus_tier === 'mustDo' || goal.focus_tier === 'willDo' || goal.focus_tier === 'couldDo'
              ? goal.focus_tier
              : 'willDo'
          ) as 'mustDo' | 'willDo' | 'couldDo';

          const baseInput = {
            goals: {
              preseason_fp_goal: goal.preseason_fp_goal,
              must_do_fp_goal: goal.must_do_fp_goal,
              will_do_fp_goal: goal.will_do_fp_goal,
              could_do_fp_goal: goal.could_do_fp_goal,
              cancel_rate: goal.cancel_rate,
              setup_complete: true,
            },
            plannedDays,
            knockingDays,
            currentFpPlus: 0,
            currentPrmr: 0,
            efpModeEnabled: false,
            calculateEfp: (prmr: number) => prmr / 85,
            personalSummerStart,
          };

          let usedTier: 'preseason' | 'mustDo' | 'willDo' | 'couldDo' = 'preseason';
          let paceResult = calculateSalesPace(baseInput);

          if (paceResult) {
            if (!paceResult.isInPreseason) {
              usedTier = summerTier;
              paceResult = calculateSalesPace({ ...baseInput, activeTier: summerTier });
            }
          } else {
            usedTier = summerTier;
            paceResult = calculateSalesPace({ ...baseInput, activeTier: summerTier });
          }

          const dailyGoal = paceResult?.dailyGoal || 0;
          const focusTier = usedTier;
          const periodGoal = dailyGoal * periodDays;
          
          if (periodGoal <= 0) {
            periodPaceResults.push({
              userId: rep.userId,
              name: rep.name,
              status: 'no_goals',
              activeGoal: 0,
              currentProgress: periodFP,
              expectedAtThisPoint: 0,
              percentOfExpected: 0,
              focusTier,
            });
            continue;
          }
          
          const percentOfPeriodGoal = (periodFP / periodGoal) * 100;
          
          // Determine status based on period progress vs period goal
          let status: 'on_pace' | 'at_risk' | 'behind' | 'no_goals';
          if (percentOfPeriodGoal >= 90) {
            status = 'on_pace';
          } else if (percentOfPeriodGoal >= 50) {
            status = 'at_risk';
          } else {
            status = 'behind';
          }
          
          periodPaceResults.push({
            userId: rep.userId,
            name: rep.name,
            status,
            activeGoal: periodGoal,
            currentProgress: periodFP,
            expectedAtThisPoint: periodGoal,
            percentOfExpected: percentOfPeriodGoal,
            focusTier,
          });
        }
        
        teamGoalStatus = {
          onPace: periodPaceResults.filter(r => r.status === 'on_pace').map(r => r.name),
          atRisk: periodPaceResults.filter(r => r.status === 'at_risk').map(r => r.name),
          behind: periodPaceResults.filter(r => r.status === 'behind').map(r => r.name),
          noGoals: periodPaceResults.filter(r => r.status === 'no_goals').map(r => r.name),
        };
        
        // Store full details for tier breakdown
        teamGoalStatusDetails = {
          onPace: periodPaceResults.filter(r => r.status === 'on_pace'),
          atRisk: periodPaceResults.filter(r => r.status === 'at_risk'),
          behind: periodPaceResults.filter(r => r.status === 'behind'),
          noGoals: periodPaceResults.filter(r => r.status === 'no_goals'),
        };
      }
      
      return {
        totalFP: data.totalFP,
        totalPRMR: data.totalPRMR,
        activeReps: data.uniqueRepsWorked,
        workingCount: 0,
        workingNames: [],
        constraint,
        actions,
        effortSummary,
        skillBottleneck,
        impactPotential,
        teamGoalStatus,
        teamGoalStatusDetails,
        repsWithEffort,
        funnelData: {
          doors: data.totalDoors,
          decisionMakers: data.totalDMs,
          pitches: data.totalPitches,
          transitions: data.totalTransitions,
          presentations: data.totalPresentations,
          closes: data.totalCloses,
        },
      };
    }
    
    // Default empty state
    return {
      totalFP: 0,
      totalPRMR: 0,
      activeReps: 0,
      workingCount: 0,
      workingNames: [],
      constraint: {
        type: 'on_track' as const,
        severity: 'info' as const,
        message: 'No data available',
      },
      actions: [],
      effortSummary: {
        avgScore: 0,
        outstandingCount: 0,
        standardCount: 0,
        needsImprovementCount: 0,
        avgDoorsPerHour: 0,
        totalFlags: 0,
      },
      skillBottleneck: null,
      impactPotential: null,
      teamGoalStatus: {
        onPace: [],
        atRisk: [],
        behind: [],
        noGoals: [],
      },
      teamBaseline: undefined,
      repsWithEffort: [],
      funnelData: {
        doors: 0,
        decisionMakers: 0,
        pitches: 0,
        transitions: 0,
        presentations: 0,
        closes: 0,
      },
    };
  }, [isLiveView, liveQuery.data, insightsQuery.data, baselineQuery.data, goalsQuery.data, effortThresholds]);

  // Helper to get rep by ID
  const getRepById = (userId: string): RepWithEffort | undefined => {
    return processedData.repsWithEffort.find(r => r.userId === userId);
  };

  return {
    isLoading,
    ...processedData,
    getRepById,
  };
};
