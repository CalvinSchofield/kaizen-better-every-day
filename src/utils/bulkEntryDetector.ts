/**
 * Bulk Entry Detection Utility
 * Detects when a rep logged data in rapid bursts rather than real-time.
 */

export interface BulkBatch {
  type: string;
  count: number;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  ratePerSecond: number;
}

export interface BulkEntryStats {
  bulkEntryDetected: boolean;
  largestBatch: number;
  batchedEventsCount: number;
  batchedEventsPercent: number;
  batches: BulkBatch[];
}

interface TimestampedEvent {
  timestamp: Date;
  type: string;
}

const BATCH_WINDOW_MS = 30 * 1000; // 30 seconds
const MIN_BATCH_SIZE = 5;
const MIN_RATE_PER_SECOND = 0.5; // More than 1 tap every 2 seconds

/**
 * Detect bulk entry patterns from counter timestamps
 */
export function detectBulkEntry(
  counterTimestamps: Record<string, string[]> | undefined
): BulkEntryStats {
  if (!counterTimestamps) {
    return {
      bulkEntryDetected: false,
      largestBatch: 0,
      batchedEventsCount: 0,
      batchedEventsPercent: 0,
      batches: [],
    };
  }

  // Convert to events with parsed dates
  const events: TimestampedEvent[] = [];
  
  Object.entries(counterTimestamps).forEach(([type, times]) => {
    if (Array.isArray(times)) {
      times.forEach(t => {
        try {
          const date = new Date(t);
          if (!isNaN(date.getTime())) {
            events.push({ timestamp: date, type });
          }
        } catch {
          // Skip invalid dates
        }
      });
    }
  });

  if (events.length < MIN_BATCH_SIZE) {
    return {
      bulkEntryDetected: false,
      largestBatch: 0,
      batchedEventsCount: 0,
      batchedEventsPercent: 0,
      batches: [],
    };
  }

  const batches: BulkBatch[] = [];

  // Group events by type
  const eventsByType: Record<string, TimestampedEvent[]> = {};
  events.forEach(event => {
    if (!eventsByType[event.type]) {
      eventsByType[event.type] = [];
    }
    eventsByType[event.type].push(event);
  });

  // For each type, find rapid sequences
  Object.entries(eventsByType).forEach(([type, typeEvents]) => {
    if (typeEvents.length < MIN_BATCH_SIZE) return;

    // Sort by timestamp
    typeEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let batchStart = 0;

    while (batchStart < typeEvents.length) {
      // Find the end of this potential batch
      let batchEnd = batchStart;

      while (batchEnd < typeEvents.length - 1) {
        const gap = typeEvents[batchEnd + 1].timestamp.getTime() - typeEvents[batchEnd].timestamp.getTime();
        if (gap <= BATCH_WINDOW_MS) {
          batchEnd++;
        } else {
          break;
        }
      }

      const batchSize = batchEnd - batchStart + 1;

      if (batchSize >= MIN_BATCH_SIZE) {
        const startTime = typeEvents[batchStart].timestamp;
        const endTime = typeEvents[batchEnd].timestamp;
        const durationSeconds = Math.max(1, (endTime.getTime() - startTime.getTime()) / 1000);
        const ratePerSecond = batchSize / durationSeconds;

        // Only count as bulk if rate is above threshold
        if (ratePerSecond >= MIN_RATE_PER_SECOND) {
          batches.push({
            type,
            count: batchSize,
            startTime,
            endTime,
            durationSeconds,
            ratePerSecond,
          });
        }
      }

      batchStart = batchEnd + 1;
    }
  });

  // Calculate summary stats
  const totalBatchedEvents = batches.reduce((sum, b) => sum + b.count, 0);
  const totalEvents = events.length;
  const batchedPercent = totalEvents > 0 ? Math.round((totalBatchedEvents / totalEvents) * 100) : 0;
  const largestBatch = batches.length > 0 ? Math.max(...batches.map(b => b.count)) : 0;

  // Bulk entry is detected if >50% of events are batched OR largest batch > 20
  const bulkEntryDetected = batchedPercent > 50 || largestBatch > 20;

  return {
    bulkEntryDetected,
    largestBatch,
    batchedEventsCount: totalBatchedEvents,
    batchedEventsPercent: batchedPercent,
    batches: batches.sort((a, b) => b.count - a.count),
  };
}
