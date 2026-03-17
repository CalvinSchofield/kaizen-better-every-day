import { useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, ReferenceLine } from "recharts";

import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

type MetricMode = 'fp' | 'prmr';

interface MomentumSparklineProps {
  dailyFp: { date: string; fp: number; prmr: number }[];
  isOwnProfile: boolean;
}

export const MomentumSparkline = ({ dailyFp, isOwnProfile }: MomentumSparklineProps) => {
  const [mode, setMode] = useState<MetricMode>('fp');

  const { data, avg, trending, metricLabel, daysWorked } = useMemo(() => {
    if (!dailyFp || dailyFp.length < 2) {
      return { data: [], avg: 0, trending: true, metricLabel: 'FP+', daysWorked: 0 };
    }

    const label = mode === 'prmr' ? 'PRMR' : 'FP+';

    // Only include days with actual production for chart readability
    const productiveDays = dailyFp.filter(d => (d.fp ?? 0) > 0 || (d.prmr ?? 0) > 0);

    const formatted = productiveDays.map((d) => {
      const dateStr = String(d.date || '');
      // Parse YYYY-MM-DD safely
      const parts = dateStr.split('-');
      let labelStr = '?';
      if (parts.length === 3) {
        const monthNum = parseInt(parts[1], 10);
        const dayNum = parseInt(parts[2], 10);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
          labelStr = `${months[monthNum - 1]} ${dayNum}`;
        }
      }
      const value = mode === 'prmr' ? (d.prmr ?? 0) : (d.fp ?? 0);
      return { label: labelStr, value };
    });

    const values = formatted.map(d => d.value);
    const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    const recent5 = values.slice(-5);
    const prev5 = values.slice(-10, -5);
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / (recent5.length || 1);
    const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / prev5.length : recentAvg;

    return {
      data: formatted,
      avg: average,
      trending: recentAvg >= prevAvg,
      metricLabel: label,
      daysWorked: dailyFp.length,
    };
  }, [dailyFp, mode]);

  if (!dailyFp || dailyFp.length < 2 || data.length === 0) return null;

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
        <div className="flex items-center gap-2">
          {/* FP+ / PRMR toggle */}
          <div className="flex rounded-full bg-muted/60 p-0.5">
            <button
              onClick={() => setMode('fp')}
              className={cn(
                "text-[9px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                mode === 'fp'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              FP+
            </button>
            <button
              onClick={() => setMode('prmr')}
              className={cn(
                "text-[9px] font-semibold px-2 py-0.5 rounded-full transition-colors",
                mode === 'prmr'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground'
              )}
            >
              PRMR
            </button>
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
      </div>

      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={displayData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
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
              dataKey="value"
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
            {daysWorked} days worked
          </span>
          <span className="text-[9px] text-muted-foreground">
            Avg {mode === 'prmr' ? `$${Math.round(avg).toLocaleString()}` : avg.toFixed(2)} {metricLabel}/day
          </span>
        </div>
      )}
    </motion.div>
  );
};
