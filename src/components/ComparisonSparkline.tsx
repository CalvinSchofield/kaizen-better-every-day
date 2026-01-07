import { Area, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

interface ComparisonSparklineProps {
  currentData: Array<{ day: number; value: number }>;
  previousData: Array<{ day: number; value: number }>;
  currentLabel: string;
  previousLabel: string;
  metric: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string }>;
  label?: number;
  currentLabel: string;
  previousLabel: string;
}

const CustomComparisonTooltip = ({ active, payload, label, currentLabel, previousLabel }: CustomTooltipProps) => {
  if (!active || !payload) return null;

  const currentValue = payload.find(p => p.dataKey === 'current')?.value;
  const previousValue = payload.find(p => p.dataKey === 'previous')?.value;

  return (
    <div className="bg-card border border-border rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1.5 font-medium">Day {label}</p>
      <div className="space-y-1">
        {currentValue !== null && currentValue !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">{currentLabel}:</span>
            <span className="text-xs font-semibold text-foreground">{currentValue.toFixed(1)}</span>
          </div>
        )}
        {previousValue !== null && previousValue !== undefined && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">{previousLabel}:</span>
            <span className="text-xs font-medium text-muted-foreground">{previousValue.toFixed(1)}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export const ComparisonSparkline = ({ 
  currentData, 
  previousData, 
  currentLabel, 
  previousLabel,
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

  // Find the last index with current data for endpoint dot
  const lastCurrentIndex = mergedData.reduceRight((acc, item, index) => {
    if (acc === -1 && item.current !== null) return index;
    return acc;
  }, -1);

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={120}>
        <ComposedChart data={mergedData} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="currentGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="previousGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.08} />
              <stop offset="95%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <XAxis 
            dataKey="day" 
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} 
            tickFormatter={(day) => `D${day}`}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide domain={['auto', 'auto']} />
          
          <Tooltip
            content={
              <CustomComparisonTooltip 
                currentLabel={currentLabel} 
                previousLabel={previousLabel} 
              />
            }
          />
          
          {/* Previous period - subtle area fill with dashed line */}
          <Area
            type="monotone"
            dataKey="previous"
            fill="url(#previousGradient)"
            stroke="none"
            connectNulls={false}
            animationDuration={600}
            animationBegin={100}
          />
          <Line
            type="monotone"
            dataKey="previous"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            strokeDasharray="6 4"
            strokeOpacity={0.5}
            dot={false}
            activeDot={false}
            connectNulls={false}
            animationDuration={600}
            animationBegin={100}
          />
          
          {/* Current period - gradient area with solid line */}
          <Area
            type="monotone"
            dataKey="current"
            fill="url(#currentGradient)"
            stroke="none"
            connectNulls={false}
            animationDuration={800}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, index, payload } = props;
              // Only show dot on the last data point with current value
              if (index !== lastCurrentIndex || payload.current === null) return <></>;
              return (
                <circle 
                  cx={cx} 
                  cy={cy} 
                  r={5} 
                  fill="hsl(var(--primary))" 
                  stroke="hsl(var(--background))" 
                  strokeWidth={2} 
                />
              );
            }}
            activeDot={{ r: 6, strokeWidth: 0, fill: 'hsl(var(--primary))' }}
            connectNulls={false}
            animationDuration={800}
          />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Legend */}
      <div className="flex justify-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-xs text-muted-foreground font-medium">{currentLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-muted-foreground/40 border border-muted-foreground/30 border-dashed" />
          <span className="text-xs text-muted-foreground">{previousLabel}</span>
        </div>
      </div>
    </div>
  );
};
