

## Track Page Finalized View — What Needs Updating

### Current State Comparison

The **Track finalized view** (lines 240-518 in `Track.tsx`) and the **redesigned RepDrillDownDrawer** share many of the same components but the Track page is now behind in terms of design language. Here's the gap:

| Feature | RepDrillDownDrawer (new) | Track Finalized View (current) | Gap |
|---|---|---|---|
| **Stats display** | `FinalizedStatsGrid` — clean 4+3 grid | Inline stat ribbon with expandable funnel breakdown | Different pattern |
| **Goal progress** | `UnifiedGoalProgress` compact (D/Y) | `GoalResultCard` (already wraps UnifiedGoalProgress) | Already aligned ✅ |
| **Historical comparison** | `RepPeriodKpis` with sparklines + deltas | `MeVsMeCard` — table-based this year vs last year | Different, but MeVsMeCard is self-comparison which is appropriate for the rep's own view |
| **Timing viz** | `RepTimingChart` — Gantt bars for period | None — just start/end in `FinalizedDayHeader` | Missing on Track page |
| **Activity viz** | Ring/Timeline toggle | Ring/Timeline toggle | Already aligned ✅ |
| **Coaching** | Removed from drawer | `CoachingCard` — contextual tips | Keep — appropriate for self-view |
| **Header** | ProfileAvatar + badges | `FinalizedDayHeader` with check icon | Different but appropriate |

### Recommended Changes

The Track finalized view is the rep's **own** end-of-day recap. It should stay personal (coaching, competitions, streak) but adopt the cleaner stats layout from the drawer redesign:

**1. Replace inline stat ribbon with `FinalizedStatsGrid`**
The expandable funnel view (lines 314-410) is functional but cluttered. Replace with the same `FinalizedStatsGrid` component already used in the drawer — it's cleaner, clickable for sales log, and consistent.

**2. No other changes needed**
- `GoalResultCard` already uses `UnifiedGoalProgress` — already consistent
- `MeVsMeCard` is self-comparison (this year vs last year) which is unique to the rep's own view — keep it
- `CoachingCard` provides actionable tips for tomorrow — keep it (intentionally removed from the leader's drill-down but appropriate for self-view)
- `StreakOutcomeCard`, `CompetitionsCard`, `PendingInstallAlertCard` — all personal context, keep them
- `RepTimingChart` and `RepPeriodKpis` don't make sense for a single-day self-view
- `FinalizedDayHeader` is appropriate — it shows "Day Complete" status which is correct for the rep's own track page

### Files to Modify

| File | Change |
|---|---|
| `src/pages/Track.tsx` | Replace inline stat ribbon (lines 314-410) with `FinalizedStatsGrid` component. Import and wire up sales log click handlers. |

### Technical Details
- Import `FinalizedStatsGrid` from `@/components/activity-ring`
- Pass `entry`, `salesLog`, and wire `onClosesClick`/`onFPClick`/`onPRMRClick` to open the existing `SalesLogDrawer`
- Remove ~95 lines of inline stat ribbon code, replace with ~12 lines

