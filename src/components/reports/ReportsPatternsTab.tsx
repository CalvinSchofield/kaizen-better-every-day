import { Card } from "@/components/ui/card";
import { ActivityTrendChart } from "@/components/insights/ActivityTrendChart";
import { BestPeriodsSection } from "./BestPeriodsSection";
import { WorkScheduleVisualization } from "./WorkScheduleVisualization";
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
    workScheduleData?: Array<{
      userId: string;
      name: string;
      startMinutes: number;
      endMinutes: number;
      durationMinutes: number;
      fp: number;
      prmr: number;
      date?: string;
      timezone?: string;
    }>;
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

      {/* Work Schedule Visualization */}
      {insightsData.workScheduleData && insightsData.workScheduleData.length > 0 && (
        <WorkScheduleVisualization data={insightsData.workScheduleData} />
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
      {insightsData.dayOfWeekData && Object.keys(insightsData.dayOfWeekData).length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">FP+ by Day of Week</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Total team FP+ averaged per weekday
          </p>
          
          {/* Day comparison bars */}
          <div className="space-y-2">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => {
              const dayData = insightsData.dayOfWeekData?.[day];
              if (!dayData || dayData.count === 0) return null;
              
              const avgFp = dayData.fp / dayData.count;
              const maxAvg = Math.max(
                ...Object.values(insightsData.dayOfWeekData as Record<string, { fp: number; count: number }>)
                  .filter(d => d.count > 0)
                  .map(d => d.fp / d.count)
              );
              const widthPercent = maxAvg > 0 ? (avgFp / maxAvg) * 100 : 0;
              const isBest = avgFp === maxAvg && maxAvg > 0;
              
              return (
                <div key={day} className="flex items-center gap-2">
                  <div className="w-10 text-xs font-medium text-muted-foreground">{day}</div>
                  <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden relative">
                    <div 
                      className={`h-full rounded transition-all ${isBest ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      style={{ width: `${widthPercent}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className={`text-xs font-semibold ${isBest ? 'text-primary-foreground' : ''}`}>
                        {avgFp.toFixed(1)} FP+
                      </span>
                    </div>
                  </div>
                  <div className="w-16 text-xs text-muted-foreground text-right">
                    {dayData.count} day{dayData.count !== 1 ? 's' : ''}
                  </div>
                </div>
              );
            })}
          </div>
          
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Highlighted bar = best performing day
          </p>
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
