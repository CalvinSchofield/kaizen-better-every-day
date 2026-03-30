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
  Clock,
  Play,
  Square
} from "lucide-react";

interface TimelineEvent {
  timestamp: Date;
  type: 'doors_knocked' | 'decision_makers' | 'pitches' | 'transitions' | 'presentations' | 'closes' | 'sale' | 'start' | 'end';
  label: string;
  prmr?: number;
  saleType?: 'fp' | 'upgrade';
}

interface RepActivityTimelineProps {
  counterTimestamps?: Record<string, string[]>;
  salesLog?: Array<{ type: string; prmr: number; timestamp?: string }>;
  workStartTime?: string;
  workEndTime?: string;
  isFinalized?: boolean;
}

const EVENT_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  doors_knocked: { icon: DoorOpen, color: 'text-blue-500 bg-blue-500/10', label: 'Door' },
  decision_makers: { icon: Users, color: 'text-purple-500 bg-purple-500/10', label: 'DM' },
  pitches: { icon: MessageSquare, color: 'text-cyan-500 bg-cyan-500/10', label: 'Pitch' },
  transitions: { icon: ArrowRight, color: 'text-amber-500 bg-amber-500/10', label: 'Transition' },
  presentations: { icon: Presentation, color: 'text-orange-500 bg-orange-500/10', label: 'Presentation' },
  closes: { icon: Handshake, color: 'text-green-600 bg-green-500/10', label: 'Close' },
  sale: { icon: DollarSign, color: 'text-green-600 bg-green-500/10', label: 'Sale' },
  start: { icon: Play, color: 'text-primary bg-primary/10', label: 'Started' },
  end: { icon: Square, color: 'text-muted-foreground bg-muted', label: 'Ended' },
};

const formatTimeOnly = (date: Date): string => {
  return date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
};

export const RepActivityTimeline = ({
  counterTimestamps,
  salesLog,
  workStartTime,
  workEndTime,
  isFinalized,
}: RepActivityTimelineProps) => {
  const events = useMemo(() => {
    const allEvents: TimelineEvent[] = [];

    // Add work start
    if (workStartTime) {
      allEvents.push({
        timestamp: new Date(workStartTime),
        type: 'start',
        label: 'Started work',
      });
    }

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
        const timestamp = sale.timestamp ? new Date(sale.timestamp) : new Date();
        allEvents.push({
          timestamp,
          type: 'sale',
          label: sale.type === 'upgrade' ? 'Upgrade Sale' : 'FP Sale',
          prmr: sale.prmr,
          saleType: sale.type as 'fp' | 'upgrade',
        });
      });
    }

    // Add work end
    if (workEndTime) {
      allEvents.push({
        timestamp: new Date(workEndTime),
        type: 'end',
        label: isFinalized ? 'Ended work' : 'Still working',
      });
    }

    // Sort by timestamp
    return allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }, [counterTimestamps, salesLog, workStartTime, workEndTime, isFinalized]);

  // Group events by hour for display
  const groupedByHour = useMemo(() => {
    const groups: Map<string, TimelineEvent[]> = new Map();
    
    events.forEach(event => {
      const hourKey = event.timestamp.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
      if (!groups.has(hourKey)) {
        groups.set(hourKey, []);
      }
      groups.get(hourKey)!.push(event);
    });

    return Array.from(groups.entries());
  }, [events]);

  if (events.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p>No activity data available</p>
        <p className="text-xs mt-1">Timeline will appear once tracking begins</p>
      </div>
    );
  }

  // Show compact view if many events
  const showCompact = events.length > 20;

  if (showCompact) {
    return (
      <div className="space-y-3">
        {groupedByHour.map(([hour, hourEvents]) => {
          // Count events by type
          const counts: Record<string, number> = {};
          let salesTotal = 0;
          
          hourEvents.forEach(e => {
            if (e.type === 'sale') {
              salesTotal += e.prmr || 0;
            } else if (e.type !== 'start' && e.type !== 'end') {
              counts[e.type] = (counts[e.type] || 0) + 1;
            }
          });

          const hasStart = hourEvents.some(e => e.type === 'start');
          const hasEnd = hourEvents.some(e => e.type === 'end');

          return (
            <div key={hour} className="flex items-start gap-3">
              <div className="w-16 flex-shrink-0 text-xs text-muted-foreground font-medium pt-0.5">
                {hour}
              </div>
              <div className="flex-1 flex flex-wrap gap-1.5">
                {hasStart && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary">
                    <Play className="w-3 h-3" /> Started
                  </span>
                )}
                {Object.entries(counts).map(([type, count]) => {
                  const config = EVENT_CONFIG[type];
                  if (!config) return null;
                  const Icon = config.icon;
                  return (
                    <span 
                      key={type}
                      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs", config.color)}
                    >
                      <Icon className="w-3 h-3" />
                      {count}
                    </span>
                  );
                })}
                {salesTotal > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-600">
                    <DollarSign className="w-3 h-3" /> ${salesTotal.toFixed(0)}
                  </span>
                )}
                {hasEnd && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                    <Square className="w-3 h-3" /> Ended
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Detailed timeline view
  return (
    <div className="space-y-1">
      {events.map((event, idx) => {
        const config = EVENT_CONFIG[event.type];
        if (!config) return null;
        const Icon = config.icon;
        
        return (
          <div 
            key={`${event.type}-${idx}`}
            className="flex items-center gap-3 py-1.5"
          >
            <div className="w-16 flex-shrink-0 text-xs text-muted-foreground">
              {formatTimeOnly(event.timestamp)}
            </div>
            <div className={cn("w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0", config.color)}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{event.label}</span>
              {event.prmr && (
                <span className="ml-2 text-sm text-green-600 font-semibold">
                  ${event.prmr.toFixed(0)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
