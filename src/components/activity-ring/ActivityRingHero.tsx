import { useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import { formatHoursMinutes, formatFP, formatPRMR } from "@/lib/formatters";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { differenceInMinutes, parseISO } from "date-fns";
import { 
  calculateInHomeZones, 
  buildRingSegments,
  TimelineEvent,
  RingSegment,
} from "@/utils/inHomeZoneCalculator";
import { detectBulkEntry } from "@/utils/bulkEntryDetector";
import { ActivityRingLegend } from "./ActivityRingLegend";
import { Zap } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ActivityRingHeroProps {
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
  goalProgress?: number; // 0-100, percentage towards daily goal
  showGoalRing?: boolean; // Whether to show inner goal ring (default true when goalProgress > 0)
  showLegend?: boolean;
  showGapPercent?: boolean; // Whether to show gap percentage (for leaders)
  size?: 'sm' | 'md' | 'lg';
}

// New simplified color scheme - solid, clear colors
const RING_COLORS = {
  knocking: 'hsl(210, 80%, 55%)',   // Blue - active door work
  'in-home': 'hsl(45, 90%, 55%)',   // Amber/Gold - in a home presenting
  sale: 'hsl(142, 76%, 45%)',        // Green - matches goal color
  break: 'hsl(35, 90%, 50%)',        // Orange - break time
  gap: 'hsl(0, 0%, 25%)',            // Dark gray - not working
  background: 'hsl(0, 0%, 12%)',     // Ring background track
  goalTrack: 'hsl(0, 0%, 18%)',      // Inner ring track
  goalProgress: 'hsl(142, 76%, 45%)', // Green - goal progress
};

// Create SVG arc path
const describeArc = (
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string => {
  // Convert to radians and adjust for SVG coordinate system
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;
  
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
};

export const ActivityRingHero = ({
  entry,
  counterTimestamps,
  salesLog = [],
  goalProgress = 0,
  showGoalRing = true,
  showLegend = true,
  showGapPercent = false,
  size = 'lg',
}: ActivityRingHeroProps) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Size configurations - outer ring + inner goal ring
  const sizeConfig = {
    sm: { width: 160, radius: 60, strokeWidth: 14, innerRadius: 42, innerStroke: 8, fontSize: 'text-base' },
    md: { width: 220, radius: 85, strokeWidth: 18, innerRadius: 60, innerStroke: 10, fontSize: 'text-xl' },
    lg: { width: 280, radius: 110, strokeWidth: 22, innerRadius: 78, innerStroke: 12, fontSize: 'text-2xl' },
  };
  
  const config = sizeConfig[size];
  const center = config.width / 2;

  // Calculate work hours
  const { hoursWorked, workStart, workEnd } = useMemo(() => {
    if (!entry.work_start_time || !entry.work_end_time) {
      return { hoursWorked: 0, workStart: null, workEnd: null };
    }
    
    const start = parseISO(entry.work_start_time);
    const end = parseISO(entry.work_end_time);
    const minutes = differenceInMinutes(end, start);
    
    // Subtract break time
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
    };
  }, [entry.work_start_time, entry.work_end_time, entry.break_periods]);

  // Calculate FP and PRMR from sales log
  const { fp, prmr } = useMemo(() => {
    if (salesLog && salesLog.length > 0) {
      return calculateFromSalesLog(salesLog);
    }
    return { fp: entry.fp_plus || 0, prmr: entry.prmr || 0 };
  }, [salesLog, entry.fp_plus, entry.prmr]);

  // Parse all timeline events - including time_to_sell from sales log
  const events = useMemo<TimelineEvent[]>(() => {
    const allEvents: TimelineEvent[] = [];
    const timestamps = counterTimestamps || entry.counter_timestamps || {};
    
    Object.entries(timestamps).forEach(([type, times]) => {
      if (Array.isArray(times)) {
        times.forEach(t => {
          try {
            const eventType = type as TimelineEvent['type'];
            if (['doors_knocked', 'decision_makers', 'pitches', 'transitions', 'presentations', 'closes'].includes(eventType)) {
              allEvents.push({
                timestamp: parseISO(t),
                type: eventType,
              });
            }
          } catch {
            // Skip invalid dates
          }
        });
      }
    });
    
    // Add sales events with time_to_sell data for accurate in-home detection
    salesLog.forEach(sale => {
      if (sale.timestamp) {
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

  // Build ring segments using the shared calculator
  const segments = useMemo<RingSegment[]>(() => {
    if (!workStart || !workEnd) {
      // No work time data - show empty ring
      return [{ startAngle: 0, endAngle: 360, type: 'gap' }];
    }
    
    const inHomeZones = calculateInHomeZones(events, workStart, workEnd);
    return buildRingSegments(events, inHomeZones, entry.break_periods || [], workStart, workEnd);
  }, [events, workStart, workEnd, entry.break_periods]);

  // Calculate gap and in-home percentages from segments
  const { gapPercent, inHomePercent } = useMemo(() => {
    if (!segments.length) return { gapPercent: 0, inHomePercent: 0 };
    
    const totalGapDegrees = segments
      .filter(s => s.type === 'gap')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    const totalInHomeDegrees = segments
      .filter(s => s.type === 'in-home' || s.type === 'sale')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    return {
      gapPercent: Math.round((totalGapDegrees / 360) * 100),
      inHomePercent: Math.round((totalInHomeDegrees / 360) * 100),
    };
  }, [segments]);

  // Count sales
  const saleCount = salesLog.filter(s => s.type === 'fp').length;

  // Detect bulk entry for leader warning
  const bulkEntryStats = useMemo(() => {
    const timestamps = counterTimestamps || entry.counter_timestamps || {};
    return detectBulkEntry(timestamps);
  }, [counterTimestamps, entry.counter_timestamps]);

  // Goal ring progress (capped at 100%)
  const goalAngle = Math.min(100, goalProgress) * 3.6; // 360 * (progress/100)

  useEffect(() => {
    const timer = setTimeout(() => setAnimationComplete(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg 
          viewBox={`0 0 ${config.width} ${config.width}`}
          className="transform"
        >
          {/* Definitions for glow effect on sales */}
          <defs>
            <filter id="glow-sale" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background track - outer ring */}
          <circle
            cx={center}
            cy={center}
            r={config.radius}
            fill="none"
            stroke={RING_COLORS.background}
            strokeWidth={config.strokeWidth}
            opacity={0.5}
          />

          {/* Inner goal ring - background track */}
          {showGoalRing && goalProgress > 0 && (
            <circle
              cx={center}
              cy={center}
              r={config.innerRadius}
              fill="none"
              stroke={RING_COLORS.goalTrack}
              strokeWidth={config.innerStroke}
              opacity={0.6}
            />
          )}

          {/* Inner goal ring - progress */}
          {showGoalRing && goalProgress > 0 && goalAngle > 0 && (
            <motion.path
              d={describeArc(center, center, config.innerRadius, 0, goalAngle)}
              fill="none"
              stroke={RING_COLORS.goalProgress}
              strokeWidth={config.innerStroke}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            />
          )}

          {/* Timeline segments - outer ring */}
          <AnimatePresence>
            {segments.map((segment, idx) => {
              if (segment.endAngle <= segment.startAngle) return null;
              
              // Ensure minimum visible arc size
              const arcSize = segment.endAngle - segment.startAngle;
              if (arcSize < 1) return null;
              
              const pathD = describeArc(
                center,
                center,
                config.radius,
                segment.startAngle,
                segment.endAngle
              );
              
              const isSale = segment.type === 'sale';
              const isBreak = segment.type === 'break';
              const isGap = segment.type === 'gap';
              
              return (
                <motion.path
                  key={`segment-${idx}`}
                  d={pathD}
                  fill="none"
                  stroke={RING_COLORS[segment.type]}
                  strokeWidth={isGap ? config.strokeWidth - 4 : config.strokeWidth}
                  strokeLinecap="round"
                  opacity={isGap ? 0.6 : 1}
                  filter={isSale ? 'url(#glow-sale)' : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: 1, 
                    opacity: isGap ? 0.6 : 1,
                  }}
                  transition={{ 
                    duration: 0.6, 
                    delay: idx * 0.03,
                    ease: "easeOut" 
                  }}
                  style={{
                    strokeDasharray: isBreak ? '6 6' : undefined,
                  }}
                />
              );
            })}
          </AnimatePresence>
        </svg>

        {/* Center stats */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.5 }}
        >
          <div className={`font-bold tabular-nums text-foreground ${config.fontSize}`}>
            {formatFP(fp)} FP+
          </div>
          <div className="text-sm text-muted-foreground tabular-nums">
            ${formatPRMR(prmr)}
          </div>
        <div className="text-xs text-muted-foreground mt-1">
          {formatHoursMinutes(hoursWorked)}
        </div>
        {/* Activity breakdown for leaders */}
        {showGapPercent && (gapPercent > 0 || inHomePercent > 0) && (
          <div className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-2">
            {inHomePercent > 0 && (
              <span style={{ color: 'hsl(45, 90%, 55%)' }}>{inHomePercent}% in-home</span>
            )}
            {gapPercent > 0 && (
              <span>{gapPercent}% gaps</span>
            )}
          </div>
        )}
        </motion.div>

        {/* Sale celebration markers */}
        {/* Sale celebration markers */}
        {animationComplete && saleCount > 0 && (
          <motion.div
            className="absolute top-0 right-0 -mt-1 -mr-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 1 }}
          >
            <span className="text-2xl">{saleCount > 1 ? `${saleCount}⭐` : '⭐'}</span>
          </motion.div>
        )}
        
        {/* Bulk entry warning badge for leaders */}
        {showGapPercent && bulkEntryStats.bulkEntryDetected && (
          <Popover>
            <PopoverTrigger asChild>
              <motion.button
                className="absolute top-0 left-0 -mt-1 -ml-1 flex items-center gap-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full border border-orange-500/30 hover:bg-orange-500/30 active:scale-95 transition-all"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 400, delay: 1.2 }}
              >
                <Zap className="w-3 h-3" />
                {bulkEntryStats.largestBatch}
              </motion.button>
            </PopoverTrigger>
            <PopoverContent side="top" className="w-64 p-0 bg-card border-border">
              <div className="px-3 py-2 bg-orange-500/15 border-b border-orange-500/25 flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-400" />
                <span className="font-bold text-sm text-orange-400">Bulk Entry Detected</span>
              </div>
              <div className="p-3 text-xs text-muted-foreground space-y-2">
                <p>
                  This rep logged <span className="font-semibold text-foreground">{bulkEntryStats.batchedEventsPercent}%</span> of 
                  their activity in rapid bursts rather than real-time.
                </p>
                <p>
                  The timeline may not accurately reflect their actual work patterns. 
                  Consider coaching on real-time logging.
                </p>
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        {/* Goal progress indicator (small badge) */}
        {showGoalRing && goalProgress > 0 && (
          <motion.div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.8 }}
          >
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
              goalProgress >= 100 
                ? 'bg-primary/20 text-primary' 
                : 'bg-muted/50 text-muted-foreground'
            }`}>
              {Math.round(goalProgress)}% of goal
            </span>
          </motion.div>
        )}
      </div>
      
      {/* Legend */}
      {showLegend && <ActivityRingLegend />}
    </div>
  );
};
