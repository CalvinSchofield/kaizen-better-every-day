import { Card } from "@/components/ui/card";
import { ActivityTrendChart } from "@/components/insights/ActivityTrendChart";
import { BestPeriodsSection } from "./BestPeriodsSection";
import { TrendingUp, Clock, Calendar, Sparkles } from "lucide-react";

interface ReportsPatternsTabProps {
  insightsData?: {
    dailyTrend?: any[];
    hourlyActivity?: any;
    peakHours?: any;
    hourRange?: any;
    dayOfWeekData?: any;
    bestDayOfWeek?: any;
    mostProductiveHour?: number | null;
    bestPeriods?: any;
    averageStartTime?: string;
    averageEndTime?: string;
  };
  isLoading?: boolean;
}

export const ReportsPatternsTab = ({
  insightsData,
  isLoading,
}: ReportsPatternsTabProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Card key={i} className="p-4">
            <div className="h-5 w-32 bg-muted rounded animate-pulse mb-3" />
            <div className="h-32 bg-muted rounded animate-pulse" />
          </Card>
        ))}
      </div>
    );
  }

  if (!insightsData) {
    return (
      <Card className="p-6 text-center">
        <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
        <p className="font-medium">No pattern data</p>
        <p className="text-sm text-muted-foreground">Select a different date range</p>
      </Card>
    );
  }

  const hasActivityTrends = insightsData.dailyTrend && insightsData.dailyTrend.length > 0;
  const hasBestPeriods = insightsData.bestPeriods;

  return (
    <div className="space-y-4">
      {/* Activity Trends - No wrapper card since ActivityTrendChart has its own */}
      {hasActivityTrends && (
        <ActivityTrendChart dailyTrend={insightsData.dailyTrend!} />
      )}

      {/* Best Periods - Full component with group/individual/rookie filters */}
      {hasBestPeriods && (
        <Card className="overflow-hidden">
          <BestPeriodsSection 
            data={insightsData.bestPeriods} 
            dailyTrend={insightsData.dailyTrend}
          />
        </Card>
      )}

      {/* Timing Summary */}
      {(insightsData.averageStartTime || insightsData.averageEndTime) && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Average Work Times</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {insightsData.averageStartTime && (
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold">{insightsData.averageStartTime}</div>
                <div className="text-xs text-muted-foreground">Avg Start</div>
              </div>
            )}
            {insightsData.averageEndTime && (
              <div className="text-center p-3 bg-muted/30 rounded-lg">
                <div className="text-lg font-bold">{insightsData.averageEndTime}</div>
                <div className="text-xs text-muted-foreground">Avg End</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Day of Week Summary */}
      {insightsData.bestDayOfWeek && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Best Day of Week</h3>
          </div>
          <div className="text-center p-4 bg-primary/5 rounded-lg">
            <div className="text-2xl font-bold">{insightsData.bestDayOfWeek.day}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {insightsData.bestDayOfWeek.avgFp?.toFixed(2)} avg FP+ · {insightsData.bestDayOfWeek.daysWorked} days
            </div>
          </div>
        </Card>
      )}

      {/* Empty state if no patterns */}
      {!hasActivityTrends && !hasBestPeriods && !insightsData.averageStartTime && !insightsData.bestDayOfWeek && (
        <Card className="p-6 text-center">
          <Sparkles className="w-10 h-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-medium">Not enough data for patterns</p>
          <p className="text-sm text-muted-foreground">
            Patterns require multiple days of tracked activity
          </p>
        </Card>
      )}
    </div>
  );
};
