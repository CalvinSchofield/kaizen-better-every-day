import { AggregatedRankingsCard } from "./AggregatedRankingsCard";
import { LiveLeaderboard } from "./LiveLeaderboard";
import { LiveActivityCard } from "./LiveActivityCard";
import { LeaderGoalsCard } from "./LeaderGoalsCard";
import { LeaderPreseasonStandardsCard } from "./LeaderPreseasonStandardsCard";
import { TeamSummerAvailabilityCard } from "./TeamSummerAvailabilityCard";
import { RepRankingData } from "@/hooks/useTeamAggregatedRankings";

interface ReportsPeopleTabProps {
  // View type
  viewType: 'today' | 'yesterday' | 'aggregated';
  
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
  
  // Goals & availability
  userIds: string[];
  excludeUserIds: string[];
  accessibleReps: any[];
  showSummerAvailability?: boolean;
  
  // Date range for goals
  dateRange?: { start: string; end: string };
  datePreset?: 'today' | 'yesterday' | 'week' | 'month' | 'preseason' | 'ytd' | 'custom';
}

// Check if we're in preseason
const isPreseason = () => {
  const now = new Date();
  const summerStart = new Date("2026-04-12");
  return now < summerStart;
};

export const ReportsPeopleTab = ({
  viewType,
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
  userIds,
  excludeUserIds,
  accessibleReps,
  showSummerAvailability,
  dateRange,
  datePreset,
}: ReportsPeopleTabProps) => {
  const showPreseasonStandards = isPreseason();

  if (viewType === 'today') {
    return (
      <div className="space-y-4">
        <LiveActivityCard
          liveReps={liveReps || []}
          workingCount={workingCount || 0}
          forgottenCount={forgottenCount || 0}
          isLoading={liveLoading}
        />
        <LiveLeaderboard
          liveReps={liveReps || []}
          isLoading={liveLoading}
          hasWorkingReps={(workingCount || 0) > 0}
        />
        {showPreseasonStandards && (
          <LeaderPreseasonStandardsCard
            accessibleReps={accessibleReps}
            excludeUserIds={excludeUserIds}
          />
        )}
        <LeaderGoalsCard
          userIds={userIds}
          excludeUserIds={excludeUserIds}
          accessibleReps={accessibleReps}
          dateRange={dateRange}
          datePreset={datePreset}
        />
        {showSummerAvailability && <TeamSummerAvailabilityCard />}
      </div>
    );
  }

  if (viewType === 'yesterday') {
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
  return (
    <div className="space-y-4">
      <AggregatedRankingsCard
        reps={aggregatedReps || []}
        totalFP={totalFP || 0}
        totalPRMR={totalPRMR || 0}
        repCount={repCount || 0}
        isLoading={aggregatedLoading}
        title={rankingsTitle || "Rankings"}
      />
      {showPreseasonStandards && (
        <LeaderPreseasonStandardsCard
          accessibleReps={accessibleReps}
          excludeUserIds={excludeUserIds}
        />
      )}
      <LeaderGoalsCard
        userIds={userIds}
        excludeUserIds={excludeUserIds}
        accessibleReps={accessibleReps}
        dateRange={dateRange}
        datePreset={datePreset}
      />
      {showSummerAvailability && <TeamSummerAvailabilityCard />}
    </div>
  );
};
