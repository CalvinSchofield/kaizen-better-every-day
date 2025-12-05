import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";

interface HourlyActivityChartProps {
  counterTimestamps?: Record<string, string[]>;
  workStartTime?: string;
  workEndTime?: string;
}

export const HourlyActivityChart = ({
  counterTimestamps,
  workStartTime,
  workEndTime,
}: HourlyActivityChartProps) => {
  const chartData = useMemo(() => {
    // Collect all timestamps
    const allTimestamps: Date[] = [];
    
    if (counterTimestamps) {
      Object.values(counterTimestamps).forEach(timestamps => {
        if (Array.isArray(timestamps)) {
          timestamps.forEach(ts => {
            allTimestamps.push(new Date(ts));
          });
        }
      });
    }

    if (allTimestamps.length === 0) return [];

    // Find min/max hours from work times or activity
    let minHour = 24;
    let maxHour = 0;
    
    if (workStartTime) {
      minHour = new Date(workStartTime).getHours();
    }
    if (workEndTime) {
      maxHour = new Date(workEndTime).getHours();
    }

    allTimestamps.forEach(ts => {
      const hour = ts.getHours();
      minHour = Math.min(minHour, hour);
      maxHour = Math.max(maxHour, hour);
    });

    // Create hour buckets
    const hourCounts: Record<number, number> = {};
    for (let h = minHour; h <= maxHour; h++) {
      hourCounts[h] = 0;
    }

    allTimestamps.forEach(ts => {
      const hour = ts.getHours();
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
  }, [counterTimestamps, workStartTime, workEndTime]);

  if (chartData.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        No activity data available
      </div>
    );
  }

  const maxCount = Math.max(...chartData.map(d => d.count));
  const bestHour = chartData.find(d => d.isMax);

  return (
    <div className="space-y-2">
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
                      <p className="text-muted-foreground">{data.count} activities</p>
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
          Most active at <span className="font-medium text-foreground">{bestHour.hour}</span> ({bestHour.count} activities)
        </p>
      )}
    </div>
  );
};
