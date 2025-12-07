import { LeaderPreseasonStandardsCard } from "./LeaderPreseasonStandardsCard";
import { LeaderGoalsCard } from "./LeaderGoalsCard";
import { TeamSummerAvailabilityCard } from "./TeamSummerAvailabilityCard";

interface ReportsReadinessTabProps {
  userIds: string[];
  excludeUserIds: string[];
  accessibleReps: any[];
  accessLevel?: 'area_director' | 'mgmt_group_lead' | 'team_lead' | 'none';
}

export const ReportsReadinessTab = ({
  userIds,
  excludeUserIds,
  accessibleReps,
  accessLevel = 'none',
}: ReportsReadinessTabProps) => {
  return (
    <div className="space-y-4">
      <LeaderPreseasonStandardsCard
        accessibleReps={accessibleReps}
        excludeUserIds={excludeUserIds}
        accessLevel={accessLevel}
      />
      <LeaderGoalsCard
        userIds={userIds}
        excludeUserIds={excludeUserIds}
        accessibleReps={accessibleReps}
      />
      <TeamSummerAvailabilityCard />
    </div>
  );
};
