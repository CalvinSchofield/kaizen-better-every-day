import { useMemo, useEffect, useState, useCallback, Fragment } from "react";
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
import { Zap, Home, Clock, Coffee, ArrowRight } from "lucide-react";
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
}

// Clean color scheme with proper semantic distinction
const RING_COLORS = {
  knocking: 'hsl(210, 80%, 55%)',      // Blue - door knocking
  transition: 'hsl(45, 90%, 55%)',     // Amber - transition marker (thin)
  presentation: 'hsl(45, 90%, 55%)',   // Amber - presentation duration
  sale: 'hsl(142, 76%, 45%)',          // Green - sale duration
  break: 'hsl(35, 90%, 50%)',          // Orange - break
  gap: 'hsl(0, 0%, 25%)',              // Dark gray - gap
  background: 'hsl(0, 0%, 12%)',
  goalTrack: 'hsl(0, 0%, 18%)',
  goalProgress: 'hsl(142, 76%, 45%)',
};

const SEGMENT_LABELS: Record<string, string> = {
  knocking: 'Knocking',
  transition: 'Transition',
  presentation: 'Presentation',
  sale: 'Sale',
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
}: ActivityRingHeroProps) => {
  const [animationComplete, setAnimationComplete] = useState(false);
  const [selectedSegmentIdx, setSelectedSegmentIdx] = useState<number | null>(null);
  
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

  const { gapPercent, presentationPercent, totalPresentationMinutes, totalGapMinutes } = useMemo(() => {
    if (!segments.length || totalWorkMinutes === 0) {
      return { gapPercent: 0, presentationPercent: 0, totalPresentationMinutes: 0, totalGapMinutes: 0 };
    }
    
    const totalGapDegrees = segments
      .filter(s => s.type === 'gap')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    // Presentation time = presentations + sales (not transitions, they're just entry points)
    const totalPresentationDegrees = segments
      .filter(s => s.type === 'presentation' || s.type === 'sale')
      .reduce((sum, s) => sum + (s.endAngle - s.startAngle), 0);
    
    return {
      gapPercent: Math.round((totalGapDegrees / 360) * 100),
      presentationPercent: Math.round((totalPresentationDegrees / 360) * 100),
      totalPresentationMinutes: Math.round((totalPresentationDegrees / 360) * totalWorkMinutes),
      totalGapMinutes: Math.round((totalGapDegrees / 360) * totalWorkMinutes),
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
    const timer = setTimeout(() => setAnimationComplete(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleSegmentClick = useCallback((idx: number, segment: RingSegment, e: React.MouseEvent) => {
    e.stopPropagation();
    // Only interactive segments: transition, presentation, sale, break
    if (['transition', 'presentation', 'sale', 'break'].includes(segment.type)) {
      setSelectedSegmentIdx(selectedSegmentIdx === idx ? null : idx);
    }
  }, [selectedSegmentIdx]);

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

          {/* Goal ring - full loops (Apple style overflow) */}
          {showGoalRing && goalProgress > 0 && fullLoops > 0 && (
            <>
              {Array.from({ length: Math.min(fullLoops, 3) }).map((_, loopIdx) => (
                <motion.circle
                  key={`goal-loop-${loopIdx}`}
                  cx={center}
                  cy={center}
                  r={config.innerRadius}
                  fill="none"
                  stroke={RING_COLORS.goalProgress}
                  strokeWidth={config.innerStroke}
                  strokeLinecap="butt"
                  opacity={1 - loopIdx * 0.25}
                  strokeDasharray={`${2 * Math.PI * config.innerRadius}`}
                  strokeDashoffset={0}
                  initial={{ strokeDashoffset: 2 * Math.PI * config.innerRadius }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ 
                    duration: 0.8, 
                    delay: 0.2 + loopIdx * 0.3,
                    ease: "easeOut" 
                  }}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                />
              ))}
            </>
          )}

          {/* Goal ring - partial progress */}
          {showGoalRing && goalProgress > 0 && partialAngle > 0 && (
            <motion.path
              d={describeArc(center, center, config.innerRadius, 0, partialAngle)}
              fill="none"
              stroke={RING_COLORS.goalProgress}
              strokeWidth={config.innerStroke}
              strokeLinecap="butt"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ 
                duration: 0.8, 
                delay: 0.2 + fullLoops * 0.3,
                ease: "easeOut" 
              }}
            />
          )}

          {/* Timeline segments - outer ring */}
          <AnimatePresence>
            {segments.map((segment, idx) => {
              if (segment.endAngle <= segment.startAngle) return null;
              
              const arcSize = segment.endAngle - segment.startAngle;
              if (arcSize < 0.5) return null;
              
              const isTransition = segment.type === 'transition';
              const isBreak = segment.type === 'break';
              const isGap = segment.type === 'gap';
              const isSale = segment.type === 'sale';
              const isPresentation = segment.type === 'presentation';
              
              // Transitions are thin markers, presentations/sales are full arcs
              const strokeWidth = isTransition 
                ? config.strokeWidth * 0.4 
                : isGap 
                  ? config.strokeWidth - 4 
                  : config.strokeWidth;
              
              const pathD = describeArc(center, center, config.radius, segment.startAngle, segment.endAngle);
              
              return (
                <motion.path
                  key={`segment-${idx}`}
                  d={pathD}
                  fill="none"
                  stroke={RING_COLORS[segment.type]}
                  strokeWidth={strokeWidth}
                  strokeLinecap="butt"
                  opacity={isGap ? 0.5 : 1}
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: isGap ? 0.5 : 1 }}
                  transition={{ duration: 0.6, delay: idx * 0.02, ease: "easeOut" }}
                  style={{
                    strokeDasharray: isBreak ? '6 6' : undefined,
                    cursor: ['transition', 'presentation', 'sale', 'break'].includes(segment.type) ? 'pointer' : 'default',
                  }}
                  onClick={(e) => handleSegmentClick(idx, segment, e)}
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

        {/* Segment detail popovers */}
        {animationComplete && segments.map((segment, idx) => {
          if (!['transition', 'presentation', 'sale', 'break'].includes(segment.type)) return null;
          
          const midAngle = (segment.startAngle + segment.endAngle) / 2;
          const midRad = ((midAngle - 90) * Math.PI) / 180;
          const popoverDistance = config.radius + 35;
          const popoverX = center + popoverDistance * Math.cos(midRad);
          const popoverY = center + popoverDistance * Math.sin(midRad);
          
          const segmentMinutes = segment.duration || ((segment.endAngle - segment.startAngle) / 360) * totalWorkMinutes;
          
          return (
            <div
              key={`popover-${idx}`}
              className="absolute"
              style={{ left: popoverX, top: popoverY, transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}
            >
              <Popover open={selectedSegmentIdx === idx} onOpenChange={(open) => setSelectedSegmentIdx(open ? idx : null)}>
                <PopoverTrigger asChild>
                  <button className="w-1 h-1 opacity-0 pointer-events-none" />
                </PopoverTrigger>
                <PopoverContent side="top" className="w-auto px-3 py-2 bg-card border-border" sideOffset={8}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: RING_COLORS[segment.type] }} />
                    <span className="font-medium text-sm">{SEGMENT_LABELS[segment.type]}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-sm font-medium">{formatDuration(segmentMinutes)}</span>
                  </div>
                  {segment.source === 'estimated' && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      Duration estimated
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          );
        })}
        
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
      {showGapPercent && (presentationPercent > 0 || gapPercent > 0) && (
        <motion.div
          className="flex items-center justify-center gap-4 text-xs"
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
      
      {showLegend && <ActivityRingLegend />}
    </div>
  );
};
