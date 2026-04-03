import { Area, AreaChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";

interface DailyDataPoint {
  date: string;
  doors: number;
  fp: number;
  prmr: number;
  presentations: number;
  hoursWorked: number;
}

interface ComparisonDailyPoint {
  date: string;
  fp: number;
  presentations: number;
}

interface ProductionTrendChartProps {
  data: DailyDataPoint[];
  comparisonData?: ComparisonDailyPoint[];
  comparisonLabel?: string;
  isLoading?: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-muted-foreground mb-1">
        {label ? format(parseISO(label), 'EEE, MMM d') : ''}
      </p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-bold text-foreground">
            {entry.dataKey === 'prmr' ? `$${entry.value.toLocaleString()}` : 
             (entry.dataKey === 'fp' || entry.dataKey === 'prevFp') ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const ProductionTrendChart = ({ data, comparisonData, comparisonLabel, isLoading }: ProductionTrendChartProps) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
        <div className="h-[180px] bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!data || data.length < 2) return null;

  // Merge comparison data by index (day offset alignment)
  const mergedData = data.map((d, i) => ({
    ...d,
    prevFp: comparisonData && comparisonData[i] ? comparisonData[i].fp : undefined,
    prevPres: comparisonData && comparisonData[i] ? comparisonData[i].presentations : undefined,
  }));

  const formatXAxis = (date: string) => {
    try { return format(parseISO(date), 'M/d'); } catch { return date; }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Production Trend</h3>
        {comparisonLabel && comparisonData && comparisonData.length > 0 && (
          <span className="text-[10px] text-muted-foreground/60">{comparisonLabel}</span>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={mergedData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
          <defs>
            <linearGradient id="fpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="prmrGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.2} />
              <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <XAxis 
            dataKey="date" 
            tickFormatter={formatXAxis} 
            className="text-[10px] fill-muted-foreground" 
            axisLine={false} 
            tickLine={false}
          />
          <YAxis 
            className="text-[10px] fill-muted-foreground" 
            axisLine={false} 
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />

          {/* Previous period FP+ overlay (dashed) */}
          {comparisonData && comparisonData.length > 0 && (
            <Line
              type="monotone"
              dataKey="prevFp"
              name={`Prior FP+`}
              stroke="hsl(var(--primary))"
              strokeWidth={1}
              strokeDasharray="4 3"
              strokeOpacity={0.35}
              dot={false}
              activeDot={false}
              animationDuration={600}
            />
          )}

          <Area
            type="monotone"
            dataKey="fp"
            name="FP+"
            stroke="hsl(var(--primary))"
            strokeWidth={2.5}
            fill="url(#fpGrad)"
            dot={{ r: 3, fill: "hsl(var(--primary))", strokeWidth: 0 }}
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="presentations"
            name="Presentations"
            stroke="hsl(142, 76%, 36%)"
            strokeWidth={1.5}
            fill="url(#prmrGrad)"
            dot={false}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center gap-4 justify-center">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded bg-primary" />
          <span className="text-[10px] text-muted-foreground font-medium">FP+</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded" style={{ background: "hsl(142, 76%, 36%)" }} />
          <span className="text-[10px] text-muted-foreground font-medium">Presentations</span>
        </div>
        {comparisonData && comparisonData.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 rounded bg-primary opacity-35" style={{ borderTop: '1px dashed' }} />
            <span className="text-[10px] text-muted-foreground font-medium">Prior FP+</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};
