import { useMemo } from "react";
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
  ChevronRight,
  Zap,
  AlertTriangle
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  start: number;
  end: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  type: 'in_home' | 'break' | 'inactivity';
  eventsBefore: TimelineEvent[];
  eventsAfter: TimelineEvent[];
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
  textColor: string;
  label: string;
  shortLabel: string;
  funnelOrder: number;
}> = {
  doors_knocked: { 
    icon: DoorOpen, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500',
    textColor: 'text-blue-400',
    label: 'Door Knocked',
    shortLabel: 'Door',
    funnelOrder: 1,
  },
  decision_makers: { 
    icon: Users, 
    color: 'text-purple-500', 
    bgColor: 'bg-purple-500',
    textColor: 'text-purple-400',
    label: 'Decision Maker',
    shortLabel: 'DM',
    funnelOrder: 2,
  },
  pitches: { 
    icon: MessageSquare, 
    color: 'text-cyan-500', 
    bgColor: 'bg-cyan-500',
    textColor: 'text-cyan-400',
    label: 'Pitch',
    shortLabel: 'Pitch',
    funnelOrder: 3,
  },
  transitions: { 
    icon: ArrowRight, 
    color: 'text-amber-400', 
    bgColor: 'bg-amber-400',
    textColor: 'text-amber-300',
    label: 'Transition',
    shortLabel: 'Trans',
    funnelOrder: 4,
  },
  presentations: { 
    icon: Presentation, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500',
    textColor: 'text-orange-400',
    label: 'Presentation',
    shortLabel: 'Pres',
    funnelOrder: 5,
  },
  closes: { 
    icon: Handshake, 
    color: 'text-green-600', 
    bgColor: 'bg-green-600',
    textColor: 'text-green-400',
    label: 'Close Attempt',
    shortLabel: 'Close',
    funnelOrder: 6,
  },
  sale: { 
    icon: DollarSign, 
    color: 'text-green-500', 
    bgColor: 'bg-green-500',
    textColor: 'text-green-400',
    label: 'Sale',
    shortLabel: 'Sale',
    funnelOrder: 7,
  },
};

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

// Get events within a time window
const getEventsInWindow = (events: TimelineEvent[], centerTime: Date, windowMinutes: number, direction: 'before' | 'after'): TimelineEvent[] => {
  return events.filter(e => {
    const diff = (e.timestamp.getTime() - centerTime.getTime()) / (1000 * 60);
    if (direction === 'before') {
      return diff >= -windowMinutes && diff <= 0;
    }
    return diff >= 0 && diff <= windowMinutes;
  }).slice(direction === 'before' ? -5 : 0, direction === 'before' ? undefined : 5);
};

export const RepDayActivityFlow = ({
  counterTimestamps,
  salesLog,
  workStartTime,
  workEndTime,
  isFinalized,
  breakPeriods,
}: RepDayActivityFlowProps) => {
  // Parse all events
  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

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

    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [counterTimestamps, salesLog]);

  // Time bounds
  const { startTime, endTime, totalMinutes } = useMemo(() => {
    let start = workStartTime ? new Date(workStartTime) : null;
    let end = workEndTime ? new Date(workEndTime) : null;

    events.forEach(event => {
      if (!start || event.timestamp < start) start = event.timestamp;
      if (!end || event.timestamp > end) end = event.timestamp;
    });

    if (!end && !isFinalized) end = new Date();
    if (!start || !end) return { startTime: null, endTime: null, totalMinutes: 0 };

    const total = Math.max((end.getTime() - start.getTime()) / (1000 * 60), 60);
    return { startTime: start, endTime: end, totalMinutes: total };
  }, [events, workStartTime, workEndTime, isFinalized]);

  // Parse breaks
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
        
        return { start: Math.max(0, startPos), end: Math.min(100, endPos), duration, startTime: breakStart, endTime: breakEnd };
      })
      .filter(bp => bp.end > bp.start);
  }, [breakPeriods, startTime, totalMinutes]);

  // Hour markers
  const hourMarkers = useMemo(() => {
    if (!startTime || !endTime) return [];
    
    const markers: { time: Date; label: string; position: number }[] = [];
    const startHour = new Date(startTime);
    startHour.setMinutes(0, 0, 0);
    if (startTime.getMinutes() > 0) startHour.setHours(startHour.getHours() + 1);
    
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

  // Smart gap detection with context
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
        
        const isBreak = parsedBreaks.some(bp => {
          const overlapStart = Math.max(prevEvent.timestamp.getTime(), bp.startTime.getTime());
          const overlapEnd = Math.min(currEvent.timestamp.getTime(), bp.endTime.getTime());
          return overlapEnd > overlapStart;
        });
        
        const isInHomePattern = 
          (prevEvent.type === 'doors_knocked' || prevEvent.type === 'decision_makers') &&
          IN_HOME_ACTIVITY_TYPES.includes(currEvent.type);
        
        let isBatchLogging = false;
        if (i + 1 < events.length) {
          const nextEvent = events[i + 1];
          const timeBetween = (nextEvent.timestamp.getTime() - currEvent.timestamp.getTime()) / (1000 * 60);
          const currFunnel = EVENT_CONFIG[currEvent.type]?.funnelOrder || 0;
          const nextFunnel = EVENT_CONFIG[nextEvent.type]?.funnelOrder || 0;
          if (timeBetween < 2 && currFunnel < nextFunnel) isBatchLogging = true;
        }
        
        const gapType: GapPeriod['type'] = isBreak ? 'break' : (isInHomePattern || isBatchLogging) ? 'in_home' : 'inactivity';
        
        // Get surrounding events for context (5 min window or last 5 events)
        const eventsBefore = getEventsInWindow(events.slice(0, i), prevEvent.timestamp, 10, 'before');
        const eventsAfter = getEventsInWindow(events.slice(i), currEvent.timestamp, 10, 'after');
        
        gapPeriods.push({
          start: startPos,
          end: endPos,
          duration: gapMinutes,
          startTime: prevEvent.timestamp,
          endTime: currEvent.timestamp,
          type: gapType,
          eventsBefore: eventsBefore.length > 0 ? eventsBefore : [prevEvent],
          eventsAfter: eventsAfter.length > 0 ? eventsAfter : [currEvent],
        });
      }
    }
    
    return gapPeriods;
  }, [events, startTime, totalMinutes, parsedBreaks]);

  // Summary stats
  const stats = useMemo(() => {
    const inHomeGaps = gaps.filter(g => g.type === 'in_home');
    const breakGaps = gaps.filter(g => g.type === 'break');
    const inactivityGaps = gaps.filter(g => g.type === 'inactivity');
    const salesCount = events.filter(e => e.type === 'sale').length;
    
    return {
      inHomeTime: inHomeGaps.reduce((sum, g) => sum + g.duration, 0),
      inHomeCount: inHomeGaps.length,
      breakTime: breakGaps.reduce((sum, g) => sum + g.duration, 0),
      inactivityTime: inactivityGaps.reduce((sum, g) => sum + g.duration, 0),
      inactivityCount: inactivityGaps.length,
      longestInactivity: inactivityGaps.length > 0 ? Math.max(...inactivityGaps.map(g => g.duration)) : 0,
      salesCount,
    };
  }, [gaps, events]);

  if (!startTime || events.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        <p>No activity data</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Compact Header */}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
        <div className="flex items-center gap-1">
          <Play className="w-3 h-3 text-primary" />
          <span className="font-medium">{formatTimeOnly(startTime)}</span>
        </div>
        <span className="text-muted-foreground/70">{events.length} events</span>
        <div className="flex items-center gap-1">
          <span className="font-medium">{endTime ? formatTimeOnly(endTime) : 'Now'}</span>
          {isFinalized ? (
            <Square className="w-2.5 h-2.5 text-muted-foreground" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </div>
      </div>

      {/* Timeline - NO VERTICAL SCROLL, fixed height for sales markers */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        <div className="relative h-16 min-w-[450px]">
          {/* Track background */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-muted/50 rounded-full" />
          
          {/* Breaks - subtle dashed zones */}
          {parsedBreaks.map((bp, idx) => (
            <div
              key={`break-${idx}`}
              className="absolute top-1/2 -translate-y-1/2 h-3 rounded bg-amber-900/20 border border-dashed border-amber-600/30"
              style={{ left: `${bp.start}%`, width: `${Math.max(bp.end - bp.start, 1)}%` }}
              title={`Break: ${formatDuration(bp.duration)}`}
            />
          ))}
          
          {/* Gap zones with popovers */}
          {gaps.map((gap, idx) => {
            const width = gap.end - gap.start;
            
            return (
              <Popover key={`gap-${idx}`}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 rounded cursor-pointer transition-all hover:opacity-80 active:scale-y-90",
                      gap.type === 'in_home' && "h-4 bg-emerald-500/25 border border-emerald-400/40",
                      gap.type === 'break' && "h-3 bg-amber-500/20 border border-amber-400/30",
                      gap.type === 'inactivity' && gap.duration >= 30 
                        ? "h-5 bg-red-500/30 border border-red-400/50" 
                        : gap.type === 'inactivity' && "h-4 bg-red-500/20 border border-red-400/30"
                    )}
                    style={{ left: `${gap.start}%`, width: `${Math.max(width, 1.5)}%` }}
                  >
                    {/* Duration badge for wider gaps */}
                    {width > 5 && (
                      <span className={cn(
                        "absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold px-1 rounded whitespace-nowrap",
                        gap.type === 'in_home' && "text-emerald-500",
                        gap.type === 'break' && "text-amber-500",
                        gap.type === 'inactivity' && "text-red-400"
                      )}>
                        {formatDuration(gap.duration)}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-0" side="top" align="center">
                  {/* Gap detail header */}
                  <div className={cn(
                    "px-3 py-2 border-b flex items-center justify-between",
                    gap.type === 'in_home' && "bg-emerald-500/10 border-emerald-500/20",
                    gap.type === 'break' && "bg-amber-500/10 border-amber-500/20",
                    gap.type === 'inactivity' && "bg-red-500/10 border-red-500/20"
                  )}>
                    <div className="flex items-center gap-2">
                      {gap.type === 'in_home' && <Home className="w-4 h-4 text-emerald-500" />}
                      {gap.type === 'break' && <Coffee className="w-4 h-4 text-amber-500" />}
                      {gap.type === 'inactivity' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                      <span className={cn(
                        "font-semibold text-sm",
                        gap.type === 'in_home' && "text-emerald-500",
                        gap.type === 'break' && "text-amber-500",
                        gap.type === 'inactivity' && "text-red-400"
                      )}>
                        {gap.type === 'in_home' ? 'In Home' : gap.type === 'break' ? 'Break' : 'Gap'}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-foreground">{formatDuration(gap.duration)}</span>
                  </div>
                  
                  {/* Time range */}
                  <div className="px-3 py-1.5 bg-muted/30 text-[11px] text-muted-foreground text-center">
                    {formatTimeOnly(gap.startTime)} → {formatTimeOnly(gap.endTime)}
                  </div>
                  
                  {/* Zoomed event sequence */}
                  <div className="p-3 space-y-3">
                    {/* Events BEFORE gap */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Before Gap</div>
                      <div className="flex flex-wrap gap-1">
                        {gap.eventsBefore.map((e, i) => {
                          const config = EVENT_CONFIG[e.type];
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <div 
                              key={i}
                              className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", config.bgColor + "/15")}
                            >
                              <Icon className={cn("w-3 h-3", config.color)} />
                              <span className={config.textColor}>{config.shortLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Arrow */}
                    <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                      <div className="flex-1 h-px bg-border" />
                      <ChevronRight className="w-4 h-4" />
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    
                    {/* Events AFTER gap */}
                    <div className="space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">After Gap</div>
                      <div className="flex flex-wrap gap-1">
                        {gap.eventsAfter.map((e, i) => {
                          const config = EVENT_CONFIG[e.type];
                          if (!config) return null;
                          const Icon = config.icon;
                          return (
                            <div 
                              key={i}
                              className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", config.bgColor + "/15")}
                            >
                              <Icon className={cn("w-3 h-3", config.color)} />
                              <span className={config.textColor}>{config.shortLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Coach insight */}
                    {gap.type === 'in_home' && (
                      <div className="text-[10px] text-emerald-600 bg-emerald-500/10 rounded px-2 py-1.5 italic">
                        💡 Likely presenting — Door → Funnel activity pattern detected
                      </div>
                    )}
                    {gap.type === 'inactivity' && gap.duration >= 30 && (
                      <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1.5 italic">
                        ⚠️ Long gap — check if break was logged or address in coaching
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
          
          {/* Hour markers - subtle */}
          {hourMarkers.map((marker, idx) => (
            <div
              key={`hour-${idx}`}
              className="absolute h-full flex flex-col items-center pointer-events-none"
              style={{ left: `${marker.position}%` }}
            >
              <div className="h-full w-px bg-border/30" />
              <span className="absolute -bottom-3.5 text-[8px] text-muted-foreground/70">{marker.label}</span>
            </div>
          ))}

          {/* Event markers - color-coded bars with tappable sales & transitions */}
          {events.map((event, idx) => {
            const config = EVENT_CONFIG[event.type];
            if (!config) return null;
            
            const position = ((event.timestamp.getTime() - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
            const isSale = event.type === 'sale';
            const isTransition = event.type === 'transitions';
            const isPresentation = event.type === 'presentations';
            const isHighlight = isSale || isTransition;
            
            // Sales are BIGGEST and most prominent, transitions are next
            const height = isSale ? 36 : isTransition ? 28 : isPresentation ? 20 : event.type === 'closes' ? 18 : 10;
            const width = isSale ? 8 : isTransition ? 5 : 2;
            
            // Get surrounding events for context on tappable items
            const surroundingEvents = isHighlight ? {
              before: events.slice(Math.max(0, idx - 3), idx),
              after: events.slice(idx + 1, Math.min(events.length, idx + 4)),
            } : null;
            
            // Non-interactive markers for regular events
            if (!isHighlight) {
              return (
                <div
                  key={`event-${idx}`}
                  className={cn("absolute top-1/2 -translate-y-1/2 rounded-sm", config.bgColor)}
                  style={{ left: `${position}%`, height: `${height}px`, width: `${width}px` }}
                  title={`${config.label} at ${formatTimeOnly(event.timestamp)}`}
                />
              );
            }
            
            // Tappable sales & transitions with popovers
            return (
              <Popover key={`event-${idx}`}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 rounded-sm transition-all active:scale-90 cursor-pointer z-10",
                      config.bgColor,
                      isSale && "ring-2 ring-green-400 shadow-lg shadow-green-500/50 animate-pulse",
                      isTransition && "ring-1 ring-amber-400/70 shadow-md shadow-amber-500/30"
                    )}
                    style={{ left: `${position}%`, height: `${height}px`, width: `${width}px` }}
                  >
                    {/* Sale indicator above the marker */}
                    {isSale && (
                      <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                        <DollarSign className="w-4 h-4 text-green-400 drop-shadow-lg" />
                      </div>
                    )}
                    {isTransition && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                      </div>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" side="top" align="center">
                  {/* Header */}
                  <div className={cn(
                    "px-3 py-2 border-b flex items-center justify-between",
                    isSale && "bg-green-500/20 border-green-500/30",
                    isTransition && "bg-amber-500/15 border-amber-500/25"
                  )}>
                    <div className="flex items-center gap-2">
                      {isSale ? (
                        <DollarSign className="w-5 h-5 text-green-400" />
                      ) : (
                        <ArrowRight className="w-4 h-4 text-amber-400" />
                      )}
                      <span className={cn(
                        "font-bold text-sm",
                        isSale && "text-green-400",
                        isTransition && "text-amber-400"
                      )}>
                        {isSale ? (event.label || 'Sale') : 'Transition'}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-foreground">
                      {formatTimeOnly(event.timestamp)}
                    </span>
                  </div>
                  
                  {/* Sale details */}
                  {isSale && event.prmr && (
                    <div className="px-3 py-2 bg-green-500/10 border-b border-green-500/20">
                      <div className="text-lg font-bold text-green-400">${event.prmr} PRMR</div>
                      <div className="text-[10px] text-muted-foreground">
                        {event.label === 'Upgrade' ? 'Upgrade Sale' : 'Full Package Sale'}
                      </div>
                    </div>
                  )}
                  
                  {/* Context: What happened before/after */}
                  <div className="p-3 space-y-3">
                    {surroundingEvents && surroundingEvents.before.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wide">
                          {isSale ? 'Path to Sale' : 'Leading Up'}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {surroundingEvents.before.map((e, i) => {
                            const c = EVENT_CONFIG[e.type];
                            if (!c) return null;
                            const Icon = c.icon;
                            return (
                              <div key={i} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", c.bgColor + "/15")}>
                                <Icon className={cn("w-3 h-3", c.color)} />
                                <span className={c.textColor}>{c.shortLabel}</span>
                              </div>
                            );
                          })}
                          <ChevronRight className="w-3 h-3 text-muted-foreground self-center" />
                          <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ring-1", 
                            isSale ? "bg-green-500/20 ring-green-500/50 text-green-400" : "bg-amber-500/20 ring-amber-500/50 text-amber-400"
                          )}>
                            {isSale ? <DollarSign className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
                            {isSale ? 'SALE' : 'Trans'}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {surroundingEvents && surroundingEvents.after.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] text-muted-foreground uppercase tracking-wide">After</div>
                        <div className="flex flex-wrap gap-1">
                          {surroundingEvents.after.map((e, i) => {
                            const c = EVENT_CONFIG[e.type];
                            if (!c) return null;
                            const Icon = c.icon;
                            return (
                              <div key={i} className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", c.bgColor + "/15")}>
                                <Icon className={cn("w-3 h-3", c.color)} />
                                <span className={c.textColor}>{c.shortLabel}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {/* Coach insight for transitions */}
                    {isTransition && (
                      <div className="text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1.5 italic">
                        🏠 Rep entered the home — this is where deals happen!
                      </div>
                    )}
                    
                    {/* Coach insight for sales */}
                    {isSale && (
                      <div className="text-[10px] text-green-400 bg-green-500/10 rounded px-2 py-1.5 italic">
                        💰 Great work! Track the funnel path to replicate success.
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}

          {/* Start/End markers */}
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary"
            title={`Start: ${formatTimeOnly(startTime)}`}
          />
          {endTime && (
            <div 
              className={cn(
                "absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full",
                isFinalized ? "bg-muted-foreground" : "bg-green-500 animate-pulse"
              )}
              title={isFinalized ? `End: ${formatTimeOnly(endTime)}` : 'Active'}
            />
          )}
        </div>
      </div>

      {/* Compact Legend */}
      <div className="flex flex-wrap gap-2 justify-center text-[9px] text-muted-foreground">
        {['doors_knocked', 'decision_makers', 'pitches', 'transitions', 'presentations', 'sale'].map(type => {
          const config = EVENT_CONFIG[type];
          return (
            <span key={type} className="flex items-center gap-0.5">
              <div className={cn("w-1.5 rounded-sm", config.bgColor, type === 'sale' ? 'h-3' : 'h-2')} />
              {config.shortLabel}
            </span>
          );
        })}
      </div>

      {/* Smart Summary - Coach Insights */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center text-[10px]">
        {stats.inHomeCount > 0 && (
          <span className="flex items-center gap-1 text-emerald-500">
            <Home className="w-3 h-3" />
            ~{formatDuration(stats.inHomeTime)} in homes ({stats.inHomeCount})
          </span>
        )}
        {stats.breakTime > 0 && (
          <span className="flex items-center gap-1 text-amber-500">
            <Coffee className="w-3 h-3" />
            {formatDuration(stats.breakTime)} breaks
          </span>
        )}
        {stats.inactivityCount > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <Zap className="w-3 h-3" />
            {stats.inactivityCount} gap{stats.inactivityCount > 1 ? 's' : ''} • longest {formatDuration(stats.longestInactivity)}
          </span>
        )}
      </div>
    </div>
  );
};
