import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { MicroSparkline } from "./MicroSparkline";
import type { ComparisonTotals, SparklinePoint } from "@/hooks/useReportsV2Comparison";

interface RepPeriodKpisProps {
  current: ComparisonTotals;
  comparison: ComparisonTotals | null;
  sparklineHistory: SparklinePoint[];
  comparisonLabel: string;
  repName: string;
  periodLabel: string;
  isLoading?: boolean;
  avgStartTime?: string | null;
  avgEndTime?: string | null;
  onSummaryRowClick?: () => void;
  summaryExpanded?: boolean;
  onKpiTap?: (metricKey: MetricKey) => void;
}

type MetricKey = 'doors' | 'dms' | 'pitches' | 'transitions' | 'presentations' | 'fp';

const METRICS: { key: MetricKey; label: string; format?: 'decimal' }[] = [
  { key: 'doors', label: 'Doors' },
  { key: 'dms', label: 'DMs' },
  { key: 'pitches', label: 'Pitches' },
  { key: 'transitions', label: 'Trans' },
  { key: 'presentations', label: 'Pres' },
  { key: 'fp', label: 'FP+', format: 'decimal' },
];

const getDelta = (current: number, prev: number): number | null => {
  if (prev === 0 && current === 0) return null;
  if (prev === 0) return 100;
  return Math.round(((current - prev) / prev) * 100);
};

const getDeltaColor = (d: number) => {
  if (d > 5) return "text-green-600 dark:text-green-400 bg-green-500/10";
  if (d < -5) return "text-destructive bg-destructive/10";
  return "text-muted-foreground bg-muted/50";
};

export const RepPeriodKpis = ({
  current,
  comparison,
  sparklineHistory,
  comparisonLabel,
  repName,
  periodLabel,
  isLoading,
  avgStartTime,
  avgEndTime,
  onSummaryRowClick,
  summaryExpanded,
}: RepPeriodKpisProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const firstName = repName.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2B50}]|[\u{1FA00}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]/gu, '').trim().split(' ')[0];

  const fpDelta = comparison ? getDelta(current.fp, comparison.fp) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Momentum sentence */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{firstName}</span>
          {' produced '}
          <span className="font-bold text-foreground">{current.fp.toFixed(1)} FP+</span>
          {' '}
          <span className="text-muted-foreground">{periodLabel.toLowerCase()}</span>
          {fpDelta !== null && (
            <span className={cn(
              "ml-1 text-xs font-medium",
              fpDelta > 5 ? "text-green-600 dark:text-green-400" :
              fpDelta < -5 ? "text-destructive" : "text-muted-foreground"
            )}>
              {fpDelta > 0 ? '↑' : fpDelta < 0 ? '↓' : '→'}{Math.abs(fpDelta)}% {comparisonLabel}
            </span>
          )}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2">
        {METRICS.map((m, i) => {
          const val = current[m.key];
          const compVal = comparison ? comparison[m.key] : null;
          const delta = compVal !== null ? getDelta(val, compVal) : null;
          const sparkData = sparklineHistory.map(p => (p as any)[m.key] || 0);
          const sparkAvg = sparkData.length > 0 ? sparkData.reduce((a, b) => a + b, 0) / sparkData.length : undefined;

          return (
            <motion.div
              key={m.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={cn(
                "rounded-xl p-2.5 flex flex-col items-center gap-0.5",
                "bg-card border border-border/50",
                m.key === 'fp' && "ring-2 ring-primary/20 bg-primary/5",
              )}
            >
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                {m.label}
              </span>
              <span className={cn(
                "text-lg font-bold tabular-nums",
                m.key === 'fp' ? "text-primary" : "text-foreground"
              )}>
                {m.format === 'decimal' ? val.toFixed(1) : val}
              </span>

              {/* Sparkline */}
              {sparkData.length >= 2 && (
                <MicroSparkline
                  data={sparkData}
                  width={52}
                  height={16}
                  goldLine={sparkAvg}
                />
              )}

              {/* Delta */}
              {delta !== null ? (
                <div className={cn(
                  "flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold",
                  getDeltaColor(delta)
                )}>
                  {delta > 5 ? <TrendingUp className="w-2.5 h-2.5" /> :
                   delta < -5 ? <TrendingDown className="w-2.5 h-2.5" /> :
                   <Minus className="w-2.5 h-2.5" />}
                  {delta > 0 ? '+' : ''}{delta}%
                </div>
              ) : (
                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-semibold text-muted-foreground bg-muted/50">
                  <Minus className="w-2.5 h-2.5" />
                  —
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* PRMR + Timing summary row */}
      <div
        className={cn(
          "flex items-center gap-3 text-xs text-muted-foreground rounded-xl px-3 py-2.5",
          "bg-card border border-border/50",
          onSummaryRowClick && "cursor-pointer active:scale-[0.98] transition-transform"
        )}
        onClick={onSummaryRowClick}
      >
        <span className="font-semibold text-foreground">
          ${Math.round(current.prmr).toLocaleString()} <span className="font-normal text-muted-foreground">PRMR</span>
        </span>
        {avgStartTime && (
          <>
            <span className="text-border">·</span>
            <span>{avgStartTime} <span className="text-muted-foreground/60">start</span></span>
          </>
        )}
        {avgEndTime && (
          <>
            <span className="text-border">·</span>
            <span>{avgEndTime} <span className="text-muted-foreground/60">end</span></span>
          </>
        )}
        <span className="text-border">·</span>
        <span>{current.hoursWorked.toFixed(1)}h <span className="text-muted-foreground/60">active</span></span>
        {onSummaryRowClick && (
          <ChevronRight className={cn(
            "w-3.5 h-3.5 ml-auto transition-transform shrink-0",
            summaryExpanded && "rotate-90"
          )} />
        )}
      </div>
    </motion.div>
  );
};
