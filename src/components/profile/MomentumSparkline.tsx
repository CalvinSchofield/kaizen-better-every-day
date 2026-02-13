import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";

interface MomentumSparklineProps {
  /** Array of FP+ values for each day worked, chronologically */
  dailyFp: number[];
  isOwnProfile: boolean;
}

export const MomentumSparkline = ({ dailyFp, isOwnProfile }: MomentumSparklineProps) => {
  if (!dailyFp || dailyFp.length < 2) return null;

  const data = dailyFp.map((fp, i) => ({ i, fp }));

  // Calculate a simple momentum indicator (last 5 vs previous 5)
  const recent5 = dailyFp.slice(-5);
  const prev5 = dailyFp.slice(-10, -5);
  const recentAvg = recent5.reduce((a, b) => a + b, 0) / (recent5.length || 1);
  const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / prev5.length : recentAvg;
  const trending = recentAvg >= prevAvg;

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
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            trending 
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
              : 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
          }`}>
            {trending ? '↑ Rising' : '↓ Cooling'}
          </span>
        )}
      </div>

      <div className="h-[60px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
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

      <div className="flex items-center justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">
          {dailyFp.length} days worked
        </span>
        {isOwnProfile && (
          <span className="text-[9px] text-muted-foreground">
            Avg {(dailyFp.reduce((a, b) => a + b, 0) / dailyFp.length).toFixed(1)} FP+/day
          </span>
        )}
      </div>
    </motion.div>
  );
};
