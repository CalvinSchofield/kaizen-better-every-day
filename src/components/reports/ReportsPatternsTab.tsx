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
            Average FP+ per rep when they work on each day
          </p>
          
          <div className="space-y-2">
            {[
              { short: 'Mon', key: 'monday' },
              { short: 'Tue', key: 'tuesday' },
              { short: 'Wed', key: 'wednesday' },
              { short: 'Thu', key: 'thursday' },
              { short: 'Fri', key: 'friday' },
              { short: 'Sat', key: 'saturday' },
            ].map(({ short, key }) => {
              const dayData = insightsData.dayOfWeekData?.[key];
              if (!dayData || dayData.daysWorked === 0) return null;
              
              const avgFp = dayData.avgFp || 0;
              const allDays = Object.values(insightsData.dayOfWeekData as Record<string, { avgFp: number; daysWorked: number }>)
                .filter(d => d.daysWorked > 0);
              const maxAvg = allDays.length > 0 ? Math.max(...allDays.map(d => d.avgFp || 0)) : 0;
              const widthPercent = maxAvg > 0 ? (avgFp / maxAvg) * 100 : 0;
              const isBest = avgFp === maxAvg && maxAvg > 0;
              
              return (
                <div key={key} className="flex items-center gap-2">
                  <div className="w-10 text-xs font-medium text-muted-foreground">{short}</div>
                  <div className="flex-1 h-6 bg-muted/30 rounded overflow-hidden relative">
                    <div 
                      className={`h-full rounded transition-all ${isBest ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                      style={{ width: `${widthPercent}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className={`text-xs font-semibold ${isBest ? 'text-primary-foreground' : ''}`}>
                        {avgFp.toFixed(1)} FP+/rep
                      </span>
                    </div>
                  </div>
                  <div className="w-20 text-xs text-muted-foreground text-right">
                    {dayData.daysWorked} entries
                  </div>
                </div>
              );
            })}
          </div>
          
          <p className="text-xs text-muted-foreground mt-3">
            "Entries" = number of rep work days (e.g., 5 reps working one Tuesday = 5 entries)
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
