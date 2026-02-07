

# Refined Activity Ring: Require DM/Pitch to Classify Doorstep Talk

## Problem Recap

Current ring shows all gaps as "idle time" (gray), but many of these gaps are reps talking to people:
- A rep talks for 8 minutes at a door → logs DM after leaving → shows as "gap" 
- A rep takes a smoke break for 8 minutes → shows as "gap"

**These two scenarios are fundamentally different** but look identical on the ring.

Your clarification: Only classify a gap as "doorstep talk" if a **DM or Pitch was actually logged** during that period. The timestamp of the DM/pitch doesn't matter (often batch-logged), but its **existence** proves a conversation happened.

---

## Refined Logic

### Detection Rule

```
Door A → [gap] → Door B

IF gap is 3-15 minutes:
  - IF DM or Pitch logged between A and B → Doorstep Talk (Cyan)
  - ELSE → True Gap (Gray)

IF gap > 15 minutes:
  - IF Transition logged → In-Home Zone (Amber/Green)
  - ELSE → True Gap (Gray)
```

### Visual Model

| Color | Segment | Detection |
|-------|---------|-----------|
| Blue | Knocking | Door clusters with < 3min gaps |
| **Cyan** | **Doorstep Talk** | **Gap 3-15min between doors WITH DM/Pitch logged (no transition)** |
| Amber | Presentation (no sale) | Transition → no close before next door |
| Green | Sale | Transition → Close/Sale |
| Orange dashed | Break | Explicit break periods |
| Gray | Gap | Gaps > 3min with NO DM/Pitch logged, or > 15min gaps |

---

## Transition Outcomes (What Happened in the Home)

When a transition is logged, track what followed:

| Outcome | Detection | Visual |
|---------|-----------|--------|
| **Sale** | Transition → Close | Green arc (full duration) |
| **Presentation** | Transition → Presentation (no close) | Amber arc |
| **Seen Out** | Transition → Next door (no presentation/close) | Short amber arc (2-8min) |

This lets leaders see when reps are getting inside but getting kicked out before they can present.

---

## Implementation

### Step 1: Add Doorstep Zone Calculation
**File: `src/utils/inHomeZoneCalculator.ts`**

New function `calculateDoorstepZones()`:

```typescript
interface DoorstepZone {
  startTime: Date;
  endTime: Date;
  duration: number;
  hasDM: boolean;
  hasPitch: boolean;
}

function calculateDoorstepZones(
  doorEvents: TimelineEvent[],
  dmEvents: TimelineEvent[],
  pitchEvents: TimelineEvent[],
  inHomeZones: InHomeZone[],
  breakPeriods: Array<{ start: string; end: string }>
): DoorstepZone[]
```

Logic:
1. Sort door events chronologically
2. For each consecutive door pair (A → B), calculate gap
3. If gap is 3-15 minutes:
   - Check if any DM or Pitch timestamp falls between A and B (or within 60s after B for batch-logged)
   - Check the gap isn't already covered by an in-home zone or break
   - If DM/Pitch exists → mark as doorstep zone
4. Duration = gap time (capped at reasonable max for walking between doors)

### Step 2: Update RingSegment Types
**File: `src/utils/inHomeZoneCalculator.ts`**

```typescript
type: 'knocking' | 'transition' | 'presentation' | 'sale' | 'break' | 'gap' | 'doorstep' | 'seen_out';
```

### Step 3: Detect "Seen Out" in In-Home Calculation
**File: `src/utils/inHomeZoneCalculator.ts`**

In `calculateInHomeZones()`:
- After finding a transition, check if next event is:
  - Another door knock → "Seen Out" (kicked out quickly)
  - Presentation → "Presentation" 
  - Close → "Sale"

### Step 4: Update `buildRingSegments()`
**File: `src/utils/inHomeZoneCalculator.ts`**

Add doorstep zones with priority 1.5:
```typescript
doorstepZones.forEach(zone => {
  intervals.push({
    start: timeToAngle(zone.startTime, workStart, workEnd),
    end: timeToAngle(zone.endTime, workStart, workEnd),
    type: 'doorstep',
    priority: 1.5,  // Above knocking, below in-home
    duration: zone.duration,
  });
});
```

### Step 5: Update Ring Colors & Labels
**File: `src/components/activity-ring/ActivityRingHero.tsx`**

```typescript
const RING_COLORS = {
  // ... existing
  doorstep: 'hsl(180, 60%, 50%)',  // Cyan/teal
  seen_out: 'hsl(45, 90%, 55%)',   // Amber (short arc)
};

const SEGMENT_LABELS = {
  // ... existing
  doorstep: 'Doorstep Talk',
  seen_out: 'Seen Out',
};
```

Add Layer 1.5 for doorstep segments between base layer and presentation layer.

### Step 6: Update Activity Breakdown Stats
**File: `src/components/activity-ring/ActivityRingHero.tsx`**

Update the bottom stats to show three categories:
- **Presenting**: X% (Xm) - time in homes (sales + presentations + seen out)
- **Doorstep**: X% (Xm) - talking at doors (cyan segments)
- **Gap**: X% (Xm) - true idle time (no activity logged)

### Step 7: Update Segment Detail Drawer
**File: `src/components/activity-ring/SegmentDetailDrawer.tsx`**

Add cases for doorstep and seen_out:

```typescript
{/* Doorstep conversation */}
{isDoorstep && (
  <div className="p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 space-y-2">
    <div className="flex items-center gap-2">
      <Users className="w-4 h-4 text-cyan-500" />
      <span className="font-medium text-cyan-600">Doorstep Conversation</span>
    </div>
    <p className="text-xs text-muted-foreground">
      Rep talked to someone but didn't transition inside.
      {hasPitch && " A pitch was attempted."}
    </p>
  </div>
)}

{/* Seen out */}
{isSeenOut && (
  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
    <div className="flex items-center gap-2">
      <DoorOpen className="w-4 h-4 text-amber-500" />
      <span className="font-medium text-amber-600">Seen Out</span>
    </div>
    <p className="text-xs text-muted-foreground">
      Got into the home but was asked to leave before presenting.
      Coach: Work on building rapport quickly after entering.
    </p>
  </div>
)}
```

### Step 8: Update Legend
**File: `src/components/activity-ring/ActivityRingLegend.tsx`**

```typescript
<LegendItem color="hsl(142, 76%, 45%)" label="Sale" />
<LegendItem color="hsl(45, 90%, 55%)" label="Presentation (no sale)" />
<LegendItem color="hsl(45, 90%, 55%)" label="Seen Out" thin />
<LegendItem color="hsl(180, 60%, 50%)" label="Doorstep Talk" />
<LegendItem color="hsl(210, 80%, 55%)" label="Knocking" />
<LegendItem color="hsl(0, 0%, 30%)" label="Gap (idle)" />
<LegendItem color="hsl(35, 90%, 50%)" label="Break" dashed />
```

---

## Edge Case Handling

### Batch-Logged DM/Pitch
If DM and Pitch are logged within 60s of each other (or of a transition), they're batch-logged. We still count the gap as "doorstep" because the **DM exists** - the duration comes from the door-to-door gap.

### Very Long Doorstep Gaps
If gap is > 15 min but has DM/Pitch and no transition:
- Cap doorstep duration at 10 min (reasonable max for a doorstep convo)
- Remainder becomes gap

### Transition Without Following Event
If transition is the last event of the day:
- Use default presentation duration (20 min)
- Mark as "presentation" (estimated)

---

## Coaching Story at a Glance

| Ring Pattern | What it Means | Coaching |
|--------------|---------------|----------|
| High blue, low cyan | Knocking fast, not stopping to talk | "Be pickier, engage more" |
| Balanced blue + cyan | Engaging at doors | Good door work! |
| High cyan, low amber | Talking but not getting inside | "Work on transition" |
| High amber (short), low green | Getting inside, kicked out | "Build rapport faster" |
| High amber (long), low green | Presenting, not closing | "Work on pitch/close" |
| High gray | True idle time | "Time management" |

---

## Files to Modify

1. **`src/utils/inHomeZoneCalculator.ts`**
   - Add `DoorstepZone` interface
   - Add `calculateDoorstepZones()` function
   - Add `'doorstep'` and `'seen_out'` to RingSegment type
   - Update `calculateInHomeZones()` for seen-out detection
   - Update `buildRingSegments()` to include doorstep zones

2. **`src/components/activity-ring/ActivityRingHero.tsx`**
   - Add doorstep/seen_out colors and labels
   - Add Layer 1.5 for doorstep rendering
   - Update gap/doorstep/presenting stats calculation

3. **`src/components/activity-ring/SegmentDetailDrawer.tsx`**
   - Add UI for doorstep and seen_out segment types
   - Add coaching messages

4. **`src/components/activity-ring/ActivityRingLegend.tsx`**
   - Add doorstep and seen_out to legend

---

## Example: Ansel vs Javier (Wednesday)

**Ansel** (94 doors, 28 DMs):
- Many short door-to-door gaps (1-2 min) → Blue knocking
- Some 5-8 min gaps WITH DMs logged → Cyan doorstep talk
- Few longer gaps without DMs → Gray true gaps

**Javier** (43 doors, 12 DMs):
- Longer gaps, but many have DMs → Some cyan doorstep talk
- 1h 20m gap with no activity → Gray true gap
- Sale time correctly shown → Green

Now leaders can see: "Ansel worked consistently. Javier had a real 1h gap but was talking to people when he was working."

