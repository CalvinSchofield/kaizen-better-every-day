## Plan: Add "Expected By Now" Marker to Goal Hero Ring

### The Idea

Add a small tick/notch on the ring showing where progress *should* be based on elapsed planned days vs total planned days — the same concept as the dashed expected marker on the progress bars elsewhere.

### Edge Cases You Raised (and how to handle them)

Both scenarios you described share one problem: **the user has significant progress that wasn't tracked day-by-day in the app.** The expected marker uses `plannedDaysElapsed / totalPlannedDays` to determine where you "should" be. If you bulk-synced 50 EFP but only have 12 tracked knocking days, the marker would sit very low while your progress bar is high — making it look like you're wildly ahead when really you just imported data.

**Solution: Only show the marker when** `seasonKnockingDaysComplete >= 12` (i.e., at least 12 actual tracked knocking days exist). This hides it for:

- New users who just synced Vivint numbers
- Users with bulk-imported preseason data and no app-tracked history
- Anyone where the ratio would be meaningless

Once they have enough tracked days, the marker becomes meaningful.

### Implementation

**1. GoalHeroRing.tsx** — Add two new props and render a tick mark:

- `expectedPercent?: number` — where the marker sits on the ring (0-100)
- `showExpectedMarker?: boolean` — controls visibility (false when data is insufficient)
- Render as a small white/muted line segment on the ring arc at the calculated angle, with a subtle label

**2. Goals.tsx** — Wire up the data:

- Calculate `expectedPercent` from `unifiedPaceData.season`: `(season.plannedDaysElapsed / season.plannedDaysTotal) * 100`
- Set `showExpectedMarker` to `true` only when `knockingDaysCompleted >= 5`

### Ring Marker Design

- A small perpendicular tick mark (like a notch) on the ring track at the expected angle
- Rendered as a short line using SVG `transform: rotate()` 
- Muted color (semi-transparent foreground) so it doesn't compete with the progress arcs
- Subtle "Expected" micro-label nearby only if there's room

### Files to Edit

- `src/components/goals/GoalHeroRing.tsx` — new props + SVG tick rendering
- `src/pages/Goals.tsx` — calculate and pass the new props