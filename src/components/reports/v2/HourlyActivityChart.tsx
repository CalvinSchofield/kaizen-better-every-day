import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { motion } from "framer-motion";

interface HourlyActivityChartProps {
  hourlyActivity: {
    doors: Record<number, number>;
    presentations: Record<number, number>;
    closes: Record<number, number>;
  };
  isLoading?: boolean;
}

const formatHour = (h: number) => {
  const ampm = h >= 12 ? 'p' : 'a';
  const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}${ampm}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1">{formatHour(label)}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export const HourlyActivityChart = ({ hourlyActivity, isLoading }: HourlyActivityChartProps) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
        <div className="h-[140px] bg-muted animate-pulse rounded" />
      </div>
    );
  }

  // Build chart data from hourly activity
  const chartData: { hour: number; doors: number }[] = [];
  let maxDoors = 0;
  
  for (let h = 7; h <= 21; h++) {
    const doors = hourlyActivity.doors[h] || 0;
    if (doors > maxDoors) maxDoors = doors;
    chartData.push({ hour: h, doors });
  }

  // Find peak hour
  const peakHour = chartData.reduce((max, d) => d.doors > max.doors ? d : max, chartData[0]);

  if (maxDoors === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Activity by Hour</h3>
        {peakHour && peakHour.doors > 0 && (
          <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
            Peak: {formatHour(peakHour.hour)}
          </span>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
          <XAxis 
            dataKey="hour" 
            tickFormatter={formatHour} 
            className="text-[9px] fill-muted-foreground" 
            axisLine={false} 
            tickLine={false}
            interval="preserveStartEnd"
            tick={{ fontSize: 9 }}
          />
          <YAxis 
            className="text-[9px] fill-muted-foreground" 
            axisLine={false} 
            tickLine={false}
            width={30}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="doors" 
            name="Doors" 
            radius={[4, 4, 0, 0]}
            animationDuration={600}
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.hour === peakHour?.hour 
                  ? "hsl(var(--primary))" 
                  : "hsl(var(--primary) / 0.3)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};
