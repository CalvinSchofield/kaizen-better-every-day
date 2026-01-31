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
  type: 'break' | 'inactivity';
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

// TRANSITION is the key signal that rep got INTO a home
// Presentations are also important to track separately
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

// Get the single closest event before/after with time
// For "before" direction on transitions: detect batch-logged events and find the door knock that started this home visit
const getAdjacentEvent = (
  events: TimelineEvent[], 
  idx: number, 
  direction: 'before' | 'after',
  currentEventType?: string
): { event: TimelineEvent; time: string } | null => {
  const currentEvent = events[idx];
  
  if (direction === 'before') {
    // For transitions specifically, we want to find the door knock that started this home visit
    // This handles "batch logging" where reps log DM, pitch, transition all at once after an interaction
    const isTransition = currentEventType === 'transitions';
    
    if (isTransition) {
      const currentTime = currentEvent.timestamp.getTime();
      let searchIdx = idx - 1;
      
      // Skip past any events at the same timestamp (batch-logged together)
      while (searchIdx >= 0 && events[searchIdx].timestamp.getTime() === currentTime) {
        searchIdx--;
      }
      
      // Now search backward for the door knock that preceded this home visit
      // The door knock is what started this interaction sequence
      while (searchIdx >= 0) {
        if (events[searchIdx].type === 'doors_knocked') {
          return { event: events[searchIdx], time: formatTimeOnly(events[searchIdx].timestamp) };
        }
        searchIdx--;
      }
    }
    
    // For non-transitions or if no door found, just return the immediately preceding event
    const targetIdx = idx - 1;
    if (targetIdx < 0) return null;
    return { event: events[targetIdx], time: formatTimeOnly(events[targetIdx].timestamp) };
  }
  
  // For "after" direction, just get the next event
  const targetIdx = idx + 1;
  if (targetIdx >= events.length) return null;
  return { event: events[targetIdx], time: formatTimeOnly(events[targetIdx].timestamp) };
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
            label: sale.type === 'upgrade' ? 'Upgrade' : 'FP',
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

  // Stats for transitions and presentations (key coaching metrics)
  // TRANSITION = rep got into a home
  // PRESENTATION = rep presented
  const transitionEvents = useMemo(() => 
    events.filter(e => e.type === 'transitions'), [events]);
  const presentationEvents = useMemo(() => 
    events.filter(e => e.type === 'presentations'), [events]);

  // Calculate "in home" zones - smart detection based on door → transition/presentation/sale
  // Priority: Sale > Presentation > Transition
  // Also detect "doorstep" interactions (presentation/sale without transition)
  const inHomeZones = useMemo(() => {
    if (!startTime || !totalMinutes) return [];
    
    type ZoneType = 'transition' | 'presentation' | 'sale' | 'doorstep_presentation' | 'doorstep_sale';
    
    const zones: Array<{
      startPos: number;
      endPos: number;
      duration: number;
      doorTime: Date;
      endTime: Date;
      endType: ZoneType;
    }> = [];
    
    // Find all door knock indices
    const doorIndices = events
      .map((e, i) => e.type === 'doors_knocked' ? i : -1)
      .filter(i => i >= 0);
    
    doorIndices.forEach((doorIdx, i) => {
      const doorEvent = events[doorIdx];
      const nextDoorIdx = doorIndices[i + 1] ?? events.length;
      
      // Get all events in this potential home visit (after door, before next door)
      const visitEvents = events.slice(doorIdx + 1, nextDoorIdx);
      
      if (visitEvents.length === 0) return; // No events after this door
      
      // Find key events in this visit
      const transitionEvent = visitEvents.find(e => e.type === 'transitions');
      const presentationEvent = visitEvents.find(e => e.type === 'presentations');
      const saleEvent = visitEvents.find(e => e.type === 'sale' || e.type === 'closes');
      
      // No significant event = just knocked and left, no zone
      if (!transitionEvent && !presentationEvent && !saleEvent) return;
      
      // Determine end event and type (priority: sale > presentation > transition)
      let endEvent: TimelineEvent;
      let endType: ZoneType;
      
      // Check for rapid succession taps (within 30 seconds) - treat as batch-logged
      const BATCH_THRESHOLD_MS = 30 * 1000;
      
      const hasTransition = !!transitionEvent;
      const hasBatchedTransition = (event: TimelineEvent) => {
        if (!transitionEvent) return false;
        return Math.abs(event.timestamp.getTime() - transitionEvent.timestamp.getTime()) <= BATCH_THRESHOLD_MS;
      };
      
      if (saleEvent) {
        // Sale is the deepest interaction
        endEvent = saleEvent;
        // If transition exists OR was batch-logged with sale, it's not doorstep
        const isDoorstep = !hasTransition && !hasBatchedTransition(saleEvent);
        endType = isDoorstep ? 'doorstep_sale' : 'sale';
        
        // Use the later of sale/transition if they're batch-logged
        if (transitionEvent && hasBatchedTransition(saleEvent)) {
          endEvent = saleEvent.timestamp > transitionEvent.timestamp ? saleEvent : transitionEvent;
        }
      } else if (presentationEvent) {
        // Presentation without sale
        endEvent = presentationEvent;
        const isDoorstep = !hasTransition && !hasBatchedTransition(presentationEvent);
        endType = isDoorstep ? 'doorstep_presentation' : 'presentation';
        
        // Use the later of presentation/transition if they're batch-logged
        if (transitionEvent && hasBatchedTransition(presentationEvent)) {
          endEvent = presentationEvent.timestamp > transitionEvent.timestamp ? presentationEvent : transitionEvent;
          endType = 'presentation'; // Still count as presentation since both were logged
        }
      } else {
        // Just transition
        endEvent = transitionEvent!;
        endType = 'transition';
      }
      
      const doorTime = doorEvent.timestamp.getTime();
      const endTimeMs = endEvent.timestamp.getTime();
      
      const startPos = ((doorTime - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
      const endPos = ((endTimeMs - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
      const duration = (endTimeMs - doorTime) / (1000 * 60);
      
      zones.push({
        startPos: Math.max(0, startPos),
        endPos: Math.min(100, endPos),
        duration,
        doorTime: doorEvent.timestamp,
        endTime: endEvent.timestamp,
        endType,
      });
    });
    
    return zones;
  }, [events, startTime, totalMinutes]);

  // Detect extended doorstep conversations: door → DM/pitch but no transition/presentation/sale
  // These could indicate the rep was talking at the door for a while
  const extendedConversations = useMemo(() => {
    if (!startTime || !totalMinutes) return [];
    
    const conversations: Array<{
      startPos: number;
      endPos: number;
      duration: number;
      doorTime: Date;
      lastActivityTime: Date;
      activities: string[];
    }> = [];
    
    const doorIndices = events
      .map((e, i) => e.type === 'doors_knocked' ? i : -1)
      .filter(i => i >= 0);
    
    doorIndices.forEach((doorIdx, i) => {
      const doorEvent = events[doorIdx];
      const nextDoorIdx = doorIndices[i + 1] ?? events.length;
      
      const visitEvents = events.slice(doorIdx + 1, nextDoorIdx);
      if (visitEvents.length === 0) return;
      
      // Check if there's a transition, presentation, or sale
      const hasEnding = visitEvents.some(e => 
        e.type === 'transitions' || e.type === 'presentations' || e.type === 'sale' || e.type === 'closes'
      );
      
      if (hasEnding) return; // Already tracked in inHomeZones
      
      // Check if there's DM or pitch activity
      const dmPitchEvents = visitEvents.filter(e => 
        e.type === 'decision_makers' || e.type === 'pitches'
      );
      
      if (dmPitchEvents.length === 0) return;
      
      // Find the last activity timestamp
      const lastActivity = dmPitchEvents[dmPitchEvents.length - 1];
      const doorTime = doorEvent.timestamp.getTime();
      const lastActivityTime = lastActivity.timestamp.getTime();
      const duration = (lastActivityTime - doorTime) / (1000 * 60);
      
      // Only show if there's meaningful time (> 2 minutes)
      if (duration < 2) return;
      
      const startPos = ((doorTime - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
      const endPos = ((lastActivityTime - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
      
      conversations.push({
        startPos: Math.max(0, startPos),
        endPos: Math.min(100, endPos),
        duration,
        doorTime: doorEvent.timestamp,
        lastActivityTime: lastActivity.timestamp,
        activities: dmPitchEvents.map(e => EVENT_CONFIG[e.type]?.shortLabel || e.type),
      });
    });
    
    return conversations;
  }, [events, startTime, totalMinutes]);

  // Gap detection: Only 20+ min gaps that don't overlap with in-home zones or extended conversations
  const gaps = useMemo(() => {
    if (events.length < 2 || !startTime) return [];
    
    const gapPeriods: GapPeriod[] = [];
    
    for (let i = 1; i < events.length; i++) {
      const prevEvent = events[i - 1];
      const currEvent = events[i];
      const gapStart = prevEvent.timestamp.getTime();
      const gapEnd = currEvent.timestamp.getTime();
      const gapMinutes = (gapEnd - gapStart) / (1000 * 60);
      
      // Only show gaps of 20+ minutes
      if (gapMinutes < 20) continue;
      
      // Check if this gap overlaps with an in-home zone (rep was inside presenting)
      const overlapsWithHomeZone = inHomeZones.some(zone => {
        const zoneStartMs = zone.doorTime.getTime();
        const zoneEndMs = zone.endTime.getTime();
        // Gap overlaps if it's within a home zone
        return (gapStart >= zoneStartMs && gapStart < zoneEndMs) ||
               (gapEnd > zoneStartMs && gapEnd <= zoneEndMs) ||
               (gapStart <= zoneStartMs && gapEnd >= zoneEndMs);
      });
      
      if (overlapsWithHomeZone) continue; // Skip - rep was in a home
      
      // Check if this gap overlaps with an extended conversation
      const overlapsWithConvo = extendedConversations.some(convo => {
        const convoStartMs = convo.doorTime.getTime();
        const convoEndMs = convo.lastActivityTime.getTime();
        return (gapStart >= convoStartMs && gapStart < convoEndMs) ||
               (gapEnd > convoStartMs && gapEnd <= convoEndMs) ||
               (gapStart <= convoStartMs && gapEnd >= convoEndMs);
      });
      
      if (overlapsWithConvo) continue; // Skip - rep was in a conversation
      
      const startPos = ((gapStart - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
      const endPos = ((gapEnd - startTime.getTime()) / (1000 * 60)) / totalMinutes * 100;
      
      // Check if it's a logged break
      const isBreak = parsedBreaks.some(bp => {
        const overlapStart = Math.max(gapStart, bp.startTime.getTime());
        const overlapEnd = Math.min(gapEnd, bp.endTime.getTime());
        return overlapEnd > overlapStart;
      });
      
      gapPeriods.push({
        start: startPos,
        end: endPos,
        duration: gapMinutes,
        startTime: prevEvent.timestamp,
        endTime: currEvent.timestamp,
        type: isBreak ? 'break' : 'inactivity',
        eventsBefore: [prevEvent],
        eventsAfter: [currEvent],
      });
    }
    
    return gapPeriods;
  }, [events, startTime, totalMinutes, parsedBreaks, inHomeZones, extendedConversations]);

  // Summary stats - transitions = homes entered, presentations = presented
  const stats = useMemo(() => {
    const breakGaps = gaps.filter(g => g.type === 'break');
    const inactivityGaps = gaps.filter(g => g.type === 'inactivity');
    const salesCount = events.filter(e => e.type === 'sale').length;
    
    // Total time selling = in-home zones + extended conversations
    const totalSellingTime = inHomeZones.reduce((sum, z) => sum + z.duration, 0) 
      + extendedConversations.reduce((sum, c) => sum + c.duration, 0);
    
    // Count doorstep vs in-home
    const doorstepCount = inHomeZones.filter(z => z.endType.startsWith('doorstep_')).length;
    const inHomeCount = inHomeZones.filter(z => !z.endType.startsWith('doorstep_')).length;
    
    return {
      transitionCount: transitionEvents.length,
      presentationCount: presentationEvents.length,
      breakTime: breakGaps.reduce((sum, g) => sum + g.duration, 0),
      inactivityTime: inactivityGaps.reduce((sum, g) => sum + g.duration, 0),
      inactivityCount: inactivityGaps.length,
      longestInactivity: inactivityGaps.length > 0 ? Math.max(...inactivityGaps.map(g => g.duration)) : 0,
      salesCount,
      totalSellingTime,
      doorstepCount,
      inHomeCount,
      extendedConvoCount: extendedConversations.length,
    };
  }, [gaps, events, transitionEvents, presentationEvents, inHomeZones, extendedConversations]);

  if (!startTime || events.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        <p>No activity data</p>
      </div>
    );
  }

  // Extract sales for the Sales Moments row
  const salesMoments = useMemo(() => {
    return events.filter(e => e.type === 'sale');
  }, [events]);

  return (
    <div className="space-y-2">
      {/* Sales Moments Row - Big tappable chips */}
      {salesMoments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
          {salesMoments.map((sale, idx) => (
            <Popover key={`sale-moment-${idx}`}>
              <PopoverTrigger asChild>
                <button className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/40 hover:bg-green-500/30 active:scale-95 transition-all">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <div className="text-left">
                    <div className="text-sm font-bold text-green-400">
                      ${sale.prmr || 0}
                    </div>
                    <div className="text-[10px] text-green-300/80">
                      {formatTimeOnly(sale.timestamp)} • {sale.label === 'Upgrade' ? 'UPG' : 'FP'}
                    </div>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" side="bottom" align="start">
                <div className="px-3 py-2 bg-green-500/20 border-b border-green-500/30">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-400" />
                    <span className="font-bold text-green-400">{sale.label || 'Sale'}</span>
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">PRMR</span>
                    <span className="text-lg font-bold text-green-400">${sale.prmr || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Time</span>
                    <span className="text-sm font-medium">{formatTimeOnly(sale.timestamp)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Type</span>
                    <span className="text-sm font-medium">{sale.label === 'Upgrade' ? 'Upgrade' : 'FP'}</span>
                  </div>
                  <div className="pt-2 border-t text-[10px] text-green-400/80 italic">
                    💰 Great close! Review the timeline to see the funnel path.
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      )}

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
      <div className="overflow-x-auto overflow-y-hidden touch-pan-x overscroll-y-none scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
        <div className="relative h-16 min-w-[450px]">
          {/* Track background */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 bg-muted/50 rounded-full" />
          
          {/* In-home zones - colored bands from door to end of interaction */}
          {inHomeZones.map((zone, idx) => {
            const isDoorstep = zone.endType.startsWith('doorstep_');
            const isSale = zone.endType === 'sale' || zone.endType === 'doorstep_sale';
            const isPresentation = zone.endType === 'presentation' || zone.endType === 'doorstep_presentation';
            
            // Different colors based on type
            const bgClass = isSale 
              ? 'bg-gradient-to-r from-green-500/20 via-green-400/30 to-green-500/20 border-green-400/40'
              : isPresentation
                ? 'bg-gradient-to-r from-orange-500/20 via-orange-400/30 to-orange-500/20 border-orange-400/40'
                : 'bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border-amber-400/40';
            
            const textClass = isSale ? 'text-green-300' : isPresentation ? 'text-orange-300' : 'text-amber-300';
            const headerBgClass = isSale ? 'bg-green-500/15 border-green-500/25' : isPresentation ? 'bg-orange-500/15 border-orange-500/25' : 'bg-amber-500/15 border-amber-500/25';
            const headerTextClass = isSale ? 'text-green-400' : isPresentation ? 'text-orange-400' : 'text-amber-400';
            
            const endLabel = isSale ? 'Closed Deal' : isPresentation ? 'Presented' : 'Left Home';
            const headerLabel = isDoorstep 
              ? (isSale ? 'Doorstep Close' : 'Doorstep Pitch')
              : (isSale ? 'Sale Visit' : isPresentation ? 'Presentation' : 'In Home');
            const emoji = isDoorstep ? '🚪' : isSale ? '💰' : isPresentation ? '📊' : '🏠';
            
            return (
              <Popover key={`home-zone-${idx}`}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 rounded-md border cursor-pointer hover:opacity-80 transition-all active:scale-y-90",
                      bgClass,
                      isDoorstep ? "h-5 border-dashed" : "h-6"
                    )}
                    style={{ left: `${zone.startPos}%`, width: `${Math.max(zone.endPos - zone.startPos, 2)}%` }}
                  >
                    {/* Duration label for wider zones */}
                    {(zone.endPos - zone.startPos) > 6 && (
                      <span className={cn("absolute inset-0 flex items-center justify-center text-[9px] font-semibold whitespace-nowrap", textClass)}>
                        {formatDuration(zone.duration)}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" side="top" align="center">
                  <div className={cn("px-3 py-2 border-b flex items-center gap-2", headerBgClass)}>
                    <div className="w-5 h-5 rounded-full bg-black/20 flex items-center justify-center text-sm">
                      {emoji}
                    </div>
                    <span className={cn("font-bold text-sm", headerTextClass)}>{headerLabel}</span>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">Duration</span>
                      <span className={cn("text-sm font-bold", headerTextClass)}>{formatDuration(zone.duration)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">Door Knocked</span>
                      <span className="text-[11px] font-medium">{formatTimeOnly(zone.doorTime)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] text-muted-foreground">{endLabel}</span>
                      <span className="text-[11px] font-medium">{formatTimeOnly(zone.endTime)}</span>
                    </div>
                    {isDoorstep && (
                      <div className={cn("text-[10px] rounded px-2 py-1.5 italic mt-1", 
                        isSale ? "text-green-400 bg-green-500/10" : "text-orange-400 bg-orange-500/10"
                      )}>
                        {isSale ? '💰 Closed on the doorstep!' : '📊 Pitched without entering home'}
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            );
          })}
          
          {/* Extended conversations - door → DM/pitch without transition */}
          {extendedConversations.map((convo, idx) => (
            <Popover key={`convo-${idx}`}>
              <PopoverTrigger asChild>
                <button
                  className="absolute top-1/2 -translate-y-1/2 h-4 rounded-md bg-gradient-to-r from-purple-500/15 via-cyan-400/20 to-purple-500/15 border border-dashed border-purple-400/40 cursor-pointer hover:opacity-80 transition-all active:scale-y-90"
                  style={{ left: `${convo.startPos}%`, width: `${Math.max(convo.endPos - convo.startPos, 2)}%` }}
                >
                  {(convo.endPos - convo.startPos) > 8 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium text-purple-300 whitespace-nowrap">
                      {formatDuration(convo.duration)}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" side="top" align="center">
                <div className="px-3 py-2 bg-purple-500/15 border-b border-purple-500/25 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-purple-400/20 flex items-center justify-center text-sm">
                    💬
                  </div>
                  <span className="font-bold text-sm text-purple-400">At Door</span>
                </div>
                <div className="p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Duration</span>
                    <span className="text-sm font-bold text-purple-400">{formatDuration(convo.duration)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Door Knocked</span>
                    <span className="text-[11px] font-medium">{formatTimeOnly(convo.doorTime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Last Activity</span>
                    <span className="text-[11px] font-medium">{formatTimeOnly(convo.lastActivityTime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">Logged</span>
                    <span className="text-[11px] font-medium">{convo.activities.join(', ')}</span>
                  </div>
                  <div className="text-[10px] text-purple-400 bg-purple-500/10 rounded px-2 py-1.5 italic mt-1">
                    💬 Extended conversation — no transition logged
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          ))}
          
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
                      gap.type === 'break' && "h-3 bg-amber-500/20 border border-amber-400/30",
                      gap.type === 'inactivity' && "h-5 bg-red-500/30 border border-red-400/50"
                    )}
                    style={{ left: `${gap.start}%`, width: `${Math.max(width, 1.5)}%` }}
                  >
                    {/* Duration badge for wider gaps */}
                    {width > 5 && (
                      <span className={cn(
                        "absolute -top-3.5 left-1/2 -translate-x-1/2 text-[9px] font-semibold px-1 rounded whitespace-nowrap",
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
                    gap.type === 'break' && "bg-amber-500/10 border-amber-500/20",
                    gap.type === 'inactivity' && "bg-red-500/10 border-red-500/20"
                  )}>
                    <div className="flex items-center gap-2">
                      {gap.type === 'break' && <Coffee className="w-4 h-4 text-amber-500" />}
                      {gap.type === 'inactivity' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                      <span className={cn(
                        "font-semibold text-sm",
                        gap.type === 'break' && "text-amber-500",
                        gap.type === 'inactivity' && "text-red-400"
                      )}>
                        {gap.type === 'break' ? 'Break' : 'Gap'}
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
                    
                    {/* Arrow divider */}
                    <div className="flex items-center justify-center gap-2 text-muted-foreground/50">
                      <div className="flex-1 h-px bg-border" />
                      <ArrowRight className="w-4 h-4" />
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
                    
                    {/* Coach insight for inactivity */}
                    {gap.type === 'inactivity' && (
                      <div className="text-[10px] text-red-400 bg-red-500/10 rounded px-2 py-1.5 italic">
                        ⚠️ {formatDuration(gap.duration)} gap — check if break was logged or address in coaching
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
            
            // Get just 1-2 adjacent events for simple before/after context
            // For transitions, this will find the door knock that started this home visit
            const eventBefore = isHighlight ? getAdjacentEvent(events, idx, 'before', event.type) : null;
            const eventAfter = isHighlight ? getAdjacentEvent(events, idx, 'after', event.type) : null;
            
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
                        {event.label === 'Upgrade' ? 'Upgrade' : 'FP'}
                      </div>
                    </div>
                  )}
                  
                  {/* Simple before/after context with times */}
                  <div className="p-3 space-y-2">
                    {eventBefore && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">Before:</span>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const c = EVENT_CONFIG[eventBefore.event.type];
                            if (!c) return null;
                            const Icon = c.icon;
                            return (
                              <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", c.bgColor + "/15")}>
                                <Icon className={cn("w-3 h-3", c.color)} />
                                <span className={c.textColor}>{c.shortLabel}</span>
                              </div>
                            );
                          })()}
                          <span className="text-[10px] text-muted-foreground">{eventBefore.time}</span>
                        </div>
                      </div>
                    )}
                    
                    {eventAfter && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-muted-foreground">After:</span>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const c = EVENT_CONFIG[eventAfter.event.type];
                            if (!c) return null;
                            const Icon = c.icon;
                            return (
                              <div className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium", c.bgColor + "/15")}>
                                <Icon className={cn("w-3 h-3", c.color)} />
                                <span className={c.textColor}>{c.shortLabel}</span>
                              </div>
                            );
                          })()}
                          <span className="text-[10px] text-muted-foreground">{eventAfter.time}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Coach insight for transitions - show time in home if door knock found */}
                    {isTransition && eventBefore?.event.type === 'doors_knocked' && (
                      <div className="text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1.5 italic mt-2">
                        🏠 In home since {eventBefore.time} ({Math.round((event.timestamp.getTime() - eventBefore.event.timestamp.getTime()) / (1000 * 60))} min)
                      </div>
                    )}
                    {isTransition && eventBefore?.event.type !== 'doors_knocked' && (
                      <div className="text-[10px] text-amber-400 bg-amber-500/10 rounded px-2 py-1.5 italic mt-2">
                        🏠 Rep entered the home
                      </div>
                    )}
                    
                    {/* Coach insight for sales */}
                    {isSale && (
                      <div className="text-[10px] text-green-400 bg-green-500/10 rounded px-2 py-1.5 italic mt-2">
                        💰 Great close!
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
        {/* Total time selling - most important stat */}
        {stats.totalSellingTime > 0 && (
          <span className="flex items-center gap-1 text-primary font-semibold">
            ⏱️ {formatDuration(stats.totalSellingTime)} selling
          </span>
        )}
        {stats.inHomeCount > 0 && (
          <span className="flex items-center gap-1 text-amber-400">
            🏠 {stats.inHomeCount} home{stats.inHomeCount > 1 ? 's' : ''}
          </span>
        )}
        {stats.doorstepCount > 0 && (
          <span className="flex items-center gap-1 text-orange-400">
            🚪 {stats.doorstepCount} doorstep
          </span>
        )}
        {stats.extendedConvoCount > 0 && (
          <span className="flex items-center gap-1 text-purple-400">
            💬 {stats.extendedConvoCount} convo{stats.extendedConvoCount > 1 ? 's' : ''}
          </span>
        )}
        {stats.breakTime > 0 && (
          <span className="flex items-center gap-1 text-amber-500">
            <Coffee className="w-3 h-3" />
            {formatDuration(stats.breakTime)}
          </span>
        )}
        {stats.inactivityCount > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {stats.inactivityCount} gap{stats.inactivityCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
};
