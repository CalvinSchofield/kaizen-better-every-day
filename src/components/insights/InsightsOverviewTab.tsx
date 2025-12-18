import { InsightsSummaryHero } from './InsightsSummaryHero';
import { FPCumulativeChart } from '@/components/FPCumulativeChart';
import { CanceledStatsCard } from '@/components/goals/CanceledStatsCard';
import { PastRecapsSection } from '@/components/recap/PastRecapsSection';
import { InsightsData } from '@/hooks/useInsightsData';

interface InsightsOverviewTabProps {
  insights: InsightsData;
  dateRange: { start: Date; end: Date };
  efpModeEnabled: boolean;
}

export const InsightsOverviewTab = ({
  insights,
  dateRange,
  efpModeEnabled,
}: InsightsOverviewTabProps) => {
  return (
    <div className="space-y-4">
      {/* Past Recaps Section */}
      <PastRecapsSection />

      {/* Hero Summary */}
      <InsightsSummaryHero
        totalFp={insights.totalFp}
        totalEfp={insights.totalEfp}
        totalPrmr={insights.totalPrmr}
        daysWorked={insights.daysWorked}
        totalDoors={insights.totalDoors}
        totalCloses={insights.totalCloses}
        efpModeEnabled={efpModeEnabled}
      />

      {/* Cancelled Stats */}
      <CanceledStatsCard />

      {/* Progress Over Time */}
      <FPCumulativeChart highlightDateRange={dateRange} />
    </div>
  );
};
