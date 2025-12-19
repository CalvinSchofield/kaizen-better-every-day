import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { Button } from "@/components/ui/button";

interface HourlyActivityChartProps {
  counterTimestamps?: Record<string, string[]>;
  workStartTime?: string;
  workEndTime?: string;
  timezone?: string;
}

type ActivityType = 'all' | 'doors_knocked' | 'decision_makers' | 'pitches' | 'transitions' | 'presentations' | 'closes';

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  all: 'All',
  doors_knocked: 'Doors',
  decision_makers: 'DMs',
  pitches: 'Pitches',
  transitions: 'Trans',
  presentations: 'Pres',
  closes: 'Closes'
};

// Get hour in a specific timezone
const getHourInTimezone = (timestamp: string, timezone: string): number => {
  try {
    const date = new Date(timestamp);
    const localTime = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    }).format(date);
    const hour = parseInt(localTime);
    // Debug first timestamp only
    if (timestamp.includes('18:51')) {
      console.log(`[DEBUG] Converting ${timestamp} with timezone ${timezone} => hour ${hour}`);
    }
    return hour;
  } catch (e) {
    console.error('[DEBUG] Timezone conversion error:', e, 'for timezone:', timezone);
    return new Date(timestamp).getHours();
  }
};

export const HourlyActivityChart = ({
  counterTimestamps,
  workStartTime,
  workEndTime,
  timezone = 'America/Los_Angeles',
}: HourlyActivityChartProps) => {
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('all');
  
  // Debug: Log what timezone we're receiving
  console.log('[HourlyActivityChart] timezone prop:', timezone, '| counterTimestamps keys:', counterTimestamps ? Object.keys(counterTimestamps) : 'none');
  
  // Get available activities (ones that have timestamps)
  const availableActivities = useMemo(() => {
    if (!counterTimestamps) return ['all'] as ActivityType[];
    
    const available: ActivityType[] = ['all'];
    const keys: ActivityType[] = ['doors_knocked', 'decision_makers', 'pitches', 'transitions', 'presentations', 'closes'];
    
    keys.forEach(key => {
      const timestamps = counterTimestamps[key];
      if (timestamps && Array.isArray(timestamps) && timestamps.length > 0) {
        available.push(key);
      }
    });
    
    return available;
  }, [counterTimestamps]);

  const chartData = useMemo(() => {
    // Collect timestamps based on selected activity
    const allTimestampStrings: string[] = [];
    
    if (counterTimestamps) {
      if (selectedActivity === 'all') {
        Object.values(counterTimestamps).forEach(timestamps => {
          if (Array.isArray(timestamps)) {
            timestamps.forEach(ts => {
              allTimestampStrings.push(ts);
            });
          }
        });
      } else {
        const timestamps = counterTimestamps[selectedActivity];
        if (Array.isArray(timestamps)) {
          timestamps.forEach(ts => {
            allTimestampStrings.push(ts);
          });
        }
      }
    }

    if (allTimestampStrings.length === 0) return [];

    // Find min/max hours from work times or activity - using rep's timezone
    let minHour = 24;
    let maxHour = 0;
    
    if (workStartTime) {
      minHour = getHourInTimezone(workStartTime, timezone);
    }
    if (workEndTime) {
      maxHour = getHourInTimezone(workEndTime, timezone);
    }

    allTimestampStrings.forEach(ts => {
      const hour = getHourInTimezone(ts, timezone);
      minHour = Math.min(minHour, hour);
      maxHour = Math.max(maxHour, hour);
    });

    // Create hour buckets
    const hourCounts: Record<number, number> = {};
    for (let h = minHour; h <= maxHour; h++) {
      hourCounts[h] = 0;
    }

    allTimestampStrings.forEach(ts => {
      const hour = getHourInTimezone(ts, timezone);
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    // Find max for highlighting
    const maxCount = Math.max(...Object.values(hourCounts));

    // Convert to chart format
    return Object.entries(hourCounts).map(([hour, count]) => {
      const h = parseInt(hour);
      const period = h >= 12 ? 'PM' : 'AM';
      const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
      return {
        hour: `${displayHour}${period}`,
        count,
        isMax: count === maxCount && count > 0,
      };
    });
  }, [counterTimestamps, workStartTime, workEndTime, selectedActivity, timezone]);

  if (!counterTimestamps || Object.keys(counterTimestamps).length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No activity data available
      </div>
    );
  }

  const maxCount = chartData.length > 0 ? Math.max(...chartData.map(d => d.count)) : 0;
  const bestHour = chartData.find(d => d.isMax);
  const totalCount = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-3">
      {/* Activity type filter */}
      {availableActivities.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {availableActivities.map(activity => (
            <Button
              key={activity}
              variant={selectedActivity === activity ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedActivity(activity)}
              className="h-7 px-2.5 text-xs"
            >
              {ACTIVITY_LABELS[activity]}
            </Button>
          ))}
        </div>
      )}

      {chartData.length > 0 ? (
        <>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <XAxis 
                  dataKey="hour" 
                  tick={{ fontSize: 10 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis hide domain={[0, Math.ceil(maxCount * 1.1)]} />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-popover border border-border rounded-lg px-2 py-1 text-xs shadow-lg">
                          <p className="font-medium">{data.hour}</p>
                          <p className="text-muted-foreground">
                            {data.count} {selectedActivity === 'all' ? 'activities' : ACTIVITY_LABELS[selectedActivity].toLowerCase()}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`}
                      fill={entry.isMax ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {bestHour && (
            <p className="text-xs text-muted-foreground text-center">
              Most {selectedActivity === 'all' ? 'active' : ACTIVITY_LABELS[selectedActivity].toLowerCase()} at{' '}
              <span className="font-medium text-foreground">{bestHour.hour}</span>{' '}
              ({bestHour.count} of {totalCount})
            </p>
          )}
        </>
      ) : (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No {selectedActivity === 'all' ? 'activity' : ACTIVITY_LABELS[selectedActivity].toLowerCase()} data
        </div>
      )}
    </div>
  );
};
