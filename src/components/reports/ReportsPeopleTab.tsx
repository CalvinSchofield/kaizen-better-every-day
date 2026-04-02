import { AggregatedRankingsCard } from "./AggregatedRankingsCard";
import { LiveLeaderboard } from "./LiveLeaderboard";
import { RookieCohortCard } from "./RookieCohortCard";
import { OrgGroupedRepList, OrgRepData } from "./OrgGroupedRepList";
import { RepRankingData } from "@/hooks/useTeamAggregatedRankings";
import { RepGoals } from "@/hooks/useRepGoals";
import { AccessLevel, hasMinAccess } from "@/utils/roleHierarchy";
import { useMemo } from "react";
import { CoachingAlerts } from "./v2/CoachingAlerts";
interface ReportsPeopleTabProps {
  // View type
  viewType: 'today' | 'yesterday' | 'aggregated';
  
  // Access level for org-aware grouping
  accessLevel?: AccessLevel;
  
  // Today/Live data
  liveReps?: any[];
  workingCount?: number;
  forgottenCount?: number;
  liveLoading?: boolean;
  
  // Yesterday data
  yesterdayReps?: any[];
  yesterdayLoading?: boolean;
  
  // Aggregated data
  aggregatedReps?: RepRankingData[];
  totalFP?: number;
  totalPRMR?: number;
  repCount?: number;
  aggregatedLoading?: boolean;
  rankingsTitle?: string;
  
  // Goals data for plateau detection (optional)
  allGoals?: RepGoals[];
}

export const ReportsPeopleTab = ({
  viewType,
  accessLevel = 'team_lead',
  liveReps,
  workingCount,
  forgottenCount,
  liveLoading,
  yesterdayReps,
  yesterdayLoading,
  aggregatedReps,
  totalFP,
  totalPRMR,
  repCount,
  aggregatedLoading,
  rankingsTitle,
  allGoals,
}: ReportsPeopleTabProps) => {
  // Use org-grouped view for mgmt_group_lead+ or manager
  const useOrgGrouping = hasMinAccess(accessLevel, 'mgmt_group_lead') || 
                          accessLevel === 'manager' ||
                          accessLevel === 'area_director';

  // Transform live reps to OrgRepData
  const liveOrgReps: OrgRepData[] = useMemo(() => {
    if (!liveReps) return [];
    return liveReps.map((r: any) => ({
      userId: r.userId,
      name: r.name,
      year: r.year,
      teamId: r.teamId,
      teamName: r.teamName,
      mgmtGroupId: r.mgmtGroupId,
      mgmtGroupName: r.mgmtGroupName,
      fp: r.todayStats?.fp || 0,
      prmr: r.todayStats?.prmr || 0,
      doors: r.todayStats?.doors || 0,
      presentations: r.todayStats?.presentations || 0,
      transitions: r.todayStats?.transitions || 0,
      pitches: r.todayStats?.pitches || 0,
      isWorking: r.isWorking,
    }));
  }, [liveReps]);

  // Transform yesterday reps to OrgRepData
  const yesterdayOrgReps: OrgRepData[] = useMemo(() => {
    if (!yesterdayReps) return [];
    return yesterdayReps.map((r: any) => ({
      userId: r.userId,
      name: r.name,
      year: r.year,
      teamId: r.teamId,
      teamName: r.teamName,
      mgmtGroupId: r.mgmtGroupId,
      mgmtGroupName: r.mgmtGroupName,
      fp: r.stats?.fp || 0,
      prmr: r.stats?.prmr || 0,
      doors: r.stats?.doors || 0,
      presentations: r.stats?.presentations || 0,
      transitions: r.stats?.transitions || 0,
      pitches: r.stats?.pitches || 0,
      isWorking: false,
    }));
  }, [yesterdayReps]);

  // Transform aggregated reps to OrgRepData
  const aggregatedOrgReps: OrgRepData[] = useMemo(() => {
    if (!aggregatedReps) return [];
    return aggregatedReps.map(r => ({
      userId: r.userId,
      name: r.name,
      year: r.year,
      teamId: r.teamId,
      teamName: r.teamName,
      mgmtGroupId: r.mgmtGroupId,
      mgmtGroupName: r.mgmtGroupName,
      fp: r.stats.fp,
      prmr: r.stats.prmr,
      doors: r.stats.doors,
      presentations: r.stats.presentations,
      transitions: r.stats.transitions,
      pitches: r.stats.pitches,
      hoursWorked: r.hoursWorked,
      daysWorked: r.daysWorked,
    }));
  }, [aggregatedReps]);

  if (viewType === 'today') {
    if (useOrgGrouping) {
      return (
        <div className="space-y-4">
          <OrgGroupedRepList
            reps={liveOrgReps}
            accessLevel={accessLevel}
            isLoading={liveLoading}
            emptyMessage="No one working yet today"
          />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <LiveLeaderboard
          liveReps={liveReps || []}
          isLoading={liveLoading}
          hasWorkingReps={(workingCount || 0) > 0}
          workingCount={workingCount}
          forgottenCount={forgottenCount}
        />
      </div>
    );
  }

  if (viewType === 'yesterday') {
    if (useOrgGrouping) {
      return (
        <div className="space-y-4">
          <OrgGroupedRepList
            reps={yesterdayOrgReps}
            accessLevel={accessLevel}
            isLoading={yesterdayLoading}
            emptyMessage="No activity data from yesterday"
          />
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <LiveLeaderboard
          liveReps={yesterdayReps?.map(r => ({
            ...r,
            isWorking: false,
            hasForgottenEntry: false,
            todayStats: r.stats,
            durationMinutes: r.durationMinutes || 0,
            teamName: r.teamName || '',
          })) || []}
          isLoading={yesterdayLoading}
          hasWorkingReps={false}
          title="Yesterday's Rankings"
        />
      </div>
    );
  }

  // Aggregated view (week/month/season/ytd)
  if (useOrgGrouping) {
    return (
      <div className="space-y-4">
        <RookieCohortCard reps={aggregatedReps || []} />
        <OrgGroupedRepList
          reps={aggregatedOrgReps}
          accessLevel={accessLevel}
          isLoading={aggregatedLoading}
          emptyMessage="No activity data for this period"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rookie Cohort Comparison */}
      <RookieCohortCard reps={aggregatedReps || []} />
      
      {/* Main Rankings */}
      <AggregatedRankingsCard
        reps={aggregatedReps || []}
        totalFP={totalFP || 0}
        totalPRMR={totalPRMR || 0}
        repCount={repCount || 0}
        isLoading={aggregatedLoading}
        title={rankingsTitle || "Rankings"}
      />
    </div>
  );
};
