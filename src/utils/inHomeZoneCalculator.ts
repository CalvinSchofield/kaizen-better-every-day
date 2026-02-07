/**
 * In-Home Zone Calculator
 * Shared utility to detect when a rep was inside a home presenting/selling.
 * 
 * Logic: Tracks door knock → transition/presentation/close as an "in-home" zone
 * Handles batch-logged events intelligently
 */

export interface TimelineEvent {
  timestamp: Date;
  type: 'doors_knocked' | 'decision_makers' | 'pitches' | 'transitions' | 'presentations' | 'closes' | 'sale';
  label?: string;
  prmr?: number;
}

export type InHomeZoneType = 'transition' | 'presentation' | 'sale' | 'doorstep_presentation' | 'doorstep_sale';

export interface InHomeZone {
  doorTime: Date;
  endTime: Date;
  duration: number; // minutes
  endType: InHomeZoneType;
  hasSale: boolean;
}

export interface RingSegment {
  startAngle: number;
  endAngle: number;
  type: 'knocking' | 'in-home' | 'sale' | 'break' | 'gap';
}

const BATCH_THRESHOLD_MS = 30 * 1000; // 30 seconds for batch-logged detection

/**
 * Calculate in-home zones from timeline events
 */
export function calculateInHomeZones(
  events: TimelineEvent[],
  workStart: Date,
  workEnd: Date
): InHomeZone[] {
  if (events.length === 0) return [];
  
  const zones: InHomeZone[] = [];
  
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
    let endType: InHomeZoneType;
    
    const hasTransition = !!transitionEvent;
    const hasBatchedTransition = (event: TimelineEvent) => {
      if (!transitionEvent) return false;
      return Math.abs(event.timestamp.getTime() - transitionEvent.timestamp.getTime()) <= BATCH_THRESHOLD_MS;
    };
    
    if (saleEvent) {
      endEvent = saleEvent;
      const isDoorstep = !hasTransition && !hasBatchedTransition(saleEvent);
      endType = isDoorstep ? 'doorstep_sale' : 'sale';
      
      if (transitionEvent && hasBatchedTransition(saleEvent)) {
        endEvent = saleEvent.timestamp > transitionEvent.timestamp ? saleEvent : transitionEvent;
      }
    } else if (presentationEvent) {
      endEvent = presentationEvent;
      const isDoorstep = !hasTransition && !hasBatchedTransition(presentationEvent);
      endType = isDoorstep ? 'doorstep_presentation' : 'presentation';
      
      if (transitionEvent && hasBatchedTransition(presentationEvent)) {
        endEvent = presentationEvent.timestamp > transitionEvent.timestamp ? presentationEvent : transitionEvent;
        endType = 'presentation';
      }
    } else {
      endEvent = transitionEvent!;
      endType = 'transition';
    }
    
    const doorTime = doorEvent.timestamp.getTime();
    const endTimeMs = endEvent.timestamp.getTime();
    const duration = (endTimeMs - doorTime) / (1000 * 60);
    
    zones.push({
      doorTime: doorEvent.timestamp,
      endTime: endEvent.timestamp,
      duration,
      endType,
      hasSale: endType === 'sale' || endType === 'doorstep_sale',
    });
  });
  
  return zones;
}

/**
 * Convert time to angle (0 = 12 o'clock / start of work, 360 = end of work)
 */
export function timeToAngle(time: Date, workStart: Date, workEnd: Date): number {
  const totalDuration = workEnd.getTime() - workStart.getTime();
  if (totalDuration <= 0) return 0;
  
  const elapsed = time.getTime() - workStart.getTime();
  const progress = Math.max(0, Math.min(1, elapsed / totalDuration));
  
  return progress * 360;
}

/**
 * Build ring segments from events and in-home zones
 * New simplified model:
 * - Gray: Not working / gaps
 * - Blue: Active knocking
 * - Amber: In a home
 * - Green: Sale
 */
export function buildRingSegments(
  events: TimelineEvent[],
  inHomeZones: InHomeZone[],
  breakPeriods: Array<{ start: string; end: string }>,
  workStart: Date,
  workEnd: Date
): RingSegment[] {
  const segments: RingSegment[] = [];
  
  if (!workStart || !workEnd || events.length === 0) {
    // No activity - full gap
    segments.push({ startAngle: 0, endAngle: 360, type: 'gap' });
    return segments;
  }
  
  // Build a timeline of intervals
  interface TimeInterval {
    start: number;
    end: number;
    type: 'knocking' | 'in-home' | 'sale' | 'break' | 'gap';
    priority: number;
  }
  
  const intervals: TimeInterval[] = [];
  
  // Add in-home zones (priority 3 for sales, 2 for in-home)
  inHomeZones.forEach(zone => {
    const startAngle = timeToAngle(zone.doorTime, workStart, workEnd);
    const endAngle = timeToAngle(zone.endTime, workStart, workEnd);
    
    if (zone.hasSale) {
      intervals.push({ start: startAngle, end: endAngle, type: 'sale', priority: 3 });
    } else {
      intervals.push({ start: startAngle, end: endAngle, type: 'in-home', priority: 2 });
    }
  });
  
  // Add break periods (priority 1)
  breakPeriods.forEach(bp => {
    if (!bp.start || !bp.end) return;
    try {
      const breakStart = new Date(bp.start);
      const breakEnd = new Date(bp.end);
      if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) return;
      
      const startAngle = timeToAngle(breakStart, workStart, workEnd);
      const endAngle = timeToAngle(breakEnd, workStart, workEnd);
      
      intervals.push({ start: startAngle, end: endAngle, type: 'break', priority: 1 });
    } catch {
      // Invalid date, skip
    }
  });
  
  // Add knocking activity clusters (priority 1)
  // Group door knocks that are close together
  const doorEvents = events.filter(e => e.type === 'doors_knocked');
  if (doorEvents.length > 0) {
    const CLUSTER_GAP_DEGREES = 15; // About 4% of the day
    let clusterStart = timeToAngle(doorEvents[0].timestamp, workStart, workEnd);
    let clusterEnd = clusterStart + 3; // Minimum segment size
    
    for (let i = 1; i < doorEvents.length; i++) {
      const angle = timeToAngle(doorEvents[i].timestamp, workStart, workEnd);
      
      if (angle - clusterEnd <= CLUSTER_GAP_DEGREES) {
        // Continue the cluster
        clusterEnd = angle + 3;
      } else {
        // End current cluster, start new one
        intervals.push({ start: clusterStart, end: clusterEnd, type: 'knocking', priority: 1 });
        clusterStart = angle;
        clusterEnd = angle + 3;
      }
    }
    // Add the last cluster
    intervals.push({ start: clusterStart, end: Math.min(360, clusterEnd), type: 'knocking', priority: 1 });
  }
  
  // Sort intervals by start angle, then by priority (higher priority wins)
  intervals.sort((a, b) => a.start - b.start || b.priority - a.priority);
  
  // Merge overlapping intervals, higher priority wins
  const merged: TimeInterval[] = [];
  
  for (const interval of intervals) {
    if (merged.length === 0) {
      merged.push({ ...interval });
      continue;
    }
    
    const last = merged[merged.length - 1];
    
    if (interval.start <= last.end) {
      // Overlapping - higher priority wins
      if (interval.priority > last.priority) {
        // Split the last interval and insert the new one
        if (interval.start > last.start) {
          merged.push({ start: last.start, end: interval.start, type: last.type, priority: last.priority });
        }
        last.start = interval.start;
        last.end = interval.end;
        last.type = interval.type;
        last.priority = interval.priority;
      }
      // Extend if same priority
      if (interval.priority === last.priority && interval.end > last.end) {
        last.end = interval.end;
      }
    } else {
      merged.push({ ...interval });
    }
  }
  
  // Fill gaps between intervals
  let currentAngle = 0;
  
  for (const interval of merged) {
    if (interval.start > currentAngle) {
      segments.push({ startAngle: currentAngle, endAngle: interval.start, type: 'gap' });
    }
    segments.push({ startAngle: interval.start, endAngle: interval.end, type: interval.type });
    currentAngle = interval.end;
  }
  
  // Fill remaining to 360
  if (currentAngle < 360) {
    segments.push({ startAngle: currentAngle, endAngle: 360, type: 'gap' });
  }
  
  return segments;
}
