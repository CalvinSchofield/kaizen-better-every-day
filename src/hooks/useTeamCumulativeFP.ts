import { useMemo } from "react";
import { useTeamInsightsData } from "./useTeamInsightsData";
import { useEfpMode } from "./useEfpMode";

export interface TeamCumulativeDataPoint {
  date: string;
  cumulative: number;
  movingAvg6: number | null;
  movingAvg12: number | null;
  dailyValue: number;
  cumulativePrmr: number;
  movingAvgPrmr6: number | null;
  movingAvgPrmr12: number | null;
  dailyPrmr: number;
  cumulativeFp: number;
  movingAvgFp6: number | null;
  movingAvgFp12: number | null;
  dailyFp: number;
}

interface UseTeamCumulativeFPParams {
  userIds: string[];
  dateRange: { start: string; end: string };
  excludeUserIds?: string[];
}

export const useTeamCumulativeFP = ({ userIds, dateRange, excludeUserIds }: UseTeamCumulativeFPParams) => {
  const { efpModeEnabled, calculateEfp } = useEfpMode();
  const { data: insightsData, isLoading } = useTeamInsightsData({
    userIds,
    dateRange,
    excludeUserIds,
  });

  const cumulativeData = useMemo(() => {
    if (!insightsData?.dailyTrend || insightsData.dailyTrend.length === 0) {
      return [];
    }

    const dataPoints: TeamCumulativeDataPoint[] = [];
    let cumulative = 0;
    let cumulativePrmr = 0;
    let cumulativeFp = 0;

    insightsData.dailyTrend.forEach((trend, index) => {
      // Team insights aggregates total PRMR, so prmr field IS total PRMR
      const totalPrmr = trend.prmr || 0;
      const fpValue = trend.fp || 0;
      
      const value = efpModeEnabled 
        ? calculateEfp(totalPrmr)
        : fpValue;
      
      cumulative += value;
      cumulativePrmr += totalPrmr;
      cumulativeFp += fpValue;

      // Calculate 6-day moving average
      const last6 = insightsData.dailyTrend.slice(Math.max(0, index - 5), index + 1);
      const movingAvg6 = last6.length >= 1
        ? last6.reduce((sum, e) => {
            const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp || 0);
            return sum + v;
          }, 0) / last6.length
        : null;

      const movingAvgPrmr6 = last6.length >= 1
        ? last6.reduce((sum, e) => sum + (e.prmr || 0), 0) / last6.length
        : null;

      // Calculate 12-day moving average
      const last12 = insightsData.dailyTrend.slice(Math.max(0, index - 11), index + 1);
      const movingAvg12 = last12.length >= 1
        ? last12.reduce((sum, e) => {
            const v = efpModeEnabled ? calculateEfp(e.prmr || 0) : (e.fp || 0);
            return sum + v;
          }, 0) / last12.length
        : null;

      const movingAvgPrmr12 = last12.length >= 1
        ? last12.reduce((sum, e) => sum + (e.prmr || 0), 0) / last12.length
        : null;

      // Calculate FP+ moving averages
      const movingAvgFp6 = last6.length >= 1
        ? last6.reduce((sum, e) => sum + (e.fp || 0), 0) / last6.length
        : null;

      const movingAvgFp12 = last12.length >= 1
        ? last12.reduce((sum, e) => sum + (e.fp || 0), 0) / last12.length
        : null;

      dataPoints.push({
        date: trend.date,
        cumulative,
        movingAvg6,
        movingAvg12,
        dailyValue: value,
        cumulativePrmr,
        movingAvgPrmr6,
        movingAvgPrmr12,
        dailyPrmr: totalPrmr,
        cumulativeFp,
        movingAvgFp6,
        movingAvgFp12,
        dailyFp: fpValue,
      });
    });

    return dataPoints;
  }, [insightsData, efpModeEnabled, calculateEfp]);

  return {
    data: cumulativeData,
    isLoading,
  };
};
