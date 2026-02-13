import { useMemo } from "react";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface MomentumHeatmapProps {
  /** FP+ values for each day worked, chronologically */
  dailyFp: number[];
  isOwnProfile: boolean;
}

const LEVEL_CLASSES: Record<number, string> = {
  0: 'bg-muted/30',
  1: 'bg-emerald-200 dark:bg-emerald-900',
  2: 'bg-emerald-400 dark:bg-emerald-700',
  3: 'bg-emerald-500 dark:bg-emerald-600',
  4: 'bg-emerald-700 dark:bg-emerald-400',
};

export const MomentumHeatmap = ({ dailyFp, isOwnProfile }: MomentumHeatmapProps) => {
  const { grid, avg, trending } = useMemo(() => {
    if (!dailyFp || dailyFp.length < 2) {
      return { grid: [] as number[][], avg: 0, trending: true };
    }
    const average = dailyFp.reduce((a, b) => a + b, 0) / dailyFp.length;

    // Assign level based on ratio to average
    const levels = dailyFp.map((fp) => {
      if (fp <= 0) return 0;
      const ratio = fp / (average || 1);
      if (ratio < 0.5) return 1;
      if (ratio < 1) return 2;
      if (ratio < 1.5) return 3;
      return 4;
    });

    // Arrange into a grid: 7 rows (like days of week), columns fill left-to-right
    const numRows = 7;
    const cols = Math.ceil(levels.length / numRows);
    const gridData: number[][] = [];

    for (let row = 0; row < numRows; row++) {
      const rowData: number[] = [];
      for (let col = 0; col < cols; col++) {
        const idx = col * numRows + row;
        rowData.push(idx < levels.length ? levels[idx] : -1); // -1 = empty
      }
      gridData.push(rowData);
    }

    // Momentum: last 5 vs previous 5 average
    const recent5 = dailyFp.slice(-5);
    const prev5 = dailyFp.slice(-10, -5);
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / (recent5.length || 1);
    const prevAvg = prev5.length > 0 ? prev5.reduce((a, b) => a + b, 0) / prev5.length : recentAvg;

    return {
      grid: gridData,
      avg: average,
      trending: recentAvg >= prevAvg,
    };
  }, [dailyFp]);

  if (!dailyFp || dailyFp.length < 2 || grid.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.15 }}
      className="mx-4 mb-4 rounded-2xl bg-card border border-border p-4"
    >
      <div className="flex items-center justify-between mb-3">
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

      {/* Heatmap grid — no labels, just colored squares */}
      <div className="flex gap-[2px] justify-center">
        {grid[0]?.map((_, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-[2px]">
            {grid.map((row, rowIdx) => {
              const level = row[colIdx];
              if (level === -1) {
                return <div key={rowIdx} className="w-[9px] h-[9px]" />;
              }
              return (
                <div
                  key={rowIdx}
                  className={cn(
                    "w-[9px] h-[9px] rounded-[2px]",
                    LEVEL_CLASSES[level]
                  )}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend + subtle footer */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <div key={l} className={cn("w-[8px] h-[8px] rounded-[1px]", LEVEL_CLASSES[l])} />
          ))}
          <span>More</span>
        </div>
        {isOwnProfile && (
          <span className="text-[9px] text-muted-foreground">
            {dailyFp.length} days · Avg {avg.toFixed(1)} FP+/day
          </span>
        )}
      </div>
    </motion.div>
  );
};
