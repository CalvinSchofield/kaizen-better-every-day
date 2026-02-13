import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, ReferenceLine } from "recharts";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface MomentumSparklineProps {
  /** Array of { date, fp } for each day worked, chronologically */
  dailyFp: { date: string; fp: number }[];
  isOwnProfile: boolean;
  /** Whether to display as EFP instead of FP+ */
  efpMode?: boolean;
}

export const MomentumSparkline = ({ dailyFp, isOwnProfile, efpMode }: MomentumSparklineProps) => {
  const { data, avg, trending, metricLabel } = useMemo(() => {
    if (!dailyFp || dailyFp.length < 2) {
      return { data: [], avg: 0, trending: true, metricLabel: 'FP+' };
    }

    const label = efpMode ? 'EFP' : 'FP+';

    // Format dates as short labels (e.g. "Jan 4")
    const formatted = dailyFp.map((d) => {
      const dateStr = typeof d.date === 'string' ? d.date : '';
      const dt = new Date(dateStr + 'T12:00:00');
      const isValid = !isNaN(dt.getTime());
      const month = isValid ? dt.toLocaleString('en-US', { month: 'short' }) : '?';
      const day = isValid ? dt.getDate() : '';
      return { label: `${month} ${day}`, fp: d.fp ?? 0 };
    });

    const values = dailyFp.map(d => d.fp ?? 0);
    const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    // Momentum: last 5 vs previous 5 average
    const recent5 = values.slice(-5);
    const prev5 = values.slice(-10, -5);
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / (recent5.length || 1);
    const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / prev5.length : recentAvg;

    return {
      data: formatted,
      avg: average,
      trending: recentAvg >= prevAvg,
      metricLabel: label,
    };
  }, [dailyFp, efpMode]);

  if (!dailyFp || dailyFp.length < 2 || data.length === 0) return null;

  // For non-own profiles, show fewer data points (last 20 max) for the "glimpse" feel
  const displayData = isOwnProfile ? data : data.slice(-20);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="mx-4 mb-4 rounded-2xl bg-card border border-border p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Momentum
          </span>
        </div>
        {isOwnProfile && (
          <span className={cn(
            "text-[10px] font-semibold px-2 py-0.5 rounded-full",
            trending
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
          )}>
            {trending ? '↑ Rising' : '↓ Cooling'}
          </span>
        )}
      </div>

      <div className="h-[80px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Average reference line — own profile only */}
            {isOwnProfile && (
              <ReferenceLine
                y={avg}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            )}
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={30}
            />
            <Area
              type="monotone"
              dataKey="fp"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#momentumGradient)"
              dot={false}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {isOwnProfile && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">
            {dailyFp.length} days worked
          </span>
          <span className="text-[9px] text-muted-foreground">
            Avg {avg.toFixed(1)} {metricLabel}/day
          </span>
        </div>
      )}
    </motion.div>
  );
};
