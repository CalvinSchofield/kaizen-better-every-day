import { useMemo } from "react";
import { motion } from "framer-motion";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import { formatHoursMinutes, formatFP, formatPRMR } from "@/lib/formatters";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { differenceInMinutes, parseISO, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { 
  calculateInHomeZones, 
  buildRingSegments,
  TimelineEvent,
  RingSegment,
} from "@/utils/inHomeZoneCalculator";
import { Play, Square, DollarSign, Home, Zap, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

interface HorizontalActivityTimelineProps {
  entry: DailyEntry | {
    doors_knocked: number;
    decision_makers: number;
    pitches: number;
    transitions: number;
    presentations: number;
    closes: number;
    fp_plus: number;
    prmr: number;
    is_finalized: boolean;
    work_start_time: string | null;
    work_end_time: string | null;
    break_periods: Array<{ start: string; end: string }>;
    counter_timestamps: Record<string, string[]>;
    timezone: string | null;
  };
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Sale[];
  metricLabel?: string;
  metricValue?: number;
  goalProgress?: number;
  onSegmentClick?: (segment: RingSegment, matchedSale?: Sale) => void;
  onSaleChipClick?: (sale: Sale) => void;
}

// Same color scheme as the ring
const SEGMENT_COLORS: Record<string, string> = {
  knocking: 'bg-blue-500',
  doorstep: 'bg-cyan-500',
  transition: 'bg-amber-500',
  presentation: 'bg-amber-500',
  sale: 'bg-green-500',
  seen_out: 'bg-amber-500',
  break: 'bg-orange-500',
  gap: 'bg-muted-foreground/30',
  pitch: 'bg-purple-500',
};

const SEGMENT_BORDER_COLORS: Record<string, string> = {
  knocking: 'border-blue-500',
  doorstep: 'border-cyan-500',
  transition: 'border-amber-500',
  presentation: 'border-amber-500',
  sale: 'border-green-500',
  seen_out: 'border-amber-500',
  break: 'border-orange-500',
  gap: 'border-muted-foreground/30',
  pitch: 'border-purple-500',
};

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

// Format time in the rep's local timezone
const formatTimeInTimezone = (date: Date, timezone: string | null): string => {
  if (timezone) {
    try {
      const zonedDate = toZonedTime(date, timezone);
      return format(zonedDate, 'h:mm a');
    } catch {
      // Fall back to default
    }
  }
  return format(date, 'h:mm a');
};

export const HorizontalActivityTimeline = ({
  entry,
  counterTimestamps,
  salesLog = [],
  metricLabel,
  metricValue,
  goalProgress = 0,
  onSegmentClick,
  onSaleChipClick,
}: HorizontalActivityTimelineProps) => {

  const { hoursWorked, workStart, workEnd, totalWorkMinutes, isLive } = useMemo(() => {
    // Require at least work_start_time; for live view, use "now" as temporary end
    if (!entry.work_start_time) {
      return { hoursWorked: 0, workStart: null, workEnd: null, totalWorkMinutes: 0, isLive: false };
    }
    
    const start = parseISO(entry.work_start_time);
    // If work_end_time is missing (rep still working), use current time
    const isLiveSession = !entry.work_end_time;
    const end = entry.work_end_time ? parseISO(entry.work_end_time) : new Date();
    const minutes = differenceInMinutes(end, start);
    
    let breakMinutes = 0;
    if (entry.break_periods && Array.isArray(entry.break_periods)) {
      entry.break_periods.forEach(bp => {
        if (bp.start && bp.end) {
          const bStart = parseISO(bp.start);
          const bEnd = parseISO(bp.end);
          if (!isNaN(bStart.getTime()) && !isNaN(bEnd.getTime())) {
            breakMinutes += differenceInMinutes(bEnd, bStart);
          }
        }
      });
    }
    
    return {
      hoursWorked: Math.max(0, (minutes - breakMinutes) / 60),
      workStart: start,
      workEnd: end,
      totalWorkMinutes: minutes,
      isLive: isLiveSession,
    };
  }, [entry.work_start_time, entry.work_end_time, entry.break_periods]);

  const { fp, prmr } = useMemo(() => {
    if (salesLog && salesLog.length > 0) {
      return calculateFromSalesLog(salesLog);
    }
    return { fp: entry.fp_plus || 0, prmr: entry.prmr || 0 };
  }, [salesLog, entry.fp_plus, entry.prmr]);

  const centerMetricValue = metricValue ?? fp;
  const centerMetricLabel = metricLabel ?? 'FP+';

  const events = useMemo<TimelineEvent[]>(() => {
    const allEvents: TimelineEvent[] = [];
    const timestamps = counterTimestamps || entry.counter_timestamps || {};
    
    Object.entries(timestamps).forEach(([type, times]) => {
      if (Array.isArray(times)) {
        times.forEach(t => {
          try {
            const eventType = type as TimelineEvent['type'];
            if (['doors_knocked', 'decision_makers', 'pitches', 'transitions', 'presentations', 'closes'].includes(eventType)) {
              allEvents.push({ timestamp: parseISO(t), type: eventType });
            }
          } catch {
            // Skip invalid dates
          }
        });
      }
    });
    
    salesLog.forEach(sale => {
      if (sale.timestamp) {
        if (sale.install_status === 'never_installed') return;
        
        try {
          const saleAny = sale as any;
          allEvents.push({ 
            timestamp: parseISO(sale.timestamp), 
            type: 'sale',
            prmr: sale.prmr,
            timeToSellMinutes: saleAny.time_to_sell_minutes,
            timeToSellSource: saleAny.time_to_sell_source,
          });
        } catch {
          // Skip invalid dates
        }
      }
    });
    
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [counterTimestamps, entry.counter_timestamps, salesLog]);

  const segments = useMemo<RingSegment[]>(() => {
    if (!workStart || !workEnd) {
      return [{ startAngle: 0, endAngle: 360, type: 'gap' }];
    }
    
    const inHomeZones = calculateInHomeZones(events, workStart, workEnd);
    return buildRingSegments(events, inHomeZones, entry.break_periods || [], workStart, workEnd);
  }, [events, workStart, workEnd, entry.break_periods]);

  const { gapPercent, presentationPercent, totalPresentationMinutes, totalGapMinutes, inHomeCount } = useMemo(() => {
    if (!segments.length || totalWorkMinutes === 0) {
      return { gapPercent: 0, presentationPercent: 0, totalPresentationMinutes: 0, totalGapMinutes: 0, inHomeCount: 0 };
    }
    
    const totalGapDegrees = segments
      .filter(s => s.type === 'gap')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    const totalPresentationDegrees = segments
      .filter(s => s.type === 'presentation' || s.type === 'sale' || s.type === 'seen_out')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    const inHomeCount = segments.filter(s => 
      s.type === 'presentation' || s.type === 'sale' || s.type === 'seen_out'
    ).length;
    
    return {
      gapPercent: Math.round((totalGapDegrees / 360) * 100),
      presentationPercent: Math.round((totalPresentationDegrees / 360) * 100),
      totalPresentationMinutes: Math.round((totalPresentationDegrees / 360) * totalWorkMinutes),
      totalGapMinutes: Math.round((totalGapDegrees / 360) * totalWorkMinutes),
      inHomeCount,
    };
  }, [segments, totalWorkMinutes]);

  // Count significant gaps (> 20 min)
  const gapDetails = useMemo(() => {
    const gaps = segments.filter(s => s.type === 'gap');
    const significantGaps = gaps.filter(g => {
      const durationDegrees = g.endAngle - g.startAngle;
      const durationMinutes = (durationDegrees / 360) * totalWorkMinutes;
      return durationMinutes >= 20;
    });
    
    let longestGap = 0;
    gaps.forEach(g => {
      const durationMinutes = ((g.endAngle - g.startAngle) / 360) * totalWorkMinutes;
      if (durationMinutes > longestGap) longestGap = durationMinutes;
    });
    
    return {
      count: significantGaps.length,
      longest: Math.round(longestGap),
    };
  }, [segments, totalWorkMinutes]);

  // Sales info
  const salesInfo = useMemo(() => {
    const saleSegments = segments.filter(s => s.type === 'sale');
    const totalPrmr = salesLog.reduce((sum, s) => sum + (s.prmr || 0), 0);
    return {
      count: saleSegments.length,
      totalPrmr,
    };
  }, [segments, salesLog]);

  // Find matched sale for a segment
  const findMatchedSale = (segment: RingSegment): Sale | undefined => {
    if (segment.type !== 'sale' || !workStart || !workEnd) return undefined;
    
    const segmentStartMs = workStart.getTime() + (segment.startAngle / 360) * totalWorkMinutes * 60 * 1000;
    const segmentEndMs = workStart.getTime() + (segment.endAngle / 360) * totalWorkMinutes * 60 * 1000;
    
    return salesLog.find(sale => {
      if (!sale.timestamp) return false;
      const saleTime = parseISO(sale.timestamp).getTime();
      return saleTime >= segmentStartMs - 60000 && saleTime <= segmentEndMs + 60000;
    });
  };

  if (!workStart || !workEnd) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        No activity data
      </div>
    );
  }

  const totalEvents = events.length;

  return (
    <div className="space-y-4">
      {/* Center Metric Display */}
      <div className="flex flex-col items-center gap-1">
        <div className="text-3xl font-bold tabular-nums">
          {centerMetricLabel === 'EFP' ? centerMetricValue.toFixed(2) : formatFP(centerMetricValue)} {centerMetricLabel}
        </div>
        <div className="text-sm text-primary/80 font-medium">
          ${formatPRMR(prmr)}
        </div>
        <div className="text-xs text-muted-foreground">
          {formatHoursMinutes(hoursWorked)}
        </div>
        {goalProgress > 0 && (
          <div className="text-xs text-primary/60 font-medium bg-primary/10 px-2 py-0.5 rounded-full mt-1">
            {Math.round(goalProgress)}% of goal
          </div>
        )}
      </div>

      {/* Sale chips if any */}
      {salesInfo.count > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {salesLog.filter(s => s.install_status !== 'never_installed').map((sale, idx) => (
            <motion.button
              key={idx}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30 active:scale-95 transition-transform"
              onClick={() => onSaleChipClick?.(sale)}
            >
              <DollarSign className="w-3.5 h-3.5 text-green-500" />
              <span className="text-sm font-semibold text-green-500">
                ${sale.prmr?.toFixed(0)}
              </span>
              {sale.timestamp && (
                <span className="text-xs text-green-500/70">
                  {formatTimeInTimezone(parseISO(sale.timestamp), entry.timezone)} • {sale.type === 'upgrade' ? 'UPG' : 'FP'}
                </span>
              )}
            </motion.button>
          ))}
        </div>
      )}

      {/* Horizontal Timeline Container */}
      <div className="bg-muted/30 rounded-xl p-4 space-y-3">
        {/* Time header */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5 text-primary" />
            <span>{formatTimeInTimezone(workStart, entry.timezone)}</span>
          </div>
          {isLive ? (
            <div className="flex items-center gap-1 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] font-semibold">LIVE</span>
              <span className="text-muted-foreground/60 ml-1">{totalEvents} events</span>
            </div>
          ) : (
            <span className="text-muted-foreground/60">{totalEvents} events</span>
          )}
          <div className="flex items-center gap-1.5">
            <span>{isLive ? 'Now' : formatTimeInTimezone(workEnd, entry.timezone)}</span>
            {isLive ? (
              <Radio className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Timeline bar */}
        <div className="relative h-8 bg-muted/50 rounded-full overflow-hidden flex">
          {segments.map((segment, idx) => {
            const widthPercent = ((segment.endAngle - segment.startAngle) / 360) * 100;
            const durationMinutes = ((segment.endAngle - segment.startAngle) / 360) * totalWorkMinutes;
            // All segments are clickable to show details
            const isClickable = true;
            const matchedSale = segment.type === 'sale' ? findMatchedSale(segment) : undefined;
            const showLabel = durationMinutes >= 15 && (segment.type === 'gap' || segment.type === 'break' || segment.type === 'presentation');
            
            // For breaks, use dashed border style
            const isBreak = segment.type === 'break';
            
            return (
              <motion.div
                key={idx}
                className={cn(
                  "h-full relative flex items-center justify-center overflow-hidden",
                  SEGMENT_COLORS[segment.type] || 'bg-muted',
                  isBreak && "bg-transparent border-2 border-dashed border-orange-500",
                  "cursor-pointer hover:opacity-80 active:scale-y-90 transition-transform"
                )}
                style={{ width: `${Math.max(widthPercent, 0.3)}%` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.4, delay: idx * 0.02 }}
                onClick={() => onSegmentClick?.(segment, matchedSale)}
              >
                {/* Show duration label for significant segments */}
                {showLabel && widthPercent > 8 && (
                  <span className="text-[9px] font-medium text-white/90 z-10 truncate px-1">
                    {formatDuration(durationMinutes)}
                  </span>
                )}
                
                {/* Sale marker */}
                {segment.type === 'sale' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Legend row */}
        <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-blue-500" />
            <span>Door</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-purple-500" />
            <span>DM</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-cyan-500" />
            <span>Pitch</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-amber-500" />
            <span>Trans</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-amber-500/70" />
            <span>Pres</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-sm bg-green-500" />
            <span>Sale</span>
          </div>
        </div>

        {/* Stats footer */}
        <div className="flex items-center justify-center gap-4 pt-1 text-xs text-muted-foreground">
          {inHomeCount > 0 && (
            <div className="flex items-center gap-1">
              <Home className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-amber-500">~{formatDuration(totalPresentationMinutes)} in homes ({inHomeCount})</span>
            </div>
          )}
          {gapDetails.count > 0 && (
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-orange-500">{gapDetails.count} gaps • longest {formatDuration(gapDetails.longest)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
