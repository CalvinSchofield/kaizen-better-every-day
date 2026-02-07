
# Refined In-Home Zone Detection Logic

## Problem Summary

Based on your workflow explanation, the core issue is:

1. **Door knocks are accurate** — tapped within seconds of knocking
2. **Everything else is delayed** — DM, Pitch, Transition, Presentation, Close are often marked after the fact, sometimes all at once after a sale

This means the current algorithm (which calculates duration from door timestamp → indicator timestamp) often produces **misleading results** when events are batch-logged.

**But we already have the solution**: When logging a sale, you capture `time_to_sell_minutes` with a source (`door`, `transition`, or `manual`). This is the *ground truth* for how long you were actually in the home.

---

## Proposed Algorithm Refinement

### Data Priority Hierarchy

```text
┌─────────────────────────────────────────────────────────────┐
│  PRIORITY 1: Explicit Sale Duration (Most Accurate)        │
│  └── Use sale.time_to_sell_minutes when available          │
│      Duration calculated back from sale timestamp          │
├─────────────────────────────────────────────────────────────┤
│  PRIORITY 2: Non-Batched Timestamps (Good Accuracy)        │
│  └── Door → Indicator with >2 minute gap                   │
│      (indicates real-time logging, not rapid taps)         │
├─────────────────────────────────────────────────────────────┤
│  PRIORITY 3: Batch-Logged Fallback (Estimated)             │
│  └── Use intelligent defaults based on indicator type      │
│      - Sale: 30 min (average close takes longer)           │
│      - Presentation: 20 min                                │
│      - Transition only: 15 min                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Changes to `calculateInHomeZones`

1. **Accept sales log as input** to access `time_to_sell_minutes`
2. **For sales with explicit duration**: Calculate zone start by subtracting duration from sale timestamp
3. **Detect batch logging**: If door→indicator gap is <30 seconds, assume batch logged
4. **Better fallback durations**: Different defaults for different interaction types

---

## Technical Implementation

### Updated Interface

```typescript
export interface TimelineEvent {
  timestamp: Date;
  type: 'doors_knocked' | 'decision_makers' | 'pitches' | 'transitions' | 'presentations' | 'closes' | 'sale';
  label?: string;
  prmr?: number;
  timeToSellMinutes?: number;  // NEW: From sales_log
  timeToSellSource?: 'transition' | 'door' | 'manual';  // NEW
}
```

### Updated Zone Calculation

```typescript
function calculateInHomeZones(
  events: TimelineEvent[],
  workStart: Date,
  workEnd: Date
): InHomeZone[] {
  // ... existing setup ...
  
  for (const indicator of inHomeIndicators) {
    const isSale = indicator.type === 'sale' || indicator.type === 'closes';
    
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
        source: 'explicit',  // NEW: Track data source
      });
      continue;
    }
    
    // PRIORITY 2: Find matching door knock (only if not batch-logged)
    let bestDoorIdx = findNearestUnusedDoor(doorEvents, indicator, usedDoorIndices);
    
    if (bestDoorIdx >= 0) {
      const doorEvent = doorEvents[bestDoorIdx];
      const timeDiff = indicator.timestamp.getTime() - doorEvent.timestamp.getTime();
      
      // Detect batch logging: <30 seconds is suspicious
      const isBatchLogged = timeDiff < BATCH_THRESHOLD_MS;
      
      if (!isBatchLogged) {
        // Real-time logging - use actual timestamps
        usedDoorIndices.add(bestDoorIdx);
        zones.push({
          doorTime: doorEvent.timestamp,
          endTime: indicator.timestamp,
          duration: timeDiff / (1000 * 60),
          endType: getEndType(indicator),
          hasSale: isSale,
          source: 'timestamps',
        });
        continue;
      }
    }
    
    // PRIORITY 3: Fallback with type-specific defaults
    const defaultDuration = getDefaultDuration(indicator.type);
    const syntheticStart = new Date(indicator.timestamp.getTime() - defaultDuration * 60 * 1000);
    const clampedStart = syntheticStart < workStart ? workStart : syntheticStart;
    
    zones.push({
      doorTime: clampedStart,
      endTime: indicator.timestamp,
      duration: defaultDuration,
      endType: getEndType(indicator),
      hasSale: isSale,
      source: 'estimated',  // Flag for UI warning
    });
  }
  
  return zones;
}

function getDefaultDuration(type: string): number {
  switch (type) {
    case 'sale':
    case 'closes':
      return 30;  // Sales typically take longer
    case 'presentations':
      return 20;  // Presentation without sale
    case 'transitions':
      return 15;  // Just got in, no presentation
    default:
      return 20;
  }
}
```

---

## UI Enhancements

### Show Data Source Quality

When displaying in-home metrics to leaders, indicate confidence level:

```text
┌─────────────────────────────────────────┐
│  In-Home: 45 min (3 interactions)       │
│  ├── ✓ 25 min (explicit from CRM)       │
│  ├── ✓ 12 min (real-time logged)        │
│  └── ⚠ ~8 min (estimated)               │
└─────────────────────────────────────────┘
```

This tells the leader:
- 2 of 3 in-home zones are reliable
- 1 is estimated due to batch logging

### Ring Visualization

- **Solid amber arc**: High-confidence in-home zone (explicit or real-time)
- **Striped/dashed amber arc**: Estimated zone (batch-logged fallback)

This gives leaders visual feedback on data quality without hiding the information.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/utils/inHomeZoneCalculator.ts` | Add sales data parameter, implement priority-based duration logic, add source tracking |
| `src/components/activity-ring/ActivityRingHero.tsx` | Pass sales log to zone calculator, optionally show source breakdown |
| `src/components/reports/v2/RepDayActivityFlow.tsx` | Update to use new zone source information for display |

---

## Edge Cases Handled

| Scenario | Current Behavior | New Behavior |
|----------|------------------|--------------|
| Sale with CRM duration | Uses door→close gap (often wrong) | Uses explicit `time_to_sell_minutes` |
| Rapid-tap all events after sale | Shows tiny duration | Uses 30-min sale default, flagged as estimated |
| Transition marked during lull | Uses door→transition gap | Same (good accuracy) |
| Multiple transitions same door | First gets the door | Each gets assigned; extras use defaults |
| No door knock at all | 20-min default | Type-specific default (15-30 min) |

---

## Summary for Leaders

The refined logic gives you:

1. **More accurate in-home time** when reps use the CRM to record sale duration
2. **Clear visibility** into which data is reliable vs estimated
3. **Better coaching context** — you can see if a rep's timeline is trustworthy or needs improvement
4. **Incentive for real-time logging** — reps who log accurately get accurate reports

The bulk entry warning (⚡ badge) already tells you when data is suspect. This refinement makes the *underlying calculations* smarter when that happens.
