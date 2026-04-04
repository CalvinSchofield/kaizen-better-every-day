import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { IntradayPaceResult, IntradayKpis } from "@/utils/intradayPaceCalculations";

interface IntradayPaceBarProps {
  pace: IntradayPaceResult;
}

interface PaceRowProps {
  label: string;
  actual: number;
  expected: number;
  delta: number | null;
  format?: 'int' | 'decimal';
}

const PaceRow = ({ label, actual, expected, delta, format = 'int' }: PaceRowProps) => {
  const formatVal = (v: number) => format === 'decimal' ? v.toFixed(1) : Math.round(v).toString();

  const getDeltaColor = (d: number) => {
    if (d > 5) return "text-green-600 dark:text-green-400";
    if (d < -5) return "text-destructive";
    return "text-muted-foreground";
  };

  const getDeltaBg = (d: number) => {
    if (d > 5) return "bg-green-500/10";
    if (d < -5) return "bg-destructive/10";
    return "bg-muted/50";
  };

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">
          {formatVal(actual)} / {formatVal(expected)} exp
        </span>
      </div>
      {delta !== null && (
        <div className={cn(
          "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold",
          getDeltaColor(delta),
          getDeltaBg(delta),
        )}>
          {delta > 5 ? <TrendingUp className="w-2.5 h-2.5" /> 
           : delta < -5 ? <TrendingDown className="w-2.5 h-2.5" /> 
           : <Minus className="w-2.5 h-2.5" />}
          {delta > 0 ? '+' : ''}{Math.round(delta)}%
        </div>
      )}
    </div>
  );
};

export const IntradayPaceBar = ({ pace }: IntradayPaceBarProps) => {
  const [expanded, setExpanded] = useState(false);

  if (!pace.hasEnoughData) return null;

  const dayTypeLabel = pace.dayType === 'saturday' ? 'Saturday' : 'Weekday';
  const pctDisplay = Math.round(pace.pctDayElapsed * 100);

  // Top-level summary: pick the most meaningful KPI delta
  const fpDelta = pace.deltas.fp;
  const summaryColor = fpDelta === null ? "text-muted-foreground"
    : fpDelta > 5 ? "text-green-600 dark:text-green-400"
    : fpDelta < -5 ? "text-destructive"
    : "text-muted-foreground";

  const kpiRows: { key: keyof IntradayKpis; label: string; format?: 'int' | 'decimal' }[] = [
    { key: 'doors', label: 'Doors' },
    { key: 'dms', label: 'DMs' },
    { key: 'pitches', label: 'Pitches' },
    { key: 'transitions', label: 'Trans' },
    { key: 'presentations', label: 'Pres' },
    { key: 'fp', label: 'FP+', format: 'decimal' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full rounded-xl border border-border/50 bg-card p-3 active:scale-[0.99] transition-transform"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {dayTypeLabel} Pace
            </span>
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">{pctDisplay}% of day</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative h-2 w-full rounded-full bg-muted/40 overflow-hidden mb-1">
          <motion.div
            className={cn(
              "h-full rounded-full",
              fpDelta === null ? "bg-primary/60"
                : fpDelta > 5 ? "bg-green-500"
                : fpDelta < -5 ? "bg-destructive/80"
                : "bg-primary/60"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${pctDisplay}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        </div>

        {/* Summary line (always visible) */}
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-xs text-muted-foreground">
            {pace.actualNow.fp.toFixed(1)} FP+ / {pace.expectedNow.fp.toFixed(1)} expected
          </span>
          {fpDelta !== null && (
            <span className={cn("text-xs font-semibold", summaryColor)}>
              {fpDelta > 0 ? '+' : ''}{Math.round(fpDelta)}%
            </span>
          )}
        </div>

        {/* Expanded KPI rows */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-2 pt-2 border-t border-border/30 space-y-0.5">
                {kpiRows.map(({ key, label, format }) => (
                  <PaceRow
                    key={key}
                    label={label}
                    actual={pace.actualNow[key]}
                    expected={pace.expectedNow[key]}
                    delta={pace.deltas[key]}
                    format={format}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
};
