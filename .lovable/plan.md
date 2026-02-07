

# Activity Ring Redesign: Clarity & Season-Aware Goals

## The Problem

### Current Ring Issues (Your Feedback)
1. **Not Clean or Informative**: The outer ring with multiple segment types is visually noisy
2. **Green is Misleading**: Green implies "super good" but it's being used for basic door activity
3. **See-through Colors**: Opacity/transparency adds complexity without value
4. **Missing Legend**: No way to understand what colors mean
5. **Missing Key Insight**: Can't clearly see when they're IN A HOME and for how long

### Goal Progress Issues
1. Currently showing summer goals even during preseason
2. Leaders need to see **preseason goal only** until that rep's personal summer date starts
3. After summer starts, show the focus tier goal (Must Do / Will Do / Could Do)

---

## The Solution: Simplified Ring with Focus on Sales Journey

### New Color Scheme (Clean & Meaningful)

| State | Color | Meaning |
|-------|-------|---------|
| **Gray** | `hsl(0, 0%, 25%)` | Not working / gaps |
| **Blue** | `hsl(210, 80%, 55%)` | Active knocking (doors) |
| **Amber/Gold** | `hsl(45, 90%, 55%)` | In a home (transition → close) |
| **Primary Green** | `var(--primary)` | SOLD! (matches goal color) |
| **Orange Dashed** | `hsl(35, 90%, 50%)` | Break time |

### Ring Structure

```text
Single Ring Design (Outer Only):

┌──────────────────────────────────────────┐
│                                          │
│           ┌────────────────┐             │
│          /   ██ ██ ░░ ██ ★  \            │
│         │                    │           │
│         │     3.7 FP+        │           │
│         │    $311 PRMR       │           │
│         │   7.3 hrs worked   │           │
│         │                    │           │
│          \  ██ ░░ ☕ ██ ★   /            │
│           └────────────────┘             │
│                                          │
│  Legend:                                 │
│  ██ Blue = Knocking                      │
│  ██ Amber = In Home                      │
│  ★ Green = Sale                          │
│  ░░ Gray = Gap                           │
│  ☕ Dashed = Break                        │
│                                          │
└──────────────────────────────────────────┘
```

### Key Visibility Improvements

1. **In-Home Duration**: Amber segments show the FULL duration from door knock → transition/presentation/close
   - Leaders can visually see "how long was this rep inside?"
   - Longer amber segments = more time presenting

2. **Sales Pop**: Green segments with glow effect mark sales
   - These stand out immediately as the "win" moments
   - Uses the same green as goal progress for consistency

3. **Gap Awareness**: Gray segments clearly show non-productive time
   - Already working - this stays the same

4. **Legend Below Ring**: Simple horizontal legend explaining colors

---

## Technical Changes

### 1. ActivityRingHero.tsx Updates

**Current Issues:**
- Uses 7 different segment types with opacity variations
- Inner goal ring adds complexity
- No legend

**Changes:**
- Reduce to 4 core segment types: `knocking`, `in-home`, `sale`, `gap`
- Remove inner goal ring (goal progress shown separately below)
- Add optional legend component
- Use solid colors (no opacity variations)
- Leverage existing "in-home zone" logic from `RepDayActivityFlow`

### 2. Ring Segment Logic

```typescript
// Simplified segment types
type SegmentType = 'knocking' | 'in-home' | 'sale' | 'break' | 'gap';

// New color mapping
const RING_COLORS = {
  knocking: 'hsl(210, 80%, 55%)',  // Blue - active work
  'in-home': 'hsl(45, 90%, 55%)', // Amber/Gold - presenting
  sale: 'hsl(142, 76%, 45%)',      // Green - matches goal/success
  break: 'hsl(35, 90%, 50%)',      // Orange dashed
  gap: 'hsl(0, 0%, 25%)',          // Dark gray
  background: 'hsl(0, 0%, 12%)',   // Ring background
};
```

### 3. In-Home Zone Detection (Reuse Existing Logic)

The `RepDayActivityFlow` already has sophisticated in-home detection:
- Tracks door knock → transition/presentation/close as a "zone"
- Handles batch-logged events intelligently
- Calculates duration spent in each home

We'll extract this logic into a shared utility:
```typescript
// New utility file
export function calculateInHomeZones(
  events: TimelineEvent[],
  workStart: Date,
  workEnd: Date
): InHomeZone[]
```

### 4. Season-Aware Goal Display

**New Hook: `useRepSeasonGoal`**

```typescript
interface SeasonGoalData {
  isPreseason: boolean;
  displayGoal: number;
  displayLabel: string; // "Preseason" | "Must Do" | "Will Do" | "Could Do"
  goalProgress: number; // Current FP toward that goal
  paceStatus: 'ahead' | 'on_pace' | 'behind';
}

function useRepSeasonGoal(userId: string): SeasonGoalData {
  // 1. Fetch rep's personal_summer_start from season_config
  // 2. If today < personal_summer_start → return preseasonGoal
  // 3. If today >= personal_summer_start → return focus tier goal
}
```

### 5. RingGoalProgress Updates

```typescript
// Props change
interface RingGoalProgressProps {
  // For reps during preseason
  preseasonMode?: boolean;
  preseasonFP?: number;
  preseasonGoal?: number;
  
  // For reps in summer
  summerMode?: boolean;
  seasonFP?: number;
  focusTierGoal?: number;
  focusTier?: 'mustDo' | 'willDo' | 'couldDo';
  
  // Pace
  dayOfSeason?: number;
  totalSeasonDays?: number;
}
```

### 6. RepDrillDownDrawer Goal Logic

```typescript
// In RepDrillDownDrawer.tsx
const { data: seasonConfig } = useQuery({
  queryKey: ['rep-season-config', userId],
  queryFn: async () => {
    const { data } = await supabase
      .from('season_config')
      .select('personal_summer_start')
      .eq('user_id', userId)
      .maybeSingle();
    return data;
  }
});

// Determine if this rep is in preseason
const today = format(new Date(), 'yyyy-MM-dd');
const isRepInPreseason = !seasonConfig?.personal_summer_start || 
  today < seasonConfig.personal_summer_start;

// Then pass to RingGoalProgress:
{isRepInPreseason ? (
  <RingGoalProgress
    preseasonMode
    preseasonFP={extendedData?.preseasonFP}
    preseasonGoal={extendedData?.goals?.preseasonGoal}
  />
) : (
  <RingGoalProgress
    summerMode
    seasonFP={extendedData?.totalSeasonFP}
    focusTierGoal={/* focus tier goal based on rep's focus_tier */}
    focusTier={extendedData?.goals?.focusTier}
  />
)}
```

---

## Legend Component

New component: `ActivityRingLegend.tsx`

```typescript
export const ActivityRingLegend = () => (
  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
    <LegendItem color="blue" label="Knocking" />
    <LegendItem color="amber" label="In Home" />
    <LegendItem color="green" label="Sale" />
    <LegendItem color="gray" label="Gap" />
    <LegendItem color="orange" dashed label="Break" />
  </div>
);
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/activity-ring/ActivityRingHero.tsx` | Complete redesign with simplified segments, new colors, removed inner ring |
| `src/components/activity-ring/RingGoalProgress.tsx` | Add preseason vs summer mode support |
| `src/components/activity-ring/ActivityRingLegend.tsx` | **NEW** - Legend component |
| `src/components/activity-ring/index.ts` | Export new legend |
| `src/components/reports/v2/RepDrillDownDrawer.tsx` | Add season config fetch, conditional goal display |
| `src/hooks/useRepDrillDownData.ts` | Add personal_summer_start to returned data |
| `src/utils/inHomeZoneCalculator.ts` | **NEW** - Shared in-home detection logic extracted from RepDayActivityFlow |

---

## Visual Before/After

**Before (Current):**
- Multiple ring layers (outer + inner goal)
- 7 segment types with varying opacity
- Green for door activity (misleading)
- No legend
- Complex, hard to interpret

**After (Redesigned):**
- Single clean ring
- 4 core segment types with solid colors
- Blue = knocking, Amber = in-home, Green = sale, Gray = gap
- Legend below ring
- Immediately clear: "Where did they spend time? Did they get in homes? Did they sell?"

---

## Goal Display: Season Logic Summary

| Rep's State | What Leaders See |
|-------------|------------------|
| Before personal_summer_start | Preseason goal + preseason FP progress |
| After personal_summer_start | Focus tier goal (Must/Will/Could) + season FP progress |

This applies in:
- `RingGoalProgress` component
- `RepGoalPaceCard` component  
- Any goal visualization in the leader drill-down

---

## Implementation Order

1. Create `src/utils/inHomeZoneCalculator.ts` - Extract zone logic
2. Create `src/components/activity-ring/ActivityRingLegend.tsx`
3. Update `ActivityRingHero.tsx` - New colors, single ring, use zone calculator
4. Update `RingGoalProgress.tsx` - Preseason vs summer mode
5. Update `useRepDrillDownData.ts` - Fetch personal_summer_start
6. Update `RepDrillDownDrawer.tsx` - Season-aware goal display
7. Test with various rep data (preseason reps, summer reps, reps with sales, reps with gaps)

