

# Smart Funnel-Aware Timestamp Warnings

## Problem Summary

Looking at the screenshot and code, there are two issues with the current timestamp warning system:

1. **Timestamps show after finalization**: Once `is_finalized === true`, the timestamp chips continue displaying, but they're no longer useful since the day is complete.

2. **Warnings are "dumb"**: Every counter shows ⚠️ if >30 minutes since last tap, regardless of funnel context. The user correctly points out:
   - **Doors** shouldn't warn if the rep has been pitching/transitioning (they're in-home)
   - **Presentations** shouldn't warn if they haven't transitioned recently (can't present without transitioning first)
   - Each funnel stage should consider the stage before it

3. **Static threshold**: The 30-minute stale threshold is one-size-fits-all, ignoring the rep's personal conversion patterns and improvement over time.

---

## Solution Architecture

### Part 1: Hide Timestamps When Finalized (Simple)

**Change**: In `CounterCard.tsx`, check if entry is finalized and hide the timestamp chip entirely.

```
// Pass is_finalized down through QTallyGrid → CounterCard
{timestampInfo && !isFinalized && (
  <div className={...}>
    Last: {timestampInfo.formattedTime}
    {shouldShowWarning && ' ⚠️'}
  </div>
)}
```

### Part 2: Funnel-Aware Warning Logic

Create intelligent warning rules that consider the sales funnel flow:

```
Doors → DMs → Pitches → Transitions → Presentations → Closes
```

**Rule Matrix:**

| Counter | Should Warn When... | Should NOT Warn When... |
|---------|---------------------|------------------------|
| Doors | Stale AND no recent pitches/transitions/presentations | Rep is clearly in-home (recent pitches or transitions) |
| DMs | Stale AND doors being knocked recently | Doors also stale (knocking has stopped) |
| Pitches | Stale AND doors/DMs being logged | Door activity also stale |
| Transitions | Stale AND pitches happening | Pitches also stale |
| Presentations | Stale AND transitions happening | Transitions also stale (need to transition to present) |
| Closes | Never warn (sales are intermittent) | Always |

**Implementation**: Create a `useFunnelAwareWarnings` hook that:
1. Takes all counter timestamps
2. Calculates which counters are actively being worked
3. Returns warning state for each counter based on funnel logic

### Part 3: Personalized Thresholds Based on Historical Data

Instead of a static 30-minute threshold, calculate personalized "expected gap" thresholds using the rep's historical data:

**Approach: Rolling Average of Conversion Timing**

For each stage transition, calculate the rep's typical time between events:
- Average time between doors
- Average time door-to-pitch
- Average time pitch-to-transition
- Average time transition-to-presentation

**For Rookies (first 2 months):**
- Use a **weighted moving average** with more recent days weighted higher
- This accounts for rapid improvement during onboarding
- Fall back to office averages if insufficient personal data

**For Vets:**
- Use their full historical average
- Can use simpler mean calculation

**Threshold Formula:**
```
personalThreshold = personalAvg * 1.5 + buffer
```
Show warning only when gap exceeds their personThreshold, not a static 30 min.

---

## Technical Implementation

### New Files

1. **`src/hooks/useFunnelAwareWarnings.ts`**
   - Input: counterTimestamps, entry values, isFinalized
   - Output: `{ [field: string]: { shouldWarn: boolean; reason?: string } }`
   - Contains funnel logic determining when each counter should show warning

2. **`src/hooks/usePersonalConversionTiming.ts`**
   - Fetches historical daily_entries for the current user
   - Calculates average time-between-events for each funnel stage
   - Uses weighted average for rookies, simple average for vets
   - Caches results (10-minute staleTime)

### Modified Files

1. **`src/components/track/CounterCard.tsx`**
   - Add `isFinalized` prop - hide timestamps entirely when true
   - Add `shouldShowWarning` prop - decouple warning from simple staleness
   - Remove internal stale calculation (moved to parent hook)

2. **`src/components/QTallyGrid.tsx`**
   - Call `useFunnelAwareWarnings` hook
   - Pass computed warning state to each CounterCard

3. **`src/pages/Track.tsx`**
   - Pass `isFinalized` down to QTallyGrid

---

## Detailed Logic

### Funnel-Aware Warning Algorithm

```typescript
function calculateWarnings(timestamps: Record<string, string[]>, entry: Entry) {
  const now = Date.now();
  
  const getMinutesSinceLast = (field: string) => {
    const ts = timestamps[field];
    if (!ts?.length) return Infinity;
    return (now - new Date(ts[ts.length - 1]).getTime()) / 60000;
  };
  
  const warnings: Record<string, { shouldWarn: boolean; reason?: string }> = {};
  
  const doorsStale = getMinutesSinceLast('doors_knocked') > threshold;
  const pitchesStale = getMinutesSinceLast('pitches') > threshold;
  const transitionsStale = getMinutesSinceLast('transitions') > threshold;
  const presentationsStale = getMinutesSinceLast('presentations') > threshold;
  
  // Is rep "in-home"? (actively pitching, transitioning, or presenting)
  const isInHome = !pitchesStale || !transitionsStale || !presentationsStale;
  
  // Doors: Only warn if stale AND not in-home
  warnings.doors_knocked = {
    shouldWarn: doorsStale && !isInHome && entry.doors_knocked > 0,
    reason: isInHome ? 'In-home activity detected' : undefined
  };
  
  // DMs: Only warn if stale AND still knocking doors
  warnings.decision_makers = {
    shouldWarn: !doorsStale && getMinutesSinceLast('decision_makers') > threshold,
    reason: doorsStale ? 'Door knocking paused' : undefined
  };
  
  // Pitches: Only warn if doors/DMs active but pitches lagging
  warnings.pitches = {
    shouldWarn: !doorsStale && pitchesStale && entry.pitches > 0,
  };
  
  // Transitions: Only warn if pitching but not transitioning
  warnings.transitions = {
    shouldWarn: !pitchesStale && transitionsStale && entry.transitions > 0,
  };
  
  // Presentations: Only warn if transitioning but not presenting
  warnings.presentations = {
    shouldWarn: !transitionsStale && presentationsStale && entry.presentations > 0,
    reason: transitionsStale ? 'Need to transition first' : undefined
  };
  
  // Closes: Never auto-warn (sales are unpredictable)
  warnings.closes = { shouldWarn: false };
  
  return warnings;
}
```

### Personal Timing Calculation

```typescript
async function calculatePersonalTiming(userId: string, isRookie: boolean) {
  // Fetch last 30 finalized entries with timestamps
  const entries = await fetchEntriesWithTimestamps(userId, 30);
  
  // For each entry, calculate average gap between consecutive events
  const allGaps = {
    doors: [],
    pitches: [],
    transitions: [],
    presentations: [],
  };
  
  entries.forEach(entry => {
    const ts = entry.counter_timestamps;
    // Calculate gaps within each field
    // Calculate gaps between fields (door → pitch, pitch → transition, etc.)
  });
  
  if (isRookie) {
    // Weight recent entries more heavily
    // entries[0] = most recent, gets weight 1.0
    // entries[n] = oldest, gets weight 0.3
    return calculateWeightedAverages(allGaps, entries.length);
  }
  
  return calculateSimpleAverages(allGaps);
}
```

---

## Data Flow

```
TrackWithLayout.tsx
  └── passes entry.is_finalized, counterTimestamps
        └── Track.tsx
              └── passes to QTallyGrid
                    └── calls useFunnelAwareWarnings(timestamps, entry, isFinalized)
                          └── calls usePersonalConversionTiming() for thresholds
                    └── passes { shouldWarn, isFinalized } to each CounterCard
                          └── CounterCard hides timestamp if finalized
                          └── CounterCard shows ⚠️ only if shouldWarn === true
```

---

## Edge Cases

1. **First day knocking**: No historical data → use generous defaults (60 min threshold)
2. **No timestamps on counter**: Don't show warning (nothing to compare)
3. **Custom counters**: Skip funnel logic, use simple staleness check
4. **All counters at 0**: Don't show any warnings
5. **Just started (< 30 min of work)**: Suppress all warnings initially

---

## Expected Behavior After Implementation

**Scenario 1**: Rep knocked 12 doors, then got into 3 homes and is currently presenting
- Doors timestamp: 1:30 PM (45 min ago) → **No warning** (in-home)
- Presentations timestamp: 2:10 PM (5 min ago) → **No warning** (recent)

**Scenario 2**: Rep knocked doors all morning, hasn't pitched in 40 min
- Doors timestamp: 2:00 PM (15 min ago) → **No warning** (recent)
- Pitches timestamp: 1:15 PM (60 min ago) → **Warning** (doors active but pitches stale)

**Scenario 3**: Rep finished their day but forgot to save
- All timestamps: > 30 min ago → **No warnings shown** (all context-aware rules prevent false alarms when uniformly stale)

**Scenario 4**: Entry is finalized
- **No timestamps shown at all**

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useFunnelAwareWarnings.ts` | Create - funnel-based warning logic |
| `src/hooks/usePersonalConversionTiming.ts` | Create - personalized threshold calculation |
| `src/components/track/CounterCard.tsx` | Modify - accept isFinalized and shouldShowWarning props |
| `src/components/QTallyGrid.tsx` | Modify - integrate warning hook, pass props down |
| `src/pages/Track.tsx` | Modify - pass isFinalized to QTallyGrid |

