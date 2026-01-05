import { useMemo } from "react";
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
import { TeamGoalStatus } from "@/components/reports/v2/TeamGoalSummary";

interface UseReportsV2DataParams {
  userIds: string[];
  dateRange: { start: string; end: string };
  excludeUserIds?: string[];
  isLiveView?: boolean; // true for "Today" view
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
}: UseReportsV2DataParams): ReportsV2Data => {
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
        
        const effort = calculateEffortScore(effortData, DEFAULT_EFFORT_THRESHOLDS);
        
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
      
      // Team goal status - for live view, we don't have goal data yet
      // This would need a separate query to get rep_goals for all team members
      const teamGoalStatus: TeamGoalStatus = {
        onPace: [],
        atRisk: [],
        behind: [],
        noGoals: repsWithEffort.map(r => r.name), // Placeholder - goals query not implemented for live view
      };
      
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
        
        const effort = calculateEffortScore(effortData, DEFAULT_EFFORT_THRESHOLDS);
        
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
      
      // Team goal status - placeholder for now
      const teamGoalStatus: TeamGoalStatus = {
        onPace: [],
        atRisk: [],
        behind: [],
        noGoals: repsWithEffort.map(r => r.name),
      };
      
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
  }, [isLiveView, liveQuery.data, insightsQuery.data]);

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
