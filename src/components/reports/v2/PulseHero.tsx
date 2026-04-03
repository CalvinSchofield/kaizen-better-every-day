import { TrendingUp, TrendingDown, Minus, Users, ChevronRight, Zap, Crown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { TeamBaseline } from "@/utils/baselineCalculations";
import { ActiveRecord } from "@/utils/teamRecordDetection";
import { RecordBanner } from "./RecordBanner";
import { MicroSparkline } from "./MicroSparkline";
import { ComparisonTotals, SparklinePoint } from "@/hooks/useReportsV2Comparison";

interface PulseHeroProps {
  doors: number;
  dms: number;
  pitches: number;
  transitions: number;
  presentations: number;
  closes: number;
  fp: number;
  prmr: number;
  avgStartTime?: string;
  avgEndTime?: string;
  activeHours?: number;
  activeReps: number;
  workingCount?: number;
  isLiveView?: boolean;
  teamBaseline?: TeamBaseline;
  periodLabel: string;
  isLoading?: boolean;
  onWorkingClick?: () => void;
  onAvgStartClick?: () => void;
  onFpClick?: () => void;
  activeRecords?: ActiveRecord[];
  onRecordBannerClick?: () => void;
  // Comparison data
  comparisonTotals?: ComparisonTotals | null;
  comparisonLabel?: string;
  sparklineHistory?: SparklinePoint[];
}

type MetricKey = 'doors' | 'dms' | 'pitches' | 'transitions' | 'presentations' | 'closes' | 'fp';

interface StatTileProps {
  label: string;
  value: number | string;
  delta?: number | null;
  format?: 'number' | 'currency' | 'decimal';
  highlight?: boolean;
  delay?: number;
  isRecord?: boolean;
  onPace?: boolean;
  sparklineData?: number[];
  sparklineAvg?: number;
}

const StatTile = ({ label, value, delta, format = 'number', highlight, delay = 0, isRecord, onPace, sparklineData, sparklineAvg }: StatTileProps) => {
  const displayValue = format === 'currency' 
    ? `$${typeof value === 'number' ? value.toLocaleString() : value}`
    : format === 'decimal' && typeof value === 'number'
    ? value.toFixed(1)
    : value;

  const getDeltaColor = (d: number) => {
    if (d > 5) return "text-green-600 dark:text-green-400 bg-green-500/10";
    if (d < -5) return "text-destructive bg-destructive/10";
    return "text-muted-foreground bg-muted/50";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.05, duration: 0.3 }}
      className={cn(
        "rounded-xl p-3 flex flex-col items-center justify-center gap-0.5 relative",
        "bg-card border border-border/50",
        highlight && "ring-2 ring-primary/20 bg-primary/5",
        isRecord && "ring-2 ring-amber-400/60 bg-amber-500/5",
        onPace && !isRecord && "ring-1 ring-amber-400/30 bg-amber-500/[0.03]",
      )}
    >
      {(isRecord || onPace) && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: (delay * 0.05) + 0.2, type: "spring", stiffness: 400 }}
          className="absolute -top-1.5 -right-1.5"
        >
          <Crown className={cn(
            "w-3.5 h-3.5",
            isRecord ? "text-amber-500" : "text-amber-400/60"
          )} />
        </motion.div>
      )}
      <span className={cn(
        "text-3xl font-bold tracking-tight",
        isRecord ? "text-amber-600 dark:text-amber-400" : highlight ? "text-primary" : "text-foreground"
      )}>
        {displayValue}
      </span>
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {/* Sparkline + delta row */}
      <div className="flex items-center gap-1.5 mt-0.5">
        {sparklineData && sparklineData.length >= 2 && (
          <MicroSparkline
            data={sparklineData}
            width={44}
            height={16}
            goldLine={sparklineAvg}
          />
        )}
        {delta !== undefined && delta !== null && (
          <div className={cn(
            "flex items-center gap-0.5 px-1 py-0.5 rounded-full text-[9px] font-semibold",
            getDeltaColor(delta)
          )}>
            {delta > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : delta < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
            {delta > 0 ? '+' : ''}{delta.toFixed(0)}%
          </div>
        )}
      </div>
    </motion.div>
  );
};

// Detect if a period label represents a completed (past) timeframe
const isCompletedPeriod = (label: string): boolean => {
  const lower = label.toLowerCase();
  return lower.startsWith('last') || lower === 'yesterday';
};

// Detect if a period is ongoing (not live, not completed)
const isOngoingPeriod = (label: string): boolean => {
  const lower = label.toLowerCase();
  return lower.startsWith('this') || lower === 'preseason' || lower === 'ytd' || lower === 'season';
};

// Generate pulse sentence based on metrics, baseline, and period context
const generatePulseSentence = (
  fp: number,
  doors: number,
  closes: number,
  activeReps: number,
  periodLabel: string,
  baseline?: TeamBaseline,
  isLiveView?: boolean,
  comparisonTotals?: ComparisonTotals | null,
  comparisonLabel?: string,
): string => {
  // LIVE view with baseline — use pace comparison
  if (isLiveView && baseline) {
    const expectedFP = baseline.teamExpectedFPToday || 0;
    if (expectedFP <= 0) return `${fp.toFixed(1)} FP+ produced today`;
    const pct = (fp / expectedFP) * 100;
    if (pct >= 110) return `Production is ${(pct - 100).toFixed(0)}% above expected pace 🔥`;
    if (pct >= 90) return "Team is tracking on pace with baseline";
    if (pct >= 70) return `Team is ${(100 - pct).toFixed(0)}% behind normal pace`;
    return `Team is significantly behind expected pace — ${(100 - pct).toFixed(0)}% below baseline`;
  }

  // Non-live with comparison data — show period-over-period
  if (comparisonTotals && comparisonTotals.fp > 0 && fp > 0) {
    const delta = ((fp - comparisonTotals.fp) / comparisonTotals.fp) * 100;
    const dir = delta >= 0 ? 'up' : 'down';
    const arrow = delta >= 0 ? '↑' : '↓';
    return `${fp.toFixed(1)} FP+ — ${arrow}${Math.abs(delta).toFixed(0)}% ${comparisonLabel || 'vs prior period'}`;
  }

  // No activity yet
  if (fp <= 0 && doors <= 0) {
    if (isLiveView) return "Waiting for field activity to begin";
    if (isCompletedPeriod(periodLabel)) return `No recorded activity for ${periodLabel.toLowerCase()}`;
    return "No activity recorded yet this period";
  }

  // COMPLETED period — past tense coaching summary
  if (isCompletedPeriod(periodLabel)) {
    if (fp > 0 && activeReps > 0) {
      const perRep = (fp / activeReps).toFixed(2);
      return `${fp.toFixed(1)} FP+ across ${activeReps} reps — ${perRep} per rep`;
    }
    if (fp > 0) return `${fp.toFixed(1)} FP+ produced ${periodLabel.toLowerCase()}`;
    return `${doors} doors knocked, no closes ${periodLabel.toLowerCase()}`;
  }

  // ONGOING period — present tense with context
  if (isOngoingPeriod(periodLabel)) {
    if (fp > 0 && closes > 0) {
      return `${fp.toFixed(1)} FP+ on ${closes} closes so far`;
    }
    if (fp > 0) return `${fp.toFixed(1)} FP+ produced so far`;
    return `${doors} doors knocked, working towards first close`;
  }

  // LIVE without baseline / fallback
  if (isLiveView) {
    if (fp > 0) return `${fp.toFixed(1)} FP+ produced today`;
    if (doors > 0) return `${doors} doors knocked, working towards first sale`;
    return "Waiting for field activity to begin";
  }

  // Custom range / generic fallback
  if (fp > 0 && activeReps > 0) {
    const perRep = (fp / activeReps).toFixed(2);
    return `${fp.toFixed(1)} FP+ across ${activeReps} reps — ${perRep} per rep`;
  }
  if (fp > 0) return `${fp.toFixed(1)} FP+ produced in this period`;
  return `${doors} doors knocked in this period`;
};

export const PulseHero = ({
  doors, dms, pitches, transitions, presentations, closes, fp, prmr,
  avgStartTime, avgEndTime, activeHours,
  activeReps, workingCount, isLiveView,
  teamBaseline, periodLabel, isLoading, onWorkingClick,
  onAvgStartClick, onFpClick,
  activeRecords = [], onRecordBannerClick,
  comparisonTotals, comparisonLabel, sparklineHistory,
}: PulseHeroProps) => {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
        <div className="grid grid-cols-3 gap-2">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Build record lookup
  const recordMap = new Map<string, ActiveRecord>();
  activeRecords.forEach(r => {
    if (!recordMap.has(r.metricKey)) recordMap.set(r.metricKey, r);
  });

  const getRecordProps = (metricKey: string) => {
    const r = recordMap.get(metricKey);
    if (!r) return {};
    return { isRecord: r.isRecord, onPace: r.onPace };
  };

  // Calculate deltas from comparison data (period-over-period)
  const calcDelta = (metricKey: MetricKey): number | null => {
    // For live view, use baseline delta for FP only (existing behavior)
    if (isLiveView && metricKey === 'fp' && teamBaseline?.teamExpectedFPToday) {
      const expected = teamBaseline.teamExpectedFPToday;
      if (expected > 0) return ((fp - expected) / expected) * 100;
    }
    // Use comparison totals for all metrics when available
    if (!comparisonTotals) return null;
    const currentValues: Record<MetricKey, number> = { doors, dms, pitches, presentations, closes, fp };
    const current = currentValues[metricKey];
    const previous = (comparisonTotals as any)[metricKey] || 0;
    if (previous === 0 && current === 0) return null;
    if (previous === 0) return current > 0 ? 100 : null;
    return ((current - previous) / previous) * 100;
  };

  // Extract sparkline data for a given metric
  const getSparkline = (metricKey: MetricKey): number[] | undefined => {
    if (!sparklineHistory || sparklineHistory.length < 2) return undefined;
    return sparklineHistory.map(p => (p as any)[metricKey] || 0);
  };

  // Calculate sparkline average for gold line
  const getSparklineAvg = (metricKey: MetricKey): number | undefined => {
    const data = getSparkline(metricKey);
    if (!data || data.length === 0) return undefined;
    const sum = data.reduce((a, b) => a + b, 0);
    const avg = sum / data.length;
    return avg > 0 ? avg : undefined;
  };

  const pulseSentence = generatePulseSentence(
    fp, doors, closes, activeReps, periodLabel, teamBaseline, isLiveView,
    comparisonTotals, comparisonLabel,
  );

  // Determine pulse color
  const fpDelta = calcDelta('fp');
  const pulseColor = !fpDelta ? "text-muted-foreground" 
    : fpDelta >= 0 ? "text-green-600 dark:text-green-400" 
    : fpDelta < -15 ? "text-destructive" 
    : "text-warning";

  return (
    <div className="space-y-3">
      {/* Pulse sentence */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-2"
      >
        <Zap className={cn("w-4 h-4", pulseColor)} />
        <p className={cn("text-sm font-medium", pulseColor)}>
          {pulseSentence}
        </p>
      </motion.div>

      {/* Comparison label */}
      {comparisonLabel && comparisonTotals && (
        <p className="text-[10px] text-muted-foreground/70 -mt-1 ml-6">
          {comparisonLabel}
        </p>
      )}

      {/* Stat tiles grid - 3x2 */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Doors" value={doors} delta={calcDelta('doors')} sparklineData={getSparkline('doors')} sparklineAvg={getSparklineAvg('doors')} delay={0} {...getRecordProps('doors')} />
        <StatTile label="DMs" value={dms} delta={calcDelta('dms')} sparklineData={getSparkline('dms')} sparklineAvg={getSparklineAvg('dms')} delay={1} {...getRecordProps('dms')} />
        <StatTile label="Pitches" value={pitches} delta={calcDelta('pitches')} sparklineData={getSparkline('pitches')} sparklineAvg={getSparklineAvg('pitches')} delay={2} {...getRecordProps('pitches')} />
        <StatTile label="Trans" value={transitions} delta={calcDelta('transitions')} sparklineData={getSparkline('transitions')} sparklineAvg={getSparklineAvg('transitions')} delay={3} {...getRecordProps('transitions')} />
        <StatTile label="Pres" value={presentations} delta={calcDelta('presentations')} sparklineData={getSparkline('presentations')} sparklineAvg={getSparklineAvg('presentations')} delay={4} {...getRecordProps('presentations')} />
        {onFpClick ? (
          <button onClick={onFpClick} className="active:scale-[0.96] transition-transform">
            <StatTile label="FP+" value={fp} format="decimal" highlight={fp > 0} delta={calcDelta('fp')} sparklineData={getSparkline('fp')} sparklineAvg={getSparklineAvg('fp')} delay={5} {...getRecordProps('fp')} />
          </button>
        ) : (
          <StatTile label="FP+" value={fp} format="decimal" highlight={fp > 0} delta={calcDelta('fp')} sparklineData={getSparkline('fp')} sparklineAvg={getSparklineAvg('fp')} delay={5} {...getRecordProps('fp')} />
        )}
      </div>

      {/* Record Banner */}
      {activeRecords.length > 0 && (
        <RecordBanner records={activeRecords} onClick={onRecordBannerClick} />
      )}

      {/* Secondary metrics row */}
      <div className="bg-card rounded-xl border border-border/50 px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-green-600 dark:text-green-400">${prmr.toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">PRMR</span>
          </div>
          {avgStartTime && (
            <button
              onClick={onAvgStartClick}
              className="flex items-center gap-1 hover:bg-muted/50 rounded px-1 -mx-1 transition-colors active:scale-[0.97]"
            >
              <span className="font-medium">{avgStartTime}</span>
              <span className="text-muted-foreground text-xs">Avg Start</span>
              <Info className="w-3 h-3 text-muted-foreground/60" />
            </button>
          )}
          {activeHours !== undefined && activeHours > 0 && (
            <div className="flex items-baseline gap-1">
              <span className="font-medium">{activeHours.toFixed(1)}h</span>
              <span className="text-muted-foreground text-xs">Active</span>
            </div>
          )}
        </div>
      </div>

      {/* Working reps clickable */}
      {onWorkingClick && (
        <button
          onClick={onWorkingClick}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 active:scale-[0.99] transition-all"
        >
          <div className="flex items-center gap-2 text-sm">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium">{isLiveView ? workingCount || 0 : activeReps}</span>
            <span className="text-muted-foreground">
              {isLiveView ? 'working now' : 'reps worked'}
            </span>
            {isLiveView && (
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};
