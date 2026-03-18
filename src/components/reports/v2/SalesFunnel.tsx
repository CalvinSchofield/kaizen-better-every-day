import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { BaselineConversions } from "@/utils/baselineCalculations";

interface SalesFunnelProps {
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  baselineConversions?: BaselineConversions;
  isLoading?: boolean;
}

interface FunnelStageData {
  label: string;
  shortLabel: string;
  value: number;
  conversionFromPrev?: number;
  baselineConversion?: number;
  color: string;
  bgColor: string;
}

export const SalesFunnel = ({
  doors, dms, pitches, transitions, presentations, closes, fp,
  baselineConversions,
  isLoading,
}: SalesFunnelProps) => {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <div className="h-5 w-32 bg-muted animate-pulse rounded mb-4" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const bc = baselineConversions;

  const stages: FunnelStageData[] = [
    { label: 'Doors', shortLabel: 'Doors', value: doors, color: 'text-foreground', bgColor: 'bg-muted' },
    { label: 'Decision Makers', shortLabel: 'DMs', value: dms, conversionFromPrev: doors > 0 ? (dms / doors) * 100 : 0, baselineConversion: bc ? bc.doorsToDMs * 100 : undefined, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-500/10' },
    { label: 'Pitches', shortLabel: 'Pitch', value: pitches, conversionFromPrev: dms > 0 ? (pitches / dms) * 100 : 0, baselineConversion: bc ? bc.dmsToPitches * 100 : undefined, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-500/10' },
    { label: 'Transitions', shortLabel: 'Trans', value: transitions, conversionFromPrev: pitches > 0 ? (transitions / pitches) * 100 : 0, baselineConversion: bc ? bc.pitchesToTransitions * 100 : undefined, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-500/10' },
    { label: 'Presentations', shortLabel: 'Pres', value: presentations, conversionFromPrev: transitions > 0 ? (presentations / transitions) * 100 : 0, baselineConversion: bc ? bc.transitionsToPres * 100 : undefined, color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-500/10' },
    { label: 'Closes', shortLabel: 'Close', value: closes, conversionFromPrev: presentations > 0 ? (closes / presentations) * 100 : 0, baselineConversion: bc ? bc.presToCloses * 100 : undefined, color: 'text-primary', bgColor: 'bg-primary/10' },
  ];

  // Find biggest drop-off relative to baseline (not arbitrary)
  let worstDropIdx = -1;
  let worstDropGap = 0; // How far below baseline
  stages.forEach((s, i) => {
    if (i > 0 && s.conversionFromPrev !== undefined && stages[i - 1].value > 0) {
      const baselineVal = s.baselineConversion || 0;
      const gap = baselineVal - s.conversionFromPrev;
      if (gap > worstDropGap) {
        worstDropGap = gap;
        worstDropIdx = i;
      }
    }
  });

  const maxValue = Math.max(doors, 1);

  if (doors === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Sales Funnel</h3>
        <p className="text-sm text-muted-foreground/60 text-center py-6">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Sales Funnel</h3>
        {bc?.hasEnoughData && (
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">vs 14-day baseline</span>
        )}
      </div>
      
      {/* Visual funnel bars */}
      <div className="space-y-1.5">
        {stages.map((stage, i) => {
          const barWidth = Math.max((stage.value / maxValue) * 100, 4);
          const isWorstDrop = i === worstDropIdx && worstDropGap > 10;
          
          // Color conversion badge based on comparison to team's own baseline
          const getConversionColor = () => {
            if (stage.conversionFromPrev === undefined || !stages[i - 1]?.value) return '';
            if (stage.baselineConversion !== undefined && stage.baselineConversion > 0) {
              const diff = stage.conversionFromPrev - stage.baselineConversion;
              if (diff >= 5) return "text-green-600 dark:text-green-400";
              if (diff <= -10) return "text-destructive";
              return "text-muted-foreground";
            }
            return "text-muted-foreground";
          };
          
          return (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
              className="flex items-center gap-2"
            >
              <span className="text-[11px] font-medium text-muted-foreground w-11 text-right flex-shrink-0">
                {stage.shortLabel}
              </span>
              
              <div className="flex-1 relative h-7">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-md flex items-center px-2 transition-all",
                    stage.bgColor,
                    isWorstDrop && "ring-2 ring-destructive/40"
                  )}
                  style={{ width: `${barWidth}%` }}
                >
                  <span className={cn("text-xs font-bold", stage.color)}>
                    {stage.value}
                  </span>
                </div>
              </div>

              {/* Conversion % badge with baseline comparison */}
              {stage.conversionFromPrev !== undefined && stages[i - 1]?.value > 0 && (
                <div className="flex flex-col items-end flex-shrink-0 w-12">
                  <span className={cn(
                    "text-[10px] font-semibold",
                    isWorstDrop ? "text-destructive" : getConversionColor()
                  )}>
                    {stage.conversionFromPrev.toFixed(0)}%
                  </span>
                  {stage.baselineConversion !== undefined && stage.baselineConversion > 0 && (
                    <span className="text-[8px] text-muted-foreground/50">
                      avg {stage.baselineConversion.toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Worst drop callout — now relative to baseline */}
      {worstDropIdx > 0 && worstDropGap > 10 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20"
        >
          <span className="text-xs text-destructive font-medium">
            ⚠️ {stages[worstDropIdx - 1].label} → {stages[worstDropIdx].label}: {stages[worstDropIdx].conversionFromPrev?.toFixed(0)}% (baseline: {stages[worstDropIdx].baselineConversion?.toFixed(0)}%)
          </span>
        </motion.div>
      )}
    </div>
  );
};
