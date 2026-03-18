import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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

interface ProductionTrendChartProps {
  data: DailyDataPoint[];
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
             entry.dataKey === 'fp' ? entry.value.toFixed(1) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export const ProductionTrendChart = ({ data, isLoading }: ProductionTrendChartProps) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="h-5 w-40 bg-muted animate-pulse rounded mb-3" />
        <div className="h-[180px] bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!data || data.length < 2) return null;

  const formatXAxis = (date: string) => {
    try { return format(parseISO(date), 'M/d'); } catch { return date; }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/50 bg-card p-4 space-y-3"
    >
      <h3 className="text-sm font-semibold text-muted-foreground">Production Trend</h3>
      
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
      </div>
    </motion.div>
  );
};
