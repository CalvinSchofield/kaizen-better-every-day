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
const DEFAULT_IN_HOME_DURATION_MINUTES = 20; // Default duration if we can't calculate

/**
 * Calculate in-home zones from timeline events
 * Improved algorithm to handle batch-logged events:
 * 1. First try to match transitions/presentations to preceding door knocks
 * 2. For unmatched transitions (batch logged), assign them a default duration
 */
export function calculateInHomeZones(
  events: TimelineEvent[],
  workStart: Date,
  workEnd: Date
): InHomeZone[] {
  if (events.length === 0) return [];
  
  const zones: InHomeZone[] = [];
  const usedDoorIndices = new Set<number>();
  
  // Get all events by type
  const doorEvents = events.filter(e => e.type === 'doors_knocked');
  const transitionEvents = events.filter(e => e.type === 'transitions');
  const presentationEvents = events.filter(e => e.type === 'presentations');
  const saleEvents = events.filter(e => e.type === 'sale' || e.type === 'closes');
  
  // Strategy 1: Match each transition/presentation/sale to the nearest preceding door knock
  const inHomeIndicators = [...transitionEvents, ...presentationEvents, ...saleEvents]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  for (const indicator of inHomeIndicators) {
    // Find the nearest door knock BEFORE this indicator that hasn't been used
    let bestDoorIdx = -1;
    let bestTimeDiff = Infinity;
    
    for (let i = 0; i < doorEvents.length; i++) {
      if (usedDoorIndices.has(i)) continue;
      
      const doorTime = doorEvents[i].timestamp.getTime();
      const indicatorTime = indicator.timestamp.getTime();
      const timeDiff = indicatorTime - doorTime;
      
      // Door must be BEFORE the indicator and within reasonable time (2 hours max)
      if (timeDiff > 0 && timeDiff < 2 * 60 * 60 * 1000 && timeDiff < bestTimeDiff) {
        bestDoorIdx = i;
        bestTimeDiff = timeDiff;
      }
    }
    
    const isSale = indicator.type === 'sale' || indicator.type === 'closes';
    const isPresentation = indicator.type === 'presentations';
    const isTransition = indicator.type === 'transitions';
    
    // Determine end type
    let endType: InHomeZoneType;
    if (isSale) {
      endType = bestDoorIdx >= 0 ? 'sale' : 'doorstep_sale';
    } else if (isPresentation) {
      endType = bestDoorIdx >= 0 ? 'presentation' : 'doorstep_presentation';
    } else {
      endType = 'transition';
    }
    
    if (bestDoorIdx >= 0) {
      // Found a matching door - create zone from door to indicator
      usedDoorIndices.add(bestDoorIdx);
      const doorEvent = doorEvents[bestDoorIdx];
      const duration = (indicator.timestamp.getTime() - doorEvent.timestamp.getTime()) / (1000 * 60);
      
      zones.push({
        doorTime: doorEvent.timestamp,
        endTime: indicator.timestamp,
        duration,
        endType,
        hasSale: isSale,
      });
    } else {
      // No matching door found (batch logged) - create synthetic zone with default duration
      // Start time is the indicator time minus default duration
      const syntheticStart = new Date(indicator.timestamp.getTime() - DEFAULT_IN_HOME_DURATION_MINUTES * 60 * 1000);
      const clampedStart = syntheticStart < workStart ? workStart : syntheticStart;
      
      zones.push({
        doorTime: clampedStart,
        endTime: indicator.timestamp,
        duration: DEFAULT_IN_HOME_DURATION_MINUTES,
        endType,
        hasSale: isSale,
      });
    }
  }
  
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
  // Ensure minimum visible arc size for in-home zones
  const MIN_INHOME_DEGREES = 8; // About 2% of the day, ~15 min for an 8hr day
  
  inHomeZones.forEach(zone => {
    let startAngle = timeToAngle(zone.doorTime, workStart, workEnd);
    let endAngle = timeToAngle(zone.endTime, workStart, workEnd);
    
    // Ensure minimum visible size for in-home zones
    if (endAngle - startAngle < MIN_INHOME_DEGREES) {
      // Center the minimum size around the midpoint
      const midpoint = (startAngle + endAngle) / 2;
      startAngle = Math.max(0, midpoint - MIN_INHOME_DEGREES / 2);
      endAngle = Math.min(360, midpoint + MIN_INHOME_DEGREES / 2);
    }
    
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
