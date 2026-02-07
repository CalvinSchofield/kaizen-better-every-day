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
import { ActivityRingLegend } from "./ActivityRingLegend";

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
  goalProgress?: number; // Deprecated - kept for compatibility
  showGoalRing?: boolean; // Deprecated - kept for compatibility
  showLegend?: boolean;
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
  showLegend = true,
  size = 'lg',
}: ActivityRingHeroProps) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Size configurations - single ring design
  const sizeConfig = {
    sm: { width: 160, radius: 60, strokeWidth: 14, fontSize: 'text-base' },
    md: { width: 220, radius: 85, strokeWidth: 18, fontSize: 'text-xl' },
    lg: { width: 280, radius: 110, strokeWidth: 22, fontSize: 'text-2xl' },
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

  // Parse all timeline events
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
    
    // Add sales events
    salesLog.forEach(sale => {
      if (sale.timestamp) {
        try {
          allEvents.push({ 
            timestamp: parseISO(sale.timestamp), 
            type: 'sale',
            prmr: sale.prmr,
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

  // Count sales
  const saleCount = salesLog.filter(s => s.type === 'fp').length;

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

          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={config.radius}
            fill="none"
            stroke={RING_COLORS.background}
            strokeWidth={config.strokeWidth}
            opacity={0.5}
          />

          {/* Timeline segments */}
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
        </motion.div>

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
      </div>
      
      {/* Legend */}
      {showLegend && <ActivityRingLegend />}
    </div>
  );
};
