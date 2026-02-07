/**
 * In-Home Zone Calculator
 * Shared utility to detect when a rep was inside a home presenting/selling.
 * 
 * Key distinction:
 * - Transitions: Just got in the door (point event, shown as thin marker)
 * - Presentations: Actually presenting/selling (duration arc, amber)
 * - Sales: Presentation that resulted in a sale (duration arc, green)
 * 
 * Handles batch-logged events intelligently with a priority hierarchy:
 * 1. Explicit sale duration (from CRM time_to_sell_minutes)
 * 2. Non-batched timestamps (>30s gap = real-time logged)
 * 3. Type-specific defaults for batch-logged events
 */

export interface TimelineEvent {
  timestamp: Date;
  type: 'doors_knocked' | 'decision_makers' | 'pitches' | 'transitions' | 'presentations' | 'closes' | 'sale';
  label?: string;
  prmr?: number;
  timeToSellMinutes?: number;  // From sales_log
  timeToSellSource?: 'transition' | 'door' | 'manual';
}

export type InHomeZoneType = 'transition' | 'presentation' | 'sale' | 'doorstep_presentation' | 'doorstep_sale';
export type InHomeZoneSource = 'explicit' | 'timestamps' | 'estimated';

export interface InHomeZone {
  doorTime: Date;
  endTime: Date;
  duration: number; // minutes
  endType: InHomeZoneType;
  hasSale: boolean;
  hasPresentation: boolean; // True for presentations and sales, false for just transitions
  source: InHomeZoneSource;
}

// New segment types with 'transition' as a thin marker
export interface RingSegment {
  startAngle: number;
  endAngle: number;
  type: 'knocking' | 'transition' | 'presentation' | 'sale' | 'break' | 'gap' | 'doorstep' | 'seen_out';
  source?: InHomeZoneSource;
  duration?: number; // Duration in minutes for interactive segments
  hasDM?: boolean; // For doorstep segments
  hasPitch?: boolean; // For doorstep segments
}

// Doorstep zone (talking at door without entering)
export interface DoorstepZone {
  startTime: Date;
  endTime: Date;
  duration: number;
  hasDM: boolean;
  hasPitch: boolean;
}

const BATCH_THRESHOLD_MS = 30 * 1000; // 30 seconds for batch-logged detection

/**
 * Get default duration based on event type
 */
function getDefaultDuration(type: string): number {
  switch (type) {
    case 'sale':
    case 'closes':
      return 30;  // Sales typically take longer
    case 'presentations':
      return 20;  // Presentation without sale
    case 'transitions':
      return 5;   // Transitions are brief - just entering the home
    default:
      return 20;
  }
}

/**
 * Determine the end type based on indicator event
 */
function getEndType(indicator: TimelineEvent, hasDoorMatch: boolean): InHomeZoneType {
  const isSale = indicator.type === 'sale' || indicator.type === 'closes';
  const isPresentation = indicator.type === 'presentations';
  
  if (isSale) {
    return hasDoorMatch ? 'sale' : 'doorstep_sale';
  } else if (isPresentation) {
    return hasDoorMatch ? 'presentation' : 'doorstep_presentation';
  } else {
    return 'transition';
  }
}

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
  const usedDoorIndices = new Set<number>();
  
  const doorEvents = events.filter(e => e.type === 'doors_knocked');
  const transitionEvents = events.filter(e => e.type === 'transitions');
  const presentationEvents = events.filter(e => e.type === 'presentations');
  const saleEvents = events.filter(e => e.type === 'sale' || e.type === 'closes');
  
  // Combine all in-home indicators and sort by time
  const inHomeIndicators = [...transitionEvents, ...presentationEvents, ...saleEvents]
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  
  for (const indicator of inHomeIndicators) {
    const isSale = indicator.type === 'sale' || indicator.type === 'closes';
    const isPresentation = indicator.type === 'presentations';
    const hasPresentation = isSale || isPresentation;
    
    // PRIORITY 1: Use explicit time_to_sell_minutes for sales
    if (isSale && indicator.timeToSellMinutes && indicator.timeToSellMinutes > 0) {
      const duration = indicator.timeToSellMinutes;
      const calculatedStart = new Date(indicator.timestamp.getTime() - duration * 60 * 1000);
      const clampedStart = calculatedStart < workStart ? workStart : calculatedStart;
      
      zones.push({
        doorTime: clampedStart,
        endTime: indicator.timestamp,
        duration,
        endType: 'sale',
        hasSale: true,
        hasPresentation: true,
        source: 'explicit',
      });
      continue;
    }
    
    // PRIORITY 2 & 3: Find matching door knock
    let bestDoorIdx = -1;
    let bestTimeDiff = Infinity;
    
    for (let i = 0; i < doorEvents.length; i++) {
      if (usedDoorIndices.has(i)) continue;
      
      const doorTime = doorEvents[i].timestamp.getTime();
      const indicatorTime = indicator.timestamp.getTime();
      const timeDiff = indicatorTime - doorTime;
      
      if (timeDiff > 0 && timeDiff < 2 * 60 * 60 * 1000 && timeDiff < bestTimeDiff) {
        bestDoorIdx = i;
        bestTimeDiff = timeDiff;
      }
    }
    
    if (bestDoorIdx >= 0) {
      const doorEvent = doorEvents[bestDoorIdx];
      const timeDiff = indicator.timestamp.getTime() - doorEvent.timestamp.getTime();
      const isBatchLogged = timeDiff < BATCH_THRESHOLD_MS;
      
      if (!isBatchLogged) {
        usedDoorIndices.add(bestDoorIdx);
        const duration = timeDiff / (1000 * 60);
        
        zones.push({
          doorTime: doorEvent.timestamp,
          endTime: indicator.timestamp,
          duration,
          endType: getEndType(indicator, true),
          hasSale: isSale,
          hasPresentation,
          source: 'timestamps',
        });
        continue;
      }
      
      usedDoorIndices.add(bestDoorIdx);
      const defaultDuration = getDefaultDuration(indicator.type);
      
      zones.push({
        doorTime: doorEvent.timestamp,
        endTime: new Date(doorEvent.timestamp.getTime() + defaultDuration * 60 * 1000),
        duration: defaultDuration,
        endType: getEndType(indicator, true),
        hasSale: isSale,
        hasPresentation,
        source: 'estimated',
      });
      continue;
    }
    
    // PRIORITY 3: No matching door found
    const defaultDuration = getDefaultDuration(indicator.type);
    const syntheticStart = new Date(indicator.timestamp.getTime() - defaultDuration * 60 * 1000);
    const clampedStart = syntheticStart < workStart ? workStart : syntheticStart;
    
    zones.push({
      doorTime: clampedStart,
      endTime: indicator.timestamp,
      duration: defaultDuration,
      endType: getEndType(indicator, false),
      hasSale: isSale,
      hasPresentation,
      source: 'estimated',
    });
  }
  
  return zones;
}

/**
 * Calculate doorstep zones - gaps between doors where DM/Pitch was logged
 * but no transition occurred (rep talked at door but didn't go inside)
 * 
 * Detection: Gap 3-15min between doors WITH DM/Pitch logged (no transition)
 */
export function calculateDoorstepZones(
  events: TimelineEvent[],
  inHomeZones: InHomeZone[],
  breakPeriods: Array<{ start: string; end: string }>,
  workStart: Date,
  workEnd: Date
): DoorstepZone[] {
  const zones: DoorstepZone[] = [];
  
  const doorEvents = events.filter(e => e.type === 'doors_knocked')
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const dmEvents = events.filter(e => e.type === 'decision_makers');
  const pitchEvents = events.filter(e => e.type === 'pitches');
  const transitionEvents = events.filter(e => e.type === 'transitions');
  
  const MIN_GAP_MINUTES = 3;
  const MAX_GAP_MINUTES = 15;
  const BATCH_GRACE_MS = 60 * 1000; // 60s grace for batch-logged DM/pitch after next door
  
  // Check if a time range overlaps with in-home zones
  const overlapsInHomeZone = (start: Date, end: Date): boolean => {
    return inHomeZones.some(zone => {
      return zone.doorTime < end && zone.endTime > start;
    });
  };
  
  // Check if a time range overlaps with breaks
  const overlapsBreak = (start: Date, end: Date): boolean => {
    return breakPeriods.some(bp => {
      if (!bp.start || !bp.end) return false;
      try {
        const breakStart = new Date(bp.start);
        const breakEnd = new Date(bp.end);
        return breakStart < end && breakEnd > start;
      } catch {
        return false;
      }
    });
  };
  
  // Check if there's a transition between two times
  const hasTransitionBetween = (start: Date, end: Date): boolean => {
    return transitionEvents.some(t => t.timestamp >= start && t.timestamp <= end);
  };
  
  // Check if DM or Pitch was logged between two doors (or within grace period after door B)
  const checkDMPitchBetween = (doorA: Date, doorB: Date): { hasDM: boolean; hasPitch: boolean } => {
    const graceEnd = new Date(doorB.getTime() + BATCH_GRACE_MS);
    
    const hasDM = dmEvents.some(dm => 
      dm.timestamp >= doorA && dm.timestamp <= graceEnd
    );
    const hasPitch = pitchEvents.some(p => 
      p.timestamp >= doorA && p.timestamp <= graceEnd
    );
    
    return { hasDM, hasPitch };
  };
  
  // Iterate through consecutive door pairs
  for (let i = 0; i < doorEvents.length - 1; i++) {
    const doorA = doorEvents[i].timestamp;
    const doorB = doorEvents[i + 1].timestamp;
    const gapMinutes = (doorB.getTime() - doorA.getTime()) / (1000 * 60);
    
    // Only consider gaps in the 3-15 minute range
    if (gapMinutes < MIN_GAP_MINUTES || gapMinutes > MAX_GAP_MINUTES) {
      continue;
    }
    
    // Skip if this gap is covered by an in-home zone
    if (overlapsInHomeZone(doorA, doorB)) {
      continue;
    }
    
    // Skip if this gap is covered by a break
    if (overlapsBreak(doorA, doorB)) {
      continue;
    }
    
    // Skip if there's a transition in this gap (means they went inside)
    if (hasTransitionBetween(doorA, doorB)) {
      continue;
    }
    
    // Check if DM or Pitch was logged in this gap
    const { hasDM, hasPitch } = checkDMPitchBetween(doorA, doorB);
    
    // Only mark as doorstep talk if DM or Pitch exists
    if (hasDM || hasPitch) {
      zones.push({
        startTime: doorA,
        endTime: doorB,
        duration: gapMinutes,
        hasDM,
        hasPitch,
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
 * 
 * New semantic model:
 * - Gray: Gaps (not working)
 * - Blue: Active knocking
 * - Thin amber line: Transition (just got in)
 * - Amber arc: Presentation (presenting but no sale)
 * - Green arc: Sale (presentation that converted)
 * - Orange dashed: Break
 */
export function buildRingSegments(
  events: TimelineEvent[],
  inHomeZones: InHomeZone[],
  breakPeriods: Array<{ start: string; end: string }>,
  workStart: Date,
  workEnd: Date,
  doorstepZones?: DoorstepZone[]
): RingSegment[] {
  if (!workStart || !workEnd || events.length === 0) {
    return [{ startAngle: 0, endAngle: 360, type: 'gap' }];
  }
  
  // Calculate doorstep zones if not provided
  const computedDoorstepZones = doorstepZones ?? calculateDoorstepZones(
    events, inHomeZones, breakPeriods, workStart, workEnd
  );
  
  interface TimeInterval {
    start: number;
    end: number;
    type: 'knocking' | 'transition' | 'presentation' | 'sale' | 'break' | 'gap' | 'doorstep' | 'seen_out';
    priority: number;
    source?: InHomeZoneSource;
    duration?: number;
    hasDM?: boolean;
    hasPitch?: boolean;
  }
  
  const intervals: TimeInterval[] = [];
  
  // Add doorstep zones (priority 1.5 - above knocking, below in-home)
  computedDoorstepZones.forEach(zone => {
    intervals.push({
      start: timeToAngle(zone.startTime, workStart, workEnd),
      end: timeToAngle(zone.endTime, workStart, workEnd),
      type: 'doorstep',
      priority: 1.5,
      duration: zone.duration,
      hasDM: zone.hasDM,
      hasPitch: zone.hasPitch,
    });
  });
  
  // Minimum arc sizes for visibility
  const MIN_PRESENTATION_DEGREES = 10; // Presentations/sales need to be clearly visible
  const TRANSITION_MARKER_DEGREES = 3; // Transitions are thin markers
  
  // Add in-home zones with proper type differentiation
  inHomeZones.forEach(zone => {
    let startAngle = timeToAngle(zone.doorTime, workStart, workEnd);
    let endAngle = timeToAngle(zone.endTime, workStart, workEnd);
    
    // For sales and presentations, ensure minimum visible arc
    if (zone.hasPresentation) {
      if (endAngle - startAngle < MIN_PRESENTATION_DEGREES) {
        const midpoint = (startAngle + endAngle) / 2;
        startAngle = Math.max(0, midpoint - MIN_PRESENTATION_DEGREES / 2);
        endAngle = Math.min(360, midpoint + MIN_PRESENTATION_DEGREES / 2);
      }
      
      if (zone.hasSale) {
        intervals.push({ 
          start: startAngle, 
          end: endAngle, 
          type: 'sale', 
          priority: 4,  // Sales highest priority
          source: zone.source,
          duration: zone.duration,
        });
      } else {
        intervals.push({ 
          start: startAngle, 
          end: endAngle, 
          type: 'presentation', 
          priority: 3,  // Presentations second
          source: zone.source,
          duration: zone.duration,
        });
      }
    } else {
      // Transitions are just thin markers at the timestamp
      const markerAngle = timeToAngle(zone.endTime, workStart, workEnd);
      intervals.push({ 
        start: Math.max(0, markerAngle - TRANSITION_MARKER_DEGREES / 2), 
        end: Math.min(360, markerAngle + TRANSITION_MARKER_DEGREES / 2), 
        type: 'transition', 
        priority: 2,  // Transitions lower priority
        source: zone.source,
        duration: zone.duration,
      });
    }
  });
  
  // Add break periods (priority 1)
  breakPeriods.forEach(bp => {
    if (!bp.start || !bp.end) return;
    try {
      const breakStart = new Date(bp.start);
      const breakEnd = new Date(bp.end);
      if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) return;
      
      intervals.push({ 
        start: timeToAngle(breakStart, workStart, workEnd), 
        end: timeToAngle(breakEnd, workStart, workEnd), 
        type: 'break', 
        priority: 1 
      });
    } catch {
      // Invalid date, skip
    }
  });
  
  // Add knocking activity clusters (priority 1)
  const doorEvents = events.filter(e => e.type === 'doors_knocked');
  if (doorEvents.length > 0) {
    const CLUSTER_GAP_DEGREES = 15;
    let clusterStart = timeToAngle(doorEvents[0].timestamp, workStart, workEnd);
    let clusterEnd = clusterStart + 3;
    
    for (let i = 1; i < doorEvents.length; i++) {
      const angle = timeToAngle(doorEvents[i].timestamp, workStart, workEnd);
      
      if (angle - clusterEnd <= CLUSTER_GAP_DEGREES) {
        clusterEnd = angle + 3;
      } else {
        intervals.push({ start: clusterStart, end: clusterEnd, type: 'knocking', priority: 1 });
        clusterStart = angle;
        clusterEnd = angle + 3;
      }
    }
    intervals.push({ start: clusterStart, end: Math.min(360, clusterEnd), type: 'knocking', priority: 1 });
  }
  
  // Sort by start angle, then by priority (descending)
  intervals.sort((a, b) => a.start - b.start || b.priority - a.priority);
  
  // NON-OVERLAPPING merge - properly split intervals when higher priority overlaps
  const finalIntervals: TimeInterval[] = [];
  
  for (const interval of intervals) {
    if (finalIntervals.length === 0) {
      finalIntervals.push({ ...interval });
      continue;
    }
    
    // Check for overlaps with existing intervals
    let added = false;
    const newFinal: TimeInterval[] = [];
    
    for (const existing of finalIntervals) {
      // No overlap
      if (interval.end <= existing.start || interval.start >= existing.end) {
        newFinal.push(existing);
        continue;
      }
      
      // Overlap exists - split based on priority
      if (interval.priority > existing.priority) {
        // Higher priority interval takes over the overlap
        if (existing.start < interval.start) {
          newFinal.push({ ...existing, end: interval.start });
        }
        if (existing.end > interval.end) {
          newFinal.push({ ...existing, start: interval.end });
        }
      } else {
        // Lower priority - clip the new interval
        if (interval.start < existing.start) {
          if (!added) {
            newFinal.push({ ...interval, end: existing.start });
            added = true;
          }
        }
        if (interval.end > existing.end) {
          if (!added) {
            newFinal.push({ ...interval, start: existing.end });
            added = true;
          }
        }
        newFinal.push(existing);
        continue;
      }
      newFinal.push(existing);
    }
    
    if (!added && interval.priority >= Math.max(...finalIntervals.map(f => f.priority), 0)) {
      newFinal.push({ ...interval });
    } else if (!added) {
      // Find gaps to insert
      const sortedFinal = [...newFinal].sort((a, b) => a.start - b.start);
      let canAdd = true;
      for (const f of sortedFinal) {
        if (!(interval.end <= f.start || interval.start >= f.end)) {
          canAdd = false;
          break;
        }
      }
      if (canAdd) {
        newFinal.push({ ...interval });
      }
    }
    
    finalIntervals.length = 0;
    finalIntervals.push(...newFinal);
  }
  
  // Sort final intervals
  finalIntervals.sort((a, b) => a.start - b.start);
  
  // Build final segments with gap filling
  const segments: RingSegment[] = [];
  let currentAngle = 0;
  
  for (const interval of finalIntervals) {
    if (interval.start > currentAngle + 0.5) {
      segments.push({ startAngle: currentAngle, endAngle: interval.start, type: 'gap' });
    }
    segments.push({ 
      startAngle: Math.max(currentAngle, interval.start), 
      endAngle: interval.end, 
      type: interval.type,
      source: interval.source,
      duration: interval.duration,
      hasDM: interval.hasDM,
      hasPitch: interval.hasPitch,
    });
    currentAngle = interval.end;
  }
  
  if (currentAngle < 359.5) {
    segments.push({ startAngle: currentAngle, endAngle: 360, type: 'gap' });
  }
  
  return segments;
}

/**
 * Get summary stats about zone data quality
 */
export interface ZoneQualitySummary {
  totalZones: number;
  explicitCount: number;
  timestampCount: number;
  estimatedCount: number;
  totalMinutes: number;
  explicitMinutes: number;
  timestampMinutes: number;
  estimatedMinutes: number;
}

export function getZoneQualitySummary(zones: InHomeZone[]): ZoneQualitySummary {
  const summary: ZoneQualitySummary = {
    totalZones: zones.length,
    explicitCount: 0,
    timestampCount: 0,
    estimatedCount: 0,
    totalMinutes: 0,
    explicitMinutes: 0,
    timestampMinutes: 0,
    estimatedMinutes: 0,
  };
  
  zones.forEach(zone => {
    summary.totalMinutes += zone.duration;
    
    switch (zone.source) {
      case 'explicit':
        summary.explicitCount++;
        summary.explicitMinutes += zone.duration;
        break;
      case 'timestamps':
        summary.timestampCount++;
        summary.timestampMinutes += zone.duration;
        break;
      case 'estimated':
        summary.estimatedCount++;
        summary.estimatedMinutes += zone.duration;
        break;
    }
  });
  
  return summary;
}
