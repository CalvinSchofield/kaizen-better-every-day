import { Area, AreaChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface ComparisonSparklineProps {
  currentData: Array<{ day: number; value: number }>;
  previousData: Array<{ day: number; value: number }>;
  currentLabel: string;
  previousLabel: string;
  metric: string;
}

export const ComparisonSparkline = ({ 
  currentData, 
  previousData, 
  currentLabel, 
  previousLabel,
  metric 
}: ComparisonSparklineProps) => {
  if (!currentData || currentData.length === 0) return null;

  // Merge data for comparison - align by day number
  const maxDays = Math.max(
    currentData.length,
    previousData.length
  );

  const mergedData = Array.from({ length: maxDays }, (_, i) => {
    const dayNum = i + 1;
    const current = currentData.find(d => d.day === dayNum);
    const previous = previousData.find(d => d.day === dayNum);
    
    return {
      day: dayNum,
      current: current?.value ?? null,
      previous: previous?.value ?? null,
    };
  });

  return (
    <div className="space-y-1">
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={mergedData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <XAxis 
            dataKey="day" 
            tick={{ fontSize: 10 }} 
            tickFormatter={(day) => `D${day}`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number, name: string) => {
              if (value === null) return ['-', name];
              return [value.toFixed(1), name === 'current' ? currentLabel : previousLabel];
            }}
            labelFormatter={(day) => `Day ${day}`}
          />
          {/* Previous period - dashed line */}
          <Line
            type="monotone"
            dataKey="previous"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            connectNulls={false}
            animationDuration={600}
          />
          {/* Current period - solid line */}
          <Line
            type="monotone"
            dataKey="current"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
            connectNulls={false}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex justify-center gap-4 text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-primary rounded" />
          <span>{currentLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-0.5 bg-muted-foreground rounded" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(var(--muted-foreground)) 0, hsl(var(--muted-foreground)) 2px, transparent 2px, transparent 4px)' }} />
          <span>{previousLabel}</span>
        </div>
      </div>
    </div>
  );
};
