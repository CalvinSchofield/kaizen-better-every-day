import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { 
  DoorOpen, 
  Users, 
  MessageSquare, 
  ArrowRight, 
  Presentation, 
  Handshake,
  DollarSign,
  Play,
  Square,
  Coffee,
  Home,
  X
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

interface TimelineEvent {
  timestamp: Date;
  type: 'doors_knocked' | 'decision_makers' | 'pitches' | 'transitions' | 'presentations' | 'closes' | 'sale';
  label: string;
  prmr?: number;
}

interface BreakPeriod {
  start: string;
  end: string;
}

interface GapPeriod {
  start: number; // position %
  end: number; // position %
  duration: number; // minutes
  startTime: Date;
  endTime: Date;
  type: 'in_home' | 'break' | 'inactivity';
  contextBefore?: TimelineEvent;
  contextAfter?: TimelineEvent;
}

interface RepDayActivityFlowProps {
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
  workStartTime?: string;
  workEndTime?: string;
  isFinalized?: boolean;
  breakPeriods?: BreakPeriod[];
}

const EVENT_CONFIG: Record<string, { 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bgColor: string;
  height: number;
  label: string;
  funnelOrder: number; // Higher = deeper in funnel
}> = {
  doors_knocked: { 
    icon: DoorOpen, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500',
    height: 16,
    label: 'Door',
    funnelOrder: 1,
  },
  decision_makers: { 
    icon: Users, 
    color: 'text-purple-500', 
    bgColor: 'bg-purple-500',
    height: 20,
    label: 'DM',
    funnelOrder: 2,
  },
  pitches: { 
    icon: MessageSquare, 
    color: 'text-cyan-500', 
    bgColor: 'bg-cyan-500',
    height: 24,
    label: 'Pitch',
    funnelOrder: 3,
  },
  transitions: { 
    icon: ArrowRight, 
    color: 'text-amber-500', 
    bgColor: 'bg-amber-500',
    height: 28,
    label: 'Transition',
    funnelOrder: 4,
  },
  presentations: { 
    icon: Presentation, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500',
    height: 32,
    label: 'Presentation',
    funnelOrder: 5,
  },
  closes: { 
    icon: Handshake, 
    color: 'text-green-600', 
    bgColor: 'bg-green-600',
    height: 36,
    label: 'Close',
    funnelOrder: 6,
  },
  sale: { 
    icon: DollarSign, 
    color: 'text-green-500', 
    bgColor: 'bg-green-500',
    height: 48,
    label: 'Sale',
    funnelOrder: 7,
  },
};

// Funnel types that suggest the rep is "in a home" when they follow a door knock
const IN_HOME_ACTIVITY_TYPES = ['transitions', 'presentations', 'closes', 'sale', 'decision_makers', 'pitches'];

const formatTimeOnly = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
};

const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${Math.round(minutes)}m`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

export const RepDayActivityFlow = ({
  counterTimestamps,
  salesLog,
  workStartTime,
  workEndTime,
  isFinalized,
  breakPeriods,
}: RepDayActivityFlowProps) => {
  // Parse all events from counter timestamps
  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

    // Add counter timestamps
    if (counterTimestamps) {
      Object.entries(counterTimestamps).forEach(([type, timestamps]) => {
        if (Array.isArray(timestamps)) {
          timestamps.forEach(ts => {
            const eventType = type as TimelineEvent['type'];
            if (EVENT_CONFIG[eventType]) {
              allEvents.push({
                timestamp: new Date(ts),
                type: eventType,
                label: EVENT_CONFIG[eventType].label,
              });
            }
          });
        }
      });
    }

    // Add sales from sales_log
    if (salesLog && Array.isArray(salesLog)) {
      salesLog.forEach(sale => {
        if (sale.timestamp) {
          allEvents.push({
            timestamp: new Date(sale.timestamp),
            type: 'sale',
            label: sale.type === 'upgrade' ? 'Upgrade' : 'FP Sale',
            prmr: sale.prmr,
          });
        }
      });
    }

    // Sort by timestamp
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [counterTimestamps, salesLog]);

  // Calculate time bounds
  const { startTime, endTime, totalMinutes } = useMemo(() => {
    let start = workStartTime ? new Date(workStartTime) : null;
    let end = workEndTime ? new Date(workEndTime) : null;

    // Expand bounds based on events if needed
    events.forEach(event => {
      if (!start || event.timestamp < start) {
        start = event.timestamp;
      }
      if (!end || event.timestamp > end) {
        end = event.timestamp;
      }
    });

    // Default to current time if no end and not finalized
    if (!end && !isFinalized) {
      end = new Date();
    }

    if (!start || !end) {
      return { startTime: null, endTime: null, totalMinutes: 0 };
    }

    const total = Math.max((end.getTime() - start.getTime()) / (1000 * 60), 60);
    
    return { startTime: start, endTime: end, totalMinutes: total };
  }, [events, workStartTime, workEndTime, isFinalized]);

  // Parse break periods into timeline positions
  const parsedBreaks = useMemo(() => {
    if (!breakPeriods || !startTime || !totalMinutes) return [];
    
    return breakPeriods
      .filter(bp => bp.start && bp.end)
      .map(bp => {
        const breakStart = new Date(bp.start);
        const breakEnd = new Date(bp.end);
        const startPos = ((breakStart.getTime() - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
        const endPos = ((breakEnd.getTime() - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
        const duration = (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60);
        
        return {
          start: Math.max(0, startPos),
          end: Math.min(100, endPos),
          duration,
          startTime: breakStart,
          endTime: breakEnd,
        };
      })
      .filter(bp => bp.end > bp.start);
  }, [breakPeriods, startTime, totalMinutes]);

  // Generate hour markers
  const hourMarkers = useMemo(() => {
    if (!startTime || !endTime) return [];
    
    const markers: { time: Date; label: string; position: number }[] = [];
    const startHour = new Date(startTime);
    startHour.setMinutes(0, 0, 0);
    
    // Move to next hour if start isn't on the hour
    if (startTime.getMinutes() > 0) {
      startHour.setHours(startHour.getHours() + 1);
    }
    
    let current = new Date(startHour);
    while (current <= endTime) {
      const position = ((current.getTime() - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
      if (position >= 0 && position <= 100) {
        markers.push({
          time: new Date(current),
          label: current.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true }),
          position,
        });
      }
      current.setHours(current.getHours() + 1);
    }
    
    return markers;
  }, [startTime, endTime, totalMinutes]);

  // Smart gap detection with context analysis
  const gaps = useMemo(() => {
    if (events.length < 2 || !startTime) return [];
    
    const gapPeriods: GapPeriod[] = [];
    
    for (let i = 1; i < events.length; i++) {
      const prevEvent = events[i - 1];
      const currEvent = events[i];
      const gapMinutes = (currEvent.timestamp.getTime() - prevEvent.timestamp.getTime()) / (1000 * 60);
      
      if (gapMinutes >= 15) {
        const startPos = ((prevEvent.timestamp.getTime() - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
        const endPos = ((currEvent.timestamp.getTime() - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
        
        // Check if this gap overlaps with a break period
        const isBreak = parsedBreaks.some(bp => {
          const overlapStart = Math.max(prevEvent.timestamp.getTime(), bp.startTime.getTime());
          const overlapEnd = Math.min(currEvent.timestamp.getTime(), bp.endTime.getTime());
          return overlapEnd > overlapStart;
        });
        
        // Determine if this looks like "in-home" activity
        // Pattern: door/DM followed by deeper funnel activities (transition, presentation, sale)
        // The rep knocked, then logged everything after leaving
        const prevFunnelOrder = EVENT_CONFIG[prevEvent.type]?.funnelOrder || 0;
        const currFunnelOrder = EVENT_CONFIG[currEvent.type]?.funnelOrder || 0;
        
        // In-home indicators:
        // 1. Previous event is door knock or DM, followed by transition/presentation/close/sale
        // 2. Multiple funnel events logged close together after a gap (batch logging after leaving)
        const isInHomePattern = 
          (prevEvent.type === 'doors_knocked' || prevEvent.type === 'decision_makers') &&
          IN_HOME_ACTIVITY_TYPES.includes(currEvent.type);
        
        // Check if next few events are deeper funnel activities logged together (batch)
        let isBatchLogging = false;
        if (i + 1 < events.length) {
          const nextEvent = events[i + 1];
          const timeBetweenCurrAndNext = (nextEvent.timestamp.getTime() - currEvent.timestamp.getTime()) / (1000 * 60);
          // If next event is within 2 minutes and is deeper in funnel, likely batch logging
          if (timeBetweenCurrAndNext < 2 && currFunnelOrder < (EVENT_CONFIG[nextEvent.type]?.funnelOrder || 0)) {
            isBatchLogging = true;
          }
        }
        
        const gapType: GapPeriod['type'] = isBreak 
          ? 'break' 
          : (isInHomePattern || isBatchLogging) 
            ? 'in_home' 
            : 'inactivity';
        
        gapPeriods.push({
          start: startPos,
          end: endPos,
          duration: gapMinutes,
          startTime: prevEvent.timestamp,
          endTime: currEvent.timestamp,
          type: gapType,
          contextBefore: prevEvent,
          contextAfter: currEvent,
        });
      }
    }
    
    return gapPeriods;
  }, [events, startTime, totalMinutes, parsedBreaks]);

  // Categorize gaps for summary
  const gapSummary = useMemo(() => {
    const inHomeGaps = gaps.filter(g => g.type === 'in_home');
    const breakGaps = gaps.filter(g => g.type === 'break');
    const inactivityGaps = gaps.filter(g => g.type === 'inactivity');
    
    return {
      inHome: inHomeGaps,
      breaks: breakGaps,
      inactivity: inactivityGaps,
      totalInHomeMinutes: inHomeGaps.reduce((sum, g) => sum + g.duration, 0),
      totalBreakMinutes: breakGaps.reduce((sum, g) => sum + g.duration, 0),
      totalInactivityMinutes: inactivityGaps.reduce((sum, g) => sum + g.duration, 0),
    };
  }, [gaps]);

  if (!startTime || events.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <p>No activity data for this day</p>
        <p className="text-xs mt-1">Timeline will appear once tracking begins</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with time range */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Play className="w-3 h-3 text-primary" />
          <span>{formatTimeOnly(startTime)}</span>
        </div>
        <span className="text-[10px]">{events.length} activities</span>
        <div className="flex items-center gap-1">
          <span>{endTime ? formatTimeOnly(endTime) : 'Now'}</span>
          {isFinalized ? (
            <Square className="w-3 h-3 text-muted-foreground" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* Main Timeline - no vertical scroll, horizontal scroll OK */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="relative h-14 min-w-[500px] px-2">
          {/* Background track */}
          <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-2 bg-muted rounded-full" />
          
          {/* Break periods (shown as distinct coffee-colored zones) */}
          {parsedBreaks.map((bp, idx) => (
            <Popover key={`break-${idx}`}>
              <PopoverTrigger asChild>
                <button
                  className="absolute top-1/2 -translate-y-1/2 h-5 rounded-full bg-amber-900/30 border border-dashed border-amber-700/40 flex items-center justify-center cursor-pointer hover:bg-amber-900/40 transition-colors"
                  style={{
                    left: `calc(${bp.start}% + 8px)`,
                    width: `${Math.max(bp.end - bp.start, 2)}%`,
                  }}
                >
                  {(bp.end - bp.start) > 5 && (
                    <Coffee className="w-2.5 h-2.5 text-amber-700/60" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-3" side="top">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 font-medium text-sm">
                    <Coffee className="w-4 h-4" />
                    <span>Break</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatTimeOnly(bp.startTime)} → {formatTimeOnly(bp.endTime)}
                  </div>
                  <div className="text-sm font-medium">
                    {formatDuration(bp.duration)}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ))}
          
          {/* Gap highlights with tap interaction */}
          {gaps.map((gap, idx) => {
            const width = gap.end - gap.start;
            const showLabel = width > 6;
            const beforeConfig = gap.contextBefore ? EVENT_CONFIG[gap.contextBefore.type] : null;
            const afterConfig = gap.contextAfter ? EVENT_CONFIG[gap.contextAfter.type] : null;
            
            return (
              <Popover key={`gap-${idx}`}>
                <PopoverTrigger asChild>
                  <button
                    className="absolute flex flex-col items-center cursor-pointer group"
                    style={{
                      left: `calc(${gap.start}% + 8px)`,
                      width: `${width}%`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                    }}
                  >
                    {/* Gap background - tappable */}
                    <div
                      className={cn(
                        "h-5 rounded-full w-full transition-all group-hover:scale-y-125",
                        gap.type === 'in_home' && "bg-emerald-500/20 border border-emerald-500/30",
                        gap.type === 'break' && "bg-amber-500/20 border border-amber-500/30",
                        gap.type === 'inactivity' && gap.duration >= 30 
                          ? "bg-red-500/25 border border-red-500/40" 
                          : gap.type === 'inactivity' && "bg-red-500/15 border border-red-500/25"
                      )}
                    />
                    
                    {/* Duration label */}
                    {showLabel && (
                      <div
                        className={cn(
                          "absolute -top-4 text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap flex items-center gap-0.5",
                          gap.type === 'in_home' && "text-emerald-600 bg-emerald-500/15",
                          gap.type === 'break' && "text-amber-600 bg-amber-500/15",
                          gap.type === 'inactivity' && "text-red-500 bg-red-500/15"
                        )}
                        style={{ 
                          left: '50%', 
                          transform: 'translateX(-50%)'
                        }}
                      >
                        {gap.type === 'in_home' && <Home className="w-2.5 h-2.5" />}
                        {gap.type === 'break' && <Coffee className="w-2.5 h-2.5" />}
                        {formatDuration(gap.duration)}
                      </div>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3" side="top">
                  <div className="space-y-3">
                    {/* Gap type header */}
                    <div className={cn(
                      "flex items-center gap-2 font-medium text-sm",
                      gap.type === 'in_home' && "text-emerald-600",
                      gap.type === 'break' && "text-amber-600",
                      gap.type === 'inactivity' && "text-red-500"
                    )}>
                      {gap.type === 'in_home' && <Home className="w-4 h-4" />}
                      {gap.type === 'break' && <Coffee className="w-4 h-4" />}
                      {gap.type === 'inactivity' && <span>⚠️</span>}
                      <span>
                        {gap.type === 'in_home' ? 'In Home' : gap.type === 'break' ? 'Break' : 'Inactivity'}
                      </span>
                      <span className="ml-auto font-bold">{formatDuration(gap.duration)}</span>
                    </div>
                    
                    {/* Time range */}
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                      {formatTimeOnly(gap.startTime)} → {formatTimeOnly(gap.endTime)}
                    </div>
                    
                    {/* Context events */}
                    <div className="space-y-1.5">
                      {gap.contextBefore && beforeConfig && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className={cn("w-2 h-2 rounded-full", beforeConfig.bgColor)} />
                          <span className="text-muted-foreground">Before:</span>
                          <span className="font-medium">{beforeConfig.label}</span>
                          <span className="text-muted-foreground ml-auto">
                            {formatTimeOnly(gap.contextBefore.timestamp)}
                          </span>
                        </div>
                      )}
                      {gap.contextAfter && afterConfig && (
                        <div className="flex items-center gap-2 text-xs">
                          <div className={cn("w-2 h-2 rounded-full", afterConfig.bgColor)} />
                          <span className="text-muted-foreground">After:</span>
                          <span className="font-medium">{afterConfig.label}</span>
                          <span className="text-muted-foreground ml-auto">
                            {formatTimeOnly(gap.contextAfter.timestamp)}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Explanation for in-home */}
                    {gap.type === 'in_home' && (
                      <div className="text-[10px] text-muted-foreground italic border-t pt-2">
                        Likely presenting/closing - door knock followed by deeper funnel activity
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
          
          {/* Hour markers */}
          {hourMarkers.map((marker, idx) => (
            <div
              key={`hour-${idx}`}
              className="absolute top-0 bottom-0 flex flex-col items-center"
              style={{ left: `${marker.position}%` }}
            >
              <div className="h-full w-px bg-border/50" />
              <span className="absolute -bottom-4 text-[9px] text-muted-foreground whitespace-nowrap">
                {marker.label}
              </span>
            </div>
          ))}

          {/* Event markers */}
          {events.map((event, idx) => {
            const config = EVENT_CONFIG[event.type];
            if (!config) return null;
            
            const position = ((event.timestamp.getTime() - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
            const isSale = event.type === 'sale';
            
            return (
              <div
                key={`event-${idx}`}
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 rounded-full transition-transform hover:scale-125",
                  config.bgColor,
                  isSale && "ring-2 ring-green-500/30 shadow-lg shadow-green-500/20"
                )}
                style={{
                  left: `calc(${position}% - 1px)`,
                  height: `${config.height}px`,
                  width: isSale ? '6px' : '3px',
                }}
                title={`${config.label} at ${formatTimeOnly(event.timestamp)}${event.prmr ? ` ($${event.prmr})` : ''}`}
              />
            );
          })}

          {/* Start marker */}
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary ring-2 ring-primary/30"
            title={`Started: ${formatTimeOnly(startTime)}`}
          />
          
          {/* End marker */}
          {endTime && (
            <div 
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ring-2",
                isFinalized 
                  ? "bg-muted-foreground ring-muted-foreground/30" 
                  : "bg-green-500 ring-green-500/30 animate-pulse"
              )}
              title={isFinalized ? `Ended: ${formatTimeOnly(endTime)}` : 'Still working'}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground justify-center pt-2">
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" /> Doors
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-purple-500" /> DMs
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-cyan-500" /> Pitches
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-amber-500" /> Trans
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-orange-500" /> Pres
        </span>
        <span className="flex items-center gap-1">
          <div className="w-2 h-3 rounded-full bg-green-500" /> Sale
        </span>
      </div>

      {/* Smart Gap Summary */}
      {gaps.length > 0 && (
        <div className="space-y-1 text-center text-[11px]">
          {/* In-home time */}
          {gapSummary.inHome.length > 0 && (
            <div className="flex items-center justify-center gap-1 text-emerald-600">
              <Home className="w-3 h-3" />
              <span>
                ~{formatDuration(gapSummary.totalInHomeMinutes)} in homes 
                ({gapSummary.inHome.length} visit{gapSummary.inHome.length > 1 ? 's' : ''})
              </span>
            </div>
          )}
          
          {/* Break time */}
          {gapSummary.breaks.length > 0 && (
            <div className="flex items-center justify-center gap-1 text-amber-600">
              <Coffee className="w-3 h-3" />
              <span>
                {formatDuration(gapSummary.totalBreakMinutes)} on breaks
              </span>
            </div>
          )}
          
          {/* Inactivity gaps - only show if concerning */}
          {gapSummary.inactivity.length > 0 && (
            <div className="flex items-center justify-center gap-1 text-red-500">
              <span>
                {gapSummary.inactivity.length} inactive gap{gapSummary.inactivity.length > 1 ? 's' : ''} • 
                Longest: {formatDuration(Math.max(...gapSummary.inactivity.map(g => g.duration)))}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
