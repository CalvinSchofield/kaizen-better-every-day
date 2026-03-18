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
        <div className="h-48 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const bc = baselineConversions;

  const stages: FunnelStageData[] = [
    { label: 'Doors', shortLabel: 'Doors', value: doors },
    { label: 'Decision Makers', shortLabel: 'DMs', value: dms, conversionFromPrev: doors > 0 ? (dms / doors) * 100 : 0, baselineConversion: bc ? bc.doorsToDMs * 100 : undefined },
    { label: 'Pitches', shortLabel: 'Pitches', value: pitches, conversionFromPrev: dms > 0 ? (pitches / dms) * 100 : 0, baselineConversion: bc ? bc.dmsToPitches * 100 : undefined },
    { label: 'Transitions', shortLabel: 'Trans', value: transitions, conversionFromPrev: pitches > 0 ? (transitions / pitches) * 100 : 0, baselineConversion: bc ? bc.pitchesToTransitions * 100 : undefined },
    { label: 'Presentations', shortLabel: 'Pres', value: presentations, conversionFromPrev: transitions > 0 ? (presentations / transitions) * 100 : 0, baselineConversion: bc ? bc.transitionsToPres * 100 : undefined },
    { label: 'Closes', shortLabel: 'Closes', value: closes, conversionFromPrev: presentations > 0 ? (closes / presentations) * 100 : 0, baselineConversion: bc ? bc.presToCloses * 100 : undefined },
  ];

  // Find worst drop-off relative to baseline
  let worstDropIdx = -1;
  let worstDropGap = 0;
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

  // Overall conversion
  const overallConversion = doors > 0 ? ((closes / doors) * 100).toFixed(1) : '0';

  if (doors === 0) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3">Sales Funnel</h3>
        <p className="text-sm text-muted-foreground/60 text-center py-6">No activity yet</p>
      </div>
    );
  }

  // Funnel widths: top is 100%, bottom scales proportionally but with a minimum
  const MIN_WIDTH = 28; // minimum % width for smallest bar
  const getBarWidth = (value: number) => {
    if (maxValue === 0) return MIN_WIDTH;
    const ratio = value / maxValue;
    return MIN_WIDTH + ratio * (100 - MIN_WIDTH);
  };

  // Gradient colors for the funnel tiers (top to bottom)
  const tierColors = [
    'from-muted-foreground/20 to-muted-foreground/30', // Doors - neutral
    'from-blue-500/15 to-blue-500/25',
    'from-indigo-500/15 to-indigo-500/25',
    'from-amber-500/15 to-amber-500/25',
    'from-orange-500/15 to-orange-500/25',
    'from-primary/20 to-primary/30', // Closes - primary
  ];
  
  const tierTextColors = [
    'text-foreground',
    'text-blue-600 dark:text-blue-400',
    'text-indigo-600 dark:text-indigo-400',
    'text-amber-600 dark:text-amber-400',
    'text-orange-600 dark:text-orange-400',
    'text-primary',
  ];

  const getConversionStatus = (stage: FunnelStageData, idx: number) => {
    if (stage.conversionFromPrev === undefined || !stages[idx - 1]?.value) return 'neutral';
    if (stage.baselineConversion !== undefined && stage.baselineConversion > 0) {
      const diff = stage.conversionFromPrev - stage.baselineConversion;
      if (diff >= 5) return 'above';
      if (diff <= -10) return 'below';
    }
    return 'neutral';
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Sales Funnel</h3>
        {bc?.hasEnoughData && (
          <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wider">vs 14-day avg</span>
        )}
      </div>
      
      {/* Centered funnel visualization */}
      <div className="space-y-1">
        {stages.map((stage, i) => {
          const barWidth = getBarWidth(stage.value);
          const isWorstDrop = i === worstDropIdx && worstDropGap > 10;
          const convStatus = getConversionStatus(stage, i);
          
          return (
            <motion.div
              key={stage.label}
              initial={{ opacity: 0, scaleX: 0.5 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={{ delay: i * 0.07, duration: 0.35, ease: "easeOut" }}
              className="flex items-center gap-1.5"
            >
              {/* Left label */}
              <span className="text-[10px] font-medium text-muted-foreground w-12 text-right flex-shrink-0">
                {stage.shortLabel}
              </span>

              {/* Funnel bar container - centered */}
              <div className="flex-1 flex justify-center">
                <div
                  className={cn(
                    "relative h-8 rounded-md flex items-center justify-center transition-all",
                    `bg-gradient-to-r ${tierColors[i]}`,
                    isWorstDrop && "ring-2 ring-destructive/50 ring-offset-1 ring-offset-card"
                  )}
                  style={{ width: `${barWidth}%` }}
                >
                  <span className={cn("text-sm font-bold", tierTextColors[i])}>
                    {stage.value}
                  </span>
                </div>
              </div>

              {/* Right conversion badge */}
              <div className="w-12 flex-shrink-0 text-right">
                {stage.conversionFromPrev !== undefined && stages[i - 1]?.value > 0 ? (
                  <div className="flex flex-col items-end">
                    <span className={cn(
                      "text-[10px] font-bold",
                      isWorstDrop ? "text-destructive" : 
                      convStatus === 'above' ? "text-emerald-600 dark:text-emerald-400" :
                      convStatus === 'below' ? "text-destructive" :
                      "text-muted-foreground"
                    )}>
                      {stage.conversionFromPrev.toFixed(0)}%
                    </span>
                    {stage.baselineConversion !== undefined && stage.baselineConversion > 0 && (
                      <span className="text-[8px] text-muted-foreground/50">
                        avg {stage.baselineConversion.toFixed(0)}%
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[8px] text-muted-foreground/40">100%</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Overall conversion footer */}
      <div className="flex items-center justify-center pt-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-px w-8 bg-border" />
          <span className="font-semibold text-foreground">{overallConversion}%</span>
          <span>overall close rate</span>
          <div className="h-px w-8 bg-border" />
        </div>
      </div>

      {/* Worst drop callout */}
      {worstDropIdx > 0 && worstDropGap > 10 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/20"
        >
          <span className="text-xs text-destructive font-medium">
            ⚠️ {stages[worstDropIdx - 1].label} → {stages[worstDropIdx].label}: {stages[worstDropIdx].conversionFromPrev?.toFixed(0)}%
            {stages[worstDropIdx].baselineConversion ? ` (avg ${stages[worstDropIdx].baselineConversion?.toFixed(0)}%)` : ''}
          </span>
        </motion.div>
      )}
    </div>
  );
};
