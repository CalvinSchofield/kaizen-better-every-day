import { AggregatedRankingsCard } from "./AggregatedRankingsCard";
import { LiveLeaderboard } from "./LiveLeaderboard";
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
}

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
}: ReportsPeopleTabProps) => {
  if (viewType === 'today') {
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
    </div>
  );
};
