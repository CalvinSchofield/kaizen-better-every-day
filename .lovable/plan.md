

# Activity Ring: Post-Finalization Track View

## Updated Vision

The Track page has two distinct states:

**Active State (is_finalized = false):**
- Current behavior: TimeTrackingBar + QTallyGrid counters
- Reps actively tap to log activity

**Finalized State (is_finalized = true):**
- **NEW**: Replace QTallyGrid with Activity Ring Hero
- Beautiful visualization of completed day
- Stats summary below the ring
- Goal progress context
- Celebratory feel - "You did this today!"

```text
┌─────────────────────────────────────────────────────────────────┐
│  Track Page - FINALIZED STATE                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ✓ Day Complete                              1:21 → 8:37 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│               ┌────────────────────┐                            │
│              /  ▅  ▃  ☕ ▅  ▇  ★  \    ← Timeline Ring         │
│             │  ╭──────────────────╮ │                           │
│             │ │     3.7 FP+       │ │                           │
│             │ │    $311 PRMR      │ │   ← Center Stats         │
│             │ │   7.3 hrs worked  │ │                           │
│             │  ╰──────────────────╯ │                           │
│              \  ░░░░░░░░░░░▓▓▓▓▓  /    ← Goal Progress Ring    │
│               └────────────────────┘                            │
│                                                                  │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┐                    │
│  │  49  │   6  │   3  │   2  │   1  │ $311 │                    │
│  │Doors │Pitch │Trans │ Pres │Close │ PRMR │                    │
│  └──────┴──────┴──────┴──────┴──────┴──────┘                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  🎯 Goal Progress                                         │   │
│  │  Today: 3.7 / 2.1 FP+  ✅ Hit daily goal!                 │   │
│  │  This Week: 12.4 / 14.0 FP+                               │   │
│  │  ░░░░░░░░░░▓▓▓▓░░░░░░░░░░░░░░░░░░░░  47.2 / 200 Season   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Track Page Logic Update

```typescript
// In Track.tsx
if (entry.is_finalized) {
  return (
    <div className="flex flex-col h-full">
      {/* Static header showing day is complete */}
      <FinalizedDayHeader 
        workStart={entry.work_start_time}
        workEnd={entry.work_end_time}
      />
      
      {/* Activity Ring Hero - replaces QTallyGrid */}
      <ActivityRingHero
        entry={entry}
        counterTimestamps={counterTimestamps}
        salesLog={salesLog}
      />
      
      {/* Stats summary grid */}
      <FinalizedStatsGrid entry={entry} />
      
      {/* Goal progress context */}
      <RingGoalProgress repId={entry.user_id} />
    </div>
  );
}

// Otherwise show normal active tracking UI
return (
  <div className="flex flex-col h-full">
    <TimeTrackingBar ... />
    <QTallyGrid ... />
  </div>
);
```

---

## Component Architecture

### New Components for Track Finalized State

| Component | Purpose |
|-----------|---------|
| `FinalizedDayHeader.tsx` | Shows "Day Complete ✓" with work hours |
| `ActivityRingHero.tsx` | Main ring visualization (shared with leader view) |
| `FinalizedStatsGrid.tsx` | Compact stat boxes (read-only, no tap actions) |
| `RingGoalProgress.tsx` | Goal context card (shared with leader view) |

### Shared Components (Track + Leader Drill-Down)

The following components will be built once and used in both contexts:
- `ActivityRingHero` - Main ring SVG
- `ActivityRingMini` - Calendar mini rings (leader only)
- `RingGoalProgress` - Goal section
- `CoachingCallouts` - Smart insights (leader only - reps don't need to coach themselves)

---

## Full Implementation Scope

### Part 1: Core Ring Components

**Files to Create:**

1. `src/components/activity-ring/ActivityRingHero.tsx`
   - SVG-based ring visualization
   - Outer ring: Timeline segments (doors, in-home, breaks, gaps, sales)
   - Inner ring: Goal progress fill
   - Center: Key stats (FP+, PRMR, hours)
   - Animated draw-in on mount

2. `src/components/activity-ring/ActivityRingMini.tsx`
   - Small ring for calendar cells
   - Fill based on activity level
   - Star overlay for sales
   - Used in calendar and week strip

3. `src/components/activity-ring/RingGoalProgress.tsx`
   - Goal progress card with context
   - Today / This Week / Season views
   - Progress bar with expected marker

4. `src/components/activity-ring/FinalizedDayHeader.tsx`
   - "Day Complete ✓" banner
   - Work hours display
   - Celebration animation on first view

5. `src/components/activity-ring/FinalizedStatsGrid.tsx`
   - Compact read-only stat boxes
   - Doors, Pitches, Transitions, Presentations, Closes, PRMR
   - No tap actions (purely display)

6. `src/components/activity-ring/index.ts`
   - Barrel exports

### Part 2: Leader-Specific Components

7. `src/components/activity-ring/WeekActivityStrip.tsx`
   - Horizontal week navigation
   - Mini-rings for each day
   - Day selection

8. `src/components/activity-ring/ActivityCalendarDrawer.tsx`
   - Full calendar view
   - Scrollable months
   - Mini-ring per day with sale indicators

9. `src/components/activity-ring/CoachingCallouts.tsx`
   - Smart callouts for leaders
   - Gap time, late starts, funnel issues

### Part 3: Data Hooks

10. `src/hooks/useRepActivityCalendar.ts`
    - Batch fetch for calendar grid
    - Returns: doors, fp, hasSale, hasWork per day

11. `src/hooks/useRepDayActivity.ts`
    - Detailed activity for specific date
    - Extends existing useRepDrillDownData with date param

12. `src/hooks/useCoachingInsights.ts`
    - Generate coaching callouts from day data

### Part 4: Page Modifications

13. `src/pages/Track.tsx`
    - Add finalized state check
    - Render ActivityRingHero instead of QTallyGrid when is_finalized
    - Include FinalizedDayHeader, FinalizedStatsGrid, RingGoalProgress

14. `src/components/reports/v2/RepDrillDownDrawer.tsx`
    - Complete redesign to ring-based layout
    - Week strip navigation
    - Calendar button for history
    - Coaching callouts

15. `src/hooks/useRepDrillDownData.ts`
    - Add selectedDate parameter
    - Support fetching any date, not just today

16. `src/pages/Insights.tsx`
    - Add "My Activity" section
    - Include calendar view for self-history

---

## Ring Visualization Technical Details

### Timeline Ring Algorithm

```typescript
interface TimelineSegment {
  startAngle: number;  // 0 = 12 o'clock
  endAngle: number;
  type: 'knocking' | 'in-home' | 'break' | 'gap' | 'sale';
  intensity: number;   // 0-1 for opacity/thickness
}

function buildTimelineRing(
  workStart: Date,
  workEnd: Date,
  events: TimelineEvent[],
  breaks: BreakPeriod[]
): TimelineSegment[] {
  const workDuration = differenceInMinutes(workEnd, workStart);
  const degreesPerMinute = 360 / workDuration;
  
  // Map each event to its angular position
  // Fill gaps between events
  // Overlay breaks as dashed segments
  // Highlight sales with gold glow
}
```

### SVG Ring Structure

```svg
<svg viewBox="0 0 200 200">
  <!-- Background track -->
  <circle cx="100" cy="100" r="80" stroke="#1a1a1a" fill="none" />
  
  <!-- Timeline segments (outer ring) -->
  <g class="timeline-ring">
    <path d="..." stroke="green" /> <!-- Knocking segment -->
    <path d="..." stroke="amber" stroke-dasharray="4 2" /> <!-- Break -->
    <path d="..." stroke="gold" filter="glow" /> <!-- Sale -->
  </g>
  
  <!-- Goal progress (inner ring) -->
  <circle cx="100" cy="100" r="60" 
          stroke="url(#goalGradient)" 
          stroke-dasharray="progressLength, remaining" />
  
  <!-- Center stats -->
  <text x="100" y="95" class="hero-stat">3.7 FP+</text>
  <text x="100" y="115" class="sub-stat">$311 PRMR</text>
</svg>
```

### Animation Sequence

1. **Mount**: Ring background fades in (0.2s)
2. **Draw**: Timeline ring draws clockwise from start (0.8s ease-out)
3. **Pop**: Individual segments pop in with slight scale (staggered 50ms)
4. **Glow**: Sale segments get gold glow animation (0.3s pulse)
5. **Fill**: Inner goal ring fills to current progress (0.5s)
6. **Stats**: Center text fades in (0.3s)
7. **Confetti**: If goal was hit, subtle confetti burst (optional)

---

## Data Flow Summary

```
Track.tsx (Finalized)
  └── checks entry.is_finalized
        └── TRUE: Renders finalized view
              ├── FinalizedDayHeader
              ├── ActivityRingHero
              │     ├── Uses entry data
              │     ├── Uses counterTimestamps for timeline
              │     └── Uses salesLog for sale markers
              ├── FinalizedStatsGrid
              └── RingGoalProgress
                    └── Fetches goal context via useFocusGoalProgress

RepDrillDownDrawer.tsx (Leader)
  └── calls useRepDrillDownData(repId, selectedDate)
        └── Returns activity for selected date
              ├── WeekActivityStrip (date navigation)
              ├── ActivityRingHero (same component)
              ├── CoachingCallouts
              ├── FinalizedStatsGrid
              └── RingGoalProgress

Insights.tsx (Rep Self-View)
  └── ActivityCalendarDrawer
        └── calls useRepActivityCalendar(userId)
              └── Tapping day opens detail view with ring
```

---

## Implementation Order

**Phase 1: Core Ring (Track Page)** ✅ COMPLETE
1. ✅ ActivityRingHero component with timeline visualization
2. ✅ FinalizedDayHeader component
3. ✅ FinalizedStatsGrid component
4. ✅ RingGoalProgress component
5. ✅ Update Track.tsx to show finalized state

**Phase 2: Leader View** ✅ COMPLETE
6. ✅ useRepDayActivity hook (date parameter support)
7. ✅ WeekActivityStrip component
8. ✅ Update RepDrillDownDrawer.tsx
9. ✅ CoachingCallouts component

**Phase 3: Calendar Navigation** ✅ COMPLETE
10. ✅ ActivityRingMini component
11. ✅ useRepActivityCalendar hook
12. ✅ ActivityCalendarDrawer component

**Phase 4: Rep Self-History** ✅ COMPLETE
13. ✅ Add activity section to Insights.tsx

---

## UX Highlights

- **Celebration over data dump**: Finalized state feels like an achievement
- **No dead UI**: Counter boxes replaced with meaningful visualization
- **Contextual goals**: Always see where today fits in the bigger picture
- **Seamless navigation**: Leaders can browse any day without leaving drawer
- **Self-awareness**: Reps can review their own patterns over time

