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
import {
  calculateTeamGoalPace,
  RepGoalData,
  GoalPaceResult,
} from "@/utils/goalPaceCalculations";

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
  const insightsQuery = useTeamInsightsData({
    userIds,
    dateRange,
    excludeUserIds,
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
        .select('user_id, preseason_fp_goal, must_do_fp_goal, will_do_fp_goal, could_do_fp_goal, focus_tier, setup_complete')
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
        .select('user_id, fp_plus')
        .in('user_id', userIds)
        .gte('entry_date', yearStart);

      if (ytdError) throw ytdError;

      return { goals, reps, ytdEntries };
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
      let teamGoalStatus: TeamGoalStatus = {
        onPace: [],
        atRisk: [],
        behind: [],
        noGoals: repsWithEffort.map(r => r.name),
      };
      let teamGoalStatusDetails: TeamGoalStatusWithDetails | undefined;
      
      if (goalsQuery.data) {
        const { goals, reps, ytdEntries } = goalsQuery.data;
        
        // Calculate YTD FP per rep
        const ytdFPByUser = ytdEntries.reduce((acc, e) => {
          acc[e.user_id] = (acc[e.user_id] || 0) + (e.fp_plus || 0);
          return acc;
        }, {} as Record<string, number>);
        
        // Map reps to names
        const nameMap = new Map(reps.map(r => [r.user_id, r.name]));
        
        // Build goal data with names
        const goalsWithNames: RepGoalData[] = goals.map(g => ({
          user_id: g.user_id,
          name: nameMap.get(g.user_id) || 'Unknown',
          preseason_fp_goal: g.preseason_fp_goal,
          must_do_fp_goal: g.must_do_fp_goal,
          will_do_fp_goal: g.will_do_fp_goal,
          could_do_fp_goal: g.could_do_fp_goal,
          focus_tier: g.focus_tier,
          setup_complete: g.setup_complete,
        }));
        
        // Add reps without goals
        const repsWithGoals = new Set(goals.map(g => g.user_id));
        const repsWithoutGoals = reps
          .filter(r => r.user_id && !repsWithGoals.has(r.user_id))
          .map(r => ({
            user_id: r.user_id!,
            name: r.name,
            preseason_fp_goal: null,
            must_do_fp_goal: null,
            will_do_fp_goal: null,
            could_do_fp_goal: null,
            focus_tier: null,
            setup_complete: null,
          }));
        
        const allGoalsData = [...goalsWithNames, ...repsWithoutGoals];
        
        // Calculate progress data
        const progressData = allGoalsData.map(g => ({
          userId: g.user_id,
          currentFP: ytdFPByUser[g.user_id] || 0,
        }));
        
        // Calculate goal pace for each rep
        const paceResults = calculateTeamGoalPace(allGoalsData, progressData);
        
        teamGoalStatus = {
          onPace: paceResults.filter(r => r.status === 'on_pace').map(r => r.name),
          atRisk: paceResults.filter(r => r.status === 'at_risk').map(r => r.name),
          behind: paceResults.filter(r => r.status === 'behind').map(r => r.name),
          noGoals: paceResults.filter(r => r.status === 'no_goals').map(r => r.name),
        };
        
        // Store full details for tier breakdown
        teamGoalStatusDetails = {
          onPace: paceResults.filter(r => r.status === 'on_pace'),
          atRisk: paceResults.filter(r => r.status === 'at_risk'),
          behind: paceResults.filter(r => r.status === 'behind'),
          noGoals: paceResults.filter(r => r.status === 'no_goals'),
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
      
      return {
        totalFP: totals.fp,
        totalPRMR: totals.prmr,
        activeReps: repsWithEffort.length,
        workingCount,
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
      let teamGoalStatus: TeamGoalStatus = {
        onPace: [],
        atRisk: [],
        behind: [],
        noGoals: repsWithEffort.map(r => r.name),
      };
      let teamGoalStatusDetails: TeamGoalStatusWithDetails | undefined;
      
      if (goalsQuery.data) {
        const { goals, reps, ytdEntries } = goalsQuery.data;
        
        const ytdFPByUser = ytdEntries.reduce((acc, e) => {
          acc[e.user_id] = (acc[e.user_id] || 0) + (e.fp_plus || 0);
          return acc;
        }, {} as Record<string, number>);
        
        const nameMap = new Map(reps.map(r => [r.user_id, r.name]));
        
        const goalsWithNames: RepGoalData[] = goals.map(g => ({
          user_id: g.user_id,
          name: nameMap.get(g.user_id) || 'Unknown',
          preseason_fp_goal: g.preseason_fp_goal,
          must_do_fp_goal: g.must_do_fp_goal,
          will_do_fp_goal: g.will_do_fp_goal,
          could_do_fp_goal: g.could_do_fp_goal,
          focus_tier: g.focus_tier,
          setup_complete: g.setup_complete,
        }));
        
        const repsWithGoals = new Set(goals.map(g => g.user_id));
        const repsWithoutGoals = reps
          .filter(r => r.user_id && !repsWithGoals.has(r.user_id))
          .map(r => ({
            user_id: r.user_id!,
            name: r.name,
            preseason_fp_goal: null,
            must_do_fp_goal: null,
            will_do_fp_goal: null,
            could_do_fp_goal: null,
            focus_tier: null,
            setup_complete: null,
          }));
        
        const allGoalsData = [...goalsWithNames, ...repsWithoutGoals];
        const progressData = allGoalsData.map(g => ({
          userId: g.user_id,
          currentFP: ytdFPByUser[g.user_id] || 0,
        }));
        
        const paceResults = calculateTeamGoalPace(allGoalsData, progressData);
        
        teamGoalStatus = {
          onPace: paceResults.filter(r => r.status === 'on_pace').map(r => r.name),
          atRisk: paceResults.filter(r => r.status === 'at_risk').map(r => r.name),
          behind: paceResults.filter(r => r.status === 'behind').map(r => r.name),
          noGoals: paceResults.filter(r => r.status === 'no_goals').map(r => r.name),
        };
        
        // Store full details for tier breakdown
        teamGoalStatusDetails = {
          onPace: paceResults.filter(r => r.status === 'on_pace'),
          atRisk: paceResults.filter(r => r.status === 'at_risk'),
          behind: paceResults.filter(r => r.status === 'behind'),
          noGoals: paceResults.filter(r => r.status === 'no_goals'),
        };
      }
      
      return {
        totalFP: data.totalFP,
        totalPRMR: data.totalPRMR,
        activeReps: data.uniqueRepsWorked,
        workingCount: 0,
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
  }, [isLiveView, liveQuery.data, insightsQuery.data, baselineQuery.data]);

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
