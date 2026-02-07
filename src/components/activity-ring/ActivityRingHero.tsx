import { useMemo, useEffect, useState, useCallback } from "react";
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
  goalProgress?: number; // 0-100+, percentage towards daily goal (can exceed 100 for overflow)
  showGoalRing?: boolean;
  showLegend?: boolean;
  showGapPercent?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onSegmentClick?: (segment: RingSegment, matchedSale?: Sale) => void;
}

// Clean color scheme with proper semantic distinction
const RING_COLORS = {
  knocking: 'hsl(210, 80%, 55%)',      // Blue - door knocking
  doorstep: 'hsl(180, 60%, 50%)',      // Cyan/teal - doorstep conversations
  transition: 'hsl(45, 90%, 55%)',     // Amber - transition marker (thin)
  presentation: 'hsl(45, 90%, 55%)',   // Amber - presentation duration
  sale: 'hsl(142, 76%, 45%)',          // Green - sale duration
  seen_out: 'hsl(45, 90%, 55%)',       // Amber - seen out (short arc)
  break: 'hsl(35, 90%, 50%)',          // Orange - break
  gap: 'hsl(0, 0%, 25%)',              // Dark gray - gap (true idle)
  background: 'hsl(0, 0%, 12%)',
  goalTrack: 'hsl(0, 0%, 18%)',
  goalProgress: 'hsl(142, 76%, 45%)',  // Base green for 0-100%
  goalOverflow: 'hsl(142, 76%, 60%)',  // Lighter green for overflow (like Apple's distinct overflow color)
};

const SEGMENT_LABELS: Record<string, string> = {
  knocking: 'Knocking',
  doorstep: 'Doorstep Talk',
  transition: 'Transition',
  presentation: 'Presentation',
  sale: 'Sale',
  seen_out: 'Seen Out',
  break: 'Break',
  gap: 'Gap',
};

// Create SVG arc path
const describeArc = (
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string => {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endRad = ((endAngle - 90) * Math.PI) / 180;
  
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
};

const formatDuration = (minutes: number): string => {
  if (minutes < 1) return '<1m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
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
  onSegmentClick,
}: ActivityRingHeroProps) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  
  const sizeConfig = {
    sm: { width: 160, radius: 60, strokeWidth: 14, innerRadius: 42, innerStroke: 8, fontSize: 'text-base' },
    md: { width: 220, radius: 85, strokeWidth: 18, innerRadius: 60, innerStroke: 10, fontSize: 'text-xl' },
    lg: { width: 280, radius: 110, strokeWidth: 22, innerRadius: 78, innerStroke: 12, fontSize: 'text-2xl' },
  };
  
  const config = sizeConfig[size];
  const center = config.width / 2;

  const { hoursWorked, workStart, workEnd, totalWorkMinutes } = useMemo(() => {
    if (!entry.work_start_time || !entry.work_end_time) {
      return { hoursWorked: 0, workStart: null, workEnd: null, totalWorkMinutes: 0 };
    }
    
    const start = parseISO(entry.work_start_time);
    const end = parseISO(entry.work_end_time);
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
    };
  }, [entry.work_start_time, entry.work_end_time, entry.break_periods]);

  const { fp, prmr } = useMemo(() => {
    if (salesLog && salesLog.length > 0) {
      return calculateFromSalesLog(salesLog);
    }
    return { fp: entry.fp_plus || 0, prmr: entry.prmr || 0 };
  }, [salesLog, entry.fp_plus, entry.prmr]);

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
    
    // Only add sales from sales_log if they have valid FP (not install_status: never_installed)
    salesLog.forEach(sale => {
      if (sale.timestamp) {
        // Skip sales that don't count (never installed = no actual sale)
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

  const { gapPercent, presentationPercent, doorstepPercent, totalPresentationMinutes, totalGapMinutes, totalDoorstepMinutes } = useMemo(() => {
    if (!segments.length || totalWorkMinutes === 0) {
      return { gapPercent: 0, presentationPercent: 0, doorstepPercent: 0, totalPresentationMinutes: 0, totalGapMinutes: 0, totalDoorstepMinutes: 0 };
    }
    
    const totalGapDegrees = segments
      .filter(s => s.type === 'gap')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    // Presentation time = presentations + sales + seen_out (all in-home time)
    const totalPresentationDegrees = segments
      .filter(s => s.type === 'presentation' || s.type === 'sale' || s.type === 'seen_out')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    // Doorstep time = doorstep conversations (talking but not entering)
    const totalDoorstepDegrees = segments
      .filter(s => s.type === 'doorstep')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    return {
      gapPercent: Math.round((totalGapDegrees / 360) * 100),
      presentationPercent: Math.round((totalPresentationDegrees / 360) * 100),
      doorstepPercent: Math.round((totalDoorstepDegrees / 360) * 100),
      totalPresentationMinutes: Math.round((totalPresentationDegrees / 360) * totalWorkMinutes),
      totalGapMinutes: Math.round((totalGapDegrees / 360) * totalWorkMinutes),
      totalDoorstepMinutes: Math.round((totalDoorstepDegrees / 360) * totalWorkMinutes),
    };
  }, [segments, totalWorkMinutes]);

  const bulkEntryStats = useMemo(() => {
    const timestamps = counterTimestamps || entry.counter_timestamps || {};
    return detectBulkEntry(timestamps);
  }, [counterTimestamps, entry.counter_timestamps]);

  // Apple-style overflow: allows multiple loops (150% = 1.5 loops)
  const goalLoops = goalProgress / 100;
  const fullLoops = Math.floor(goalLoops);
  const partialAngle = (goalLoops - fullLoops) * 360;

  useEffect(() => {
    const timer = setTimeout(() => setAnimationComplete(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Find matching sale for a segment based on timestamp overlap
  const findMatchingSale = useCallback((segment: RingSegment): Sale | undefined => {
    if (segment.type !== 'sale' || !workStart || !workEnd || !salesLog.length) return undefined;
    
    // Convert segment angles to time
    const totalDuration = workEnd.getTime() - workStart.getTime();
    const segmentEndTime = new Date(workStart.getTime() + (segment.endAngle / 360) * totalDuration);
    
    // Find sale closest to segment end time
    return salesLog.find(sale => {
      if (!sale.timestamp) return false;
      const saleTime = parseISO(sale.timestamp);
      const timeDiff = Math.abs(saleTime.getTime() - segmentEndTime.getTime());
      return timeDiff < 5 * 60 * 1000; // Within 5 minutes
    });
  }, [salesLog, workStart, workEnd]);

  const handleSegmentClick = useCallback((segment: RingSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    // Only interactive segments: transition, presentation, sale, break, gap, doorstep, seen_out
    if (['transition', 'presentation', 'sale', 'break', 'gap', 'doorstep', 'seen_out'].includes(segment.type) && onSegmentClick) {
      const matchedSale = findMatchingSale(segment);
      onSegmentClick(segment, matchedSale);
    }
  }, [onSegmentClick, findMatchingSale]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: config.width, height: config.width }}>
        <svg viewBox={`0 0 ${config.width} ${config.width}`} className="transform">
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

          {/* Goal ring - Apple style: base loop (0-100%) always shows first */}
          {showGoalRing && goalProgress > 0 && (
            <motion.circle
              cx={center}
              cy={center}
              r={config.innerRadius}
              fill="none"
              stroke={RING_COLORS.goalProgress}
              strokeWidth={config.innerStroke}
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * config.innerRadius}`}
              strokeDashoffset={2 * Math.PI * config.innerRadius * (1 - Math.min(goalLoops, 1))}
              initial={{ strokeDashoffset: 2 * Math.PI * config.innerRadius }}
              animate={{ 
                strokeDashoffset: 2 * Math.PI * config.innerRadius * (1 - Math.min(goalLoops, 1))
              }}
              transition={{ 
                duration: 0.6, 
                delay: 0.1,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
            />
          )}

          {/* Goal ring - overflow loops (>100%) with distinct lighter color */}
          {showGoalRing && goalProgress > 100 && (
            <>
              {/* Full overflow loops */}
              {Array.from({ length: Math.min(fullLoops - 1, 2) }).map((_, loopIdx) => (
                <motion.circle
                  key={`goal-overflow-${loopIdx}`}
                  cx={center}
                  cy={center}
                  r={config.innerRadius}
                  fill="none"
                  stroke={RING_COLORS.goalOverflow}
                  strokeWidth={config.innerStroke}
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * config.innerRadius}`}
                  strokeDashoffset={0}
                  initial={{ strokeDashoffset: 2 * Math.PI * config.innerRadius }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ 
                    duration: 0.5, 
                    delay: 0.7 + loopIdx * 0.3,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
              ))}
              
              {/* Partial overflow (the final arc after full loops) */}
              {partialAngle > 0 && (
                <motion.path
                  d={describeArc(center, center, config.innerRadius, 0, partialAngle)}
                  fill="none"
                  stroke={RING_COLORS.goalOverflow}
                  strokeWidth={config.innerStroke}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ 
                    duration: 0.4, 
                    delay: 0.7 + Math.min(fullLoops - 1, 2) * 0.3,
                    ease: [0.25, 0.1, 0.25, 1],
                  }}
                />
              )}
            </>
          )}

          {/* Timeline segments - outer ring (render in layers for proper visibility) */}
          <AnimatePresence>
            {/* Layer 1: Base segments (gaps, knocking, breaks) - drawn first (background) */}
            {segments
              .filter(s => ['gap', 'knocking', 'break'].includes(s.type))
              .map((segment, idx) => {
                const arcSize = segment.endAngle - segment.startAngle;
                if (arcSize < 0.5) return null;
                
                const isBreak = segment.type === 'break';
                const isGap = segment.type === 'gap';
                const strokeWidth = isGap ? config.strokeWidth - 4 : config.strokeWidth;
                const pathD = describeArc(center, center, config.radius, segment.startAngle, segment.endAngle);
                const originalIdx = segments.indexOf(segment);
                
                return (
                  <motion.path
                    key={`base-${originalIdx}`}
                    d={pathD}
                    fill="none"
                    stroke={RING_COLORS[segment.type]}
                    strokeWidth={strokeWidth}
                    strokeLinecap="butt"
                    opacity={isGap ? 0.5 : 1}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: isGap ? 0.5 : 1 }}
                    transition={{ duration: 0.3, delay: originalIdx * 0.01, ease: "easeOut" }}
                    style={{
                      strokeDasharray: isBreak ? '6 6' : undefined,
                      cursor: (isBreak || isGap) ? 'pointer' : 'default',
                    }}
                    onClick={(e) => handleSegmentClick(segment, e)}
                  />
                );
              })}
            
            {/* Layer 1.5: Doorstep conversations (above knocking, below in-home) */}
            {segments
              .filter(s => s.type === 'doorstep')
              .map((segment) => {
                const arcSize = segment.endAngle - segment.startAngle;
                if (arcSize < 0.5) return null;
                
                const pathD = describeArc(center, center, config.radius, segment.startAngle, segment.endAngle);
                const originalIdx = segments.indexOf(segment);
                
                return (
                  <motion.path
                    key={`doorstep-${originalIdx}`}
                    d={pathD}
                    fill="none"
                    stroke={RING_COLORS.doorstep}
                    strokeWidth={config.strokeWidth}
                    strokeLinecap="butt"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: originalIdx * 0.01, ease: "easeOut" }}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => handleSegmentClick(segment, e)}
                  />
                );
              })}
            
            {/* Layer 2: Presentation, Sale & Seen Out arcs (middle layer) */}
            {segments
              .filter(s => ['presentation', 'sale', 'seen_out'].includes(s.type))
              .map((segment) => {
                const arcSize = segment.endAngle - segment.startAngle;
                if (arcSize < 0.5) return null;
                
                const pathD = describeArc(center, center, config.radius, segment.startAngle, segment.endAngle);
                const originalIdx = segments.indexOf(segment);
                
                return (
                  <motion.path
                    key={`inhome-${originalIdx}`}
                    d={pathD}
                    fill="none"
                    stroke={RING_COLORS[segment.type]}
                    strokeWidth={config.strokeWidth}
                    strokeLinecap="butt"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.3, delay: originalIdx * 0.01, ease: "easeOut" }}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => handleSegmentClick(segment, e)}
                  />
                );
              })}
            
            {/* Layer 3: Transition markers (top layer - always visible) */}
            {segments
              .filter(s => s.type === 'transition')
              .map((segment) => {
                const arcSize = segment.endAngle - segment.startAngle;
                if (arcSize < 0.3) return null;
                
                const pathD = describeArc(center, center, config.radius, segment.startAngle, segment.endAngle);
                const originalIdx = segments.indexOf(segment);
                
                return (
                  <motion.path
                    key={`transition-${originalIdx}`}
                    d={pathD}
                    fill="none"
                    stroke={RING_COLORS.transition}
                    strokeWidth={config.strokeWidth * 0.4}
                    strokeLinecap="butt"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 0.25, delay: 0.3 + originalIdx * 0.01, ease: "easeOut" }}
                    style={{ cursor: 'pointer' }}
                    onClick={(e) => handleSegmentClick(segment, e)}
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
          transition={{ duration: 0.25, delay: 0.2 }}
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

        {/* Bulk entry warning */}
        {showGapPercent && bulkEntryStats.bulkEntryDetected && (
          <Popover>
            <PopoverTrigger asChild>
              <motion.button
                className="absolute top-0 left-0 -mt-1 -ml-1 flex items-center gap-0.5 text-[10px] font-semibold bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full border border-orange-500/30 active:scale-95 transition-all"
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
                  activity in rapid bursts.
                </p>
                <p>Timeline may not reflect actual patterns. Consider coaching on real-time logging.</p>
              </div>
            </PopoverContent>
          </Popover>
        )}
        
        {/* Goal progress badge */}
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
      
      {/* Activity breakdown */}
      {showGapPercent && (presentationPercent > 0 || doorstepPercent > 0 || gapPercent > 0) && (
        <motion.div
          className="flex items-center justify-center gap-4 text-xs flex-wrap"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          {presentationPercent > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RING_COLORS.presentation }} />
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{presentationPercent}%</span> presenting
                <span className="text-muted-foreground/70 ml-1">({formatDuration(totalPresentationMinutes)})</span>
              </span>
            </div>
          )}
          {doorstepPercent > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RING_COLORS.doorstep }} />
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{doorstepPercent}%</span> doorstep
                <span className="text-muted-foreground/70 ml-1">({formatDuration(totalDoorstepMinutes)})</span>
              </span>
            </div>
          )}
          {gapPercent > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: RING_COLORS.gap }} />
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{gapPercent}%</span> gaps
                <span className="text-muted-foreground/70 ml-1">({formatDuration(totalGapMinutes)})</span>
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
