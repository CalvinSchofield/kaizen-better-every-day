import { useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DailyEntry, Sale } from "@/hooks/useDailyEntry";
import { formatHoursMinutes, formatFP, formatPRMR } from "@/lib/formatters";
import { calculateFromSalesLog } from "@/utils/salesLogCalculations";
import { differenceInMinutes, parseISO } from "date-fns";

interface TimelineSegment {
  startAngle: number;
  endAngle: number;
  type: 'knocking' | 'in-home' | 'break' | 'gap' | 'sale' | 'active';
  intensity: number;
}

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
  goalProgress?: number; // 0-100 percentage
  showGoalRing?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const RING_COLORS = {
  knocking: 'hsl(142, 76%, 45%)', // Green for door activity
  'in-home': 'hsl(45, 93%, 55%)', // Amber for in-home time
  break: 'hsl(35, 90%, 60%)', // Orange for breaks
  gap: 'hsl(0, 0%, 30%)', // Dark gray for gaps
  sale: 'hsl(45, 100%, 55%)', // Gold for sales
  active: 'hsl(210, 90%, 60%)', // Blue for general activity
  background: 'hsl(0, 0%, 15%)', // Dark background track
  goalProgress: 'hsl(var(--primary))', // Primary color for goal ring
  goalTrack: 'hsl(0, 0%, 20%)', // Goal ring background
};

// Convert time to angle (0 = 12 o'clock / start of work)
const timeToAngle = (time: Date, workStart: Date, workEnd: Date): number => {
  const totalDuration = workEnd.getTime() - workStart.getTime();
  if (totalDuration <= 0) return 0;
  
  const elapsed = time.getTime() - workStart.getTime();
  const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
  
  // Map to 0-360 degrees, starting from top (-90 offset for SVG)
  return progress * 360;
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
  size = 'lg',
}: ActivityRingHeroProps) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  
  // Size configurations
  const sizeConfig = {
    sm: { width: 160, outerR: 65, innerR: 50, strokeWidth: 10, fontSize: 'text-base' },
    md: { width: 220, outerR: 90, innerR: 70, strokeWidth: 14, fontSize: 'text-xl' },
    lg: { width: 280, outerR: 115, innerR: 90, strokeWidth: 18, fontSize: 'text-2xl' },
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
          breakMinutes += differenceInMinutes(parseISO(bp.end), parseISO(bp.start));
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

  // Build timeline segments from counter timestamps
  const segments = useMemo<TimelineSegment[]>(() => {
    if (!workStart || !workEnd) return [];
    
    const allSegments: TimelineSegment[] = [];
    const timestamps = counterTimestamps || entry.counter_timestamps || {};
    
    // Gather all events with timestamps
    const events: Array<{ time: Date; type: string }> = [];
    
    Object.entries(timestamps).forEach(([type, times]) => {
      if (Array.isArray(times)) {
        times.forEach(t => {
          events.push({ time: parseISO(t), type });
        });
      }
    });
    
    // Add sales events
    salesLog.forEach(sale => {
      if (sale.timestamp) {
        events.push({ time: parseISO(sale.timestamp), type: 'sale' });
      }
    });
    
    // Sort by time
    events.sort((a, b) => a.time.getTime() - b.time.getTime());
    
    if (events.length === 0) {
      // No events - show full ring as gap
      allSegments.push({
        startAngle: 0,
        endAngle: 360,
        type: 'gap',
        intensity: 0.3,
      });
      return allSegments;
    }
    
    // Add break periods as segments
    const breakPeriods = entry.break_periods || [];
    const breakRanges: Array<{ start: number; end: number }> = breakPeriods
      .filter(bp => bp.start && bp.end)
      .map(bp => ({
        start: timeToAngle(parseISO(bp.start), workStart, workEnd),
        end: timeToAngle(parseISO(bp.end), workStart, workEnd),
      }));
    
    // Create segments from events with activity coloring
    let lastAngle = 0;
    
    events.forEach((event, idx) => {
      const eventAngle = timeToAngle(event.time, workStart, workEnd);
      
      // Check if there's a gap before this event
      if (eventAngle - lastAngle > 5) { // More than ~1.4% of day gap
        // Check if this gap overlaps with a break
        const isInBreak = breakRanges.some(br => 
          (lastAngle >= br.start && lastAngle < br.end) ||
          (eventAngle > br.start && eventAngle <= br.end)
        );
        
        allSegments.push({
          startAngle: lastAngle,
          endAngle: eventAngle,
          type: isInBreak ? 'break' : 'gap',
          intensity: isInBreak ? 0.7 : 0.3,
        });
      }
      
      // Determine segment type based on event
      let segmentType: TimelineSegment['type'] = 'active';
      
      if (event.type === 'sale' || event.type === 'closes') {
        segmentType = 'sale';
      } else if (event.type === 'transitions' || event.type === 'presentations') {
        segmentType = 'in-home';
      } else if (event.type === 'doors_knocked') {
        segmentType = 'knocking';
      }
      
      // Add the event segment (small arc representing activity)
      const segmentEnd = Math.min(eventAngle + 5, 360); // 5 degree width for event marker
      allSegments.push({
        startAngle: eventAngle,
        endAngle: segmentEnd,
        type: segmentType,
        intensity: segmentType === 'sale' ? 1 : 0.8,
      });
      
      lastAngle = segmentEnd;
    });
    
    // Fill remaining to end of day
    if (lastAngle < 360) {
      allSegments.push({
        startAngle: lastAngle,
        endAngle: 360,
        type: 'gap',
        intensity: 0.2,
      });
    }
    
    return allSegments;
  }, [workStart, workEnd, counterTimestamps, entry.counter_timestamps, entry.break_periods, salesLog]);

  // Clamp goal progress
  const clampedGoalProgress = Math.min(100, Math.max(0, goalProgress));
  const goalAngle = (clampedGoalProgress / 100) * 360;

  useEffect(() => {
    const timer = setTimeout(() => setAnimationComplete(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg 
          viewBox={`0 0 ${config.width} ${config.width}`}
          className="transform -rotate-0"
        >
          {/* Definitions for gradients and filters */}
          <defs>
            <filter id="glow-sale" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <linearGradient id="goalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--primary) / 0.7)" />
            </linearGradient>
          </defs>

          {/* Background track - outer ring */}
          <circle
            cx={center}
            cy={center}
            r={config.outerR}
            fill="none"
            stroke={RING_COLORS.background}
            strokeWidth={config.strokeWidth}
            opacity={0.4}
          />

          {/* Timeline segments - outer ring */}
          <AnimatePresence>
            {segments.map((segment, idx) => {
              if (segment.endAngle <= segment.startAngle) return null;
              
              const pathD = describeArc(
                center,
                center,
                config.outerR,
                segment.startAngle,
                segment.endAngle
              );
              
              const pathLength = ((segment.endAngle - segment.startAngle) / 360) * (2 * Math.PI * config.outerR);
              
              return (
                <motion.path
                  key={`segment-${idx}`}
                  d={pathD}
                  fill="none"
                  stroke={RING_COLORS[segment.type]}
                  strokeWidth={config.strokeWidth - (segment.type === 'gap' ? 4 : 0)}
                  strokeLinecap="round"
                  opacity={segment.intensity}
                  filter={segment.type === 'sale' ? 'url(#glow-sale)' : undefined}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ 
                    pathLength: 1, 
                    opacity: segment.intensity,
                  }}
                  transition={{ 
                    duration: 0.8, 
                    delay: idx * 0.02,
                    ease: "easeOut" 
                  }}
                  style={{
                    strokeDasharray: segment.type === 'break' ? '4 4' : undefined,
                  }}
                />
              );
            })}
          </AnimatePresence>

          {/* Goal progress ring - inner ring */}
          {showGoalRing && (
            <>
              {/* Goal track background */}
              <circle
                cx={center}
                cy={center}
                r={config.innerR}
                fill="none"
                stroke={RING_COLORS.goalTrack}
                strokeWidth={config.strokeWidth - 6}
                opacity={0.3}
              />
              
              {/* Goal progress arc */}
              {goalAngle > 0 && (
                <motion.path
                  d={describeArc(center, center, config.innerR, 0, goalAngle)}
                  fill="none"
                  stroke="url(#goalGradient)"
                  strokeWidth={config.strokeWidth - 6}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
                />
              )}
            </>
          )}
        </svg>

        {/* Center stats */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center text-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.6 }}
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
        {animationComplete && salesLog.filter(s => s.type === 'fp').length > 0 && (
          <motion.div
            className="absolute top-0 right-0 -mt-1 -mr-1"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 400, delay: 1 }}
          >
            <span className="text-2xl">⭐</span>
          </motion.div>
        )}
      </div>
    </div>
  );
};
