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
  Square
} from "lucide-react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface TimelineEvent {
  timestamp: Date;
  type: 'doors_knocked' | 'decision_makers' | 'pitches' | 'transitions' | 'presentations' | 'closes' | 'sale';
  label: string;
  prmr?: number;
}

interface RepDayActivityFlowProps {
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
  workStartTime?: string;
  workEndTime?: string;
  isFinalized?: boolean;
}

const EVENT_CONFIG: Record<string, { 
  icon: React.ComponentType<{ className?: string }>; 
  color: string; 
  bgColor: string;
  height: number;
  label: string;
}> = {
  doors_knocked: { 
    icon: DoorOpen, 
    color: 'text-blue-500', 
    bgColor: 'bg-blue-500',
    height: 16,
    label: 'Door' 
  },
  decision_makers: { 
    icon: Users, 
    color: 'text-purple-500', 
    bgColor: 'bg-purple-500',
    height: 20,
    label: 'DM' 
  },
  pitches: { 
    icon: MessageSquare, 
    color: 'text-cyan-500', 
    bgColor: 'bg-cyan-500',
    height: 24,
    label: 'Pitch' 
  },
  transitions: { 
    icon: ArrowRight, 
    color: 'text-amber-500', 
    bgColor: 'bg-amber-500',
    height: 28,
    label: 'Transition' 
  },
  presentations: { 
    icon: Presentation, 
    color: 'text-orange-500', 
    bgColor: 'bg-orange-500',
    height: 32,
    label: 'Presentation' 
  },
  closes: { 
    icon: Handshake, 
    color: 'text-green-600', 
    bgColor: 'bg-green-600',
    height: 36,
    label: 'Close' 
  },
  sale: { 
    icon: DollarSign, 
    color: 'text-green-500', 
    bgColor: 'bg-green-500',
    height: 48,
    label: 'Sale' 
  },
};

const formatTimeOnly = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
};

export const RepDayActivityFlow = ({
  counterTimestamps,
  salesLog,
  workStartTime,
  workEndTime,
  isFinalized,
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

  // Detect gaps (periods > 15 minutes with no activity)
  const gaps = useMemo(() => {
    if (events.length < 2) return [];
    
    const gapPeriods: { start: number; end: number; duration: number }[] = [];
    
    for (let i = 1; i < events.length; i++) {
      const gapMinutes = (events[i].timestamp.getTime() - events[i-1].timestamp.getTime()) / (1000 * 60);
      if (gapMinutes >= 15) {
        const startPos = ((events[i-1].timestamp.getTime() - (startTime?.getTime() || 0)) / (1000 * 60)) / totalMinutes * 100;
        const endPos = ((events[i].timestamp.getTime() - (startTime?.getTime() || 0)) / (1000 * 60)) / totalMinutes * 100;
        gapPeriods.push({
          start: startPos,
          end: endPos,
          duration: gapMinutes,
        });
      }
    }
    
    return gapPeriods;
  }, [events, startTime, totalMinutes]);

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

      {/* Main Timeline */}
      <ScrollArea className="w-full">
        <div className="relative h-16 min-w-[400px]">
          {/* Background track */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 bg-muted rounded-full" />
          
          {/* Gap highlights */}
          {gaps.map((gap, idx) => (
            <div
              key={`gap-${idx}`}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-3 rounded-full",
                gap.duration >= 30 ? "bg-red-500/20" : "bg-amber-500/15"
              )}
              style={{
                left: `${gap.start}%`,
                width: `${gap.end - gap.start}%`,
              }}
              title={`${Math.round(gap.duration)} min gap`}
            />
          ))}
          
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

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

      {/* Gap Summary */}
      {gaps.length > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          {gaps.length} gap{gaps.length > 1 ? 's' : ''} detected • 
          Longest: {Math.round(Math.max(...gaps.map(g => g.duration)))} min
        </div>
      )}
    </div>
  );
};
