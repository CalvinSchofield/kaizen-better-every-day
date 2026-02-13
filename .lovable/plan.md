

# Add Summer Date Editing to Goals + Blitz Planning in Calendar

## 1. Add Summer Dates to the Quick Edit Goals Drawer

**File: `src/components/goals/QuickEditGoalsDrawer.tsx`**

Add a "Summer Dates" section below the goal tier inputs with two date pickers (start and end). This makes it immediately discoverable when tapping the sliders/edit icon on the Goals page.

- Add two date picker rows styled consistently with the tier cards (rounded-2xl border, icon + label + value)
- Tapping each row opens a Popover with the Calendar component
- On save, upsert to `season_config` and invoke `update-summer-dates` edge function
- Invalidate `season-config` queries so pace recalculates

New props needed:
```typescript
personalSummerStart?: string | null;
personalSummerEnd?: string | null;
repId?: string;
```

**File: `src/pages/Goals.tsx`**

Pass the new props (`seasonConfig.personal_summer_start`, `seasonConfig.personal_summer_end`, `repData?.id`) to `QuickEditGoalsDrawer`.

## 2. Show Blitzes in Calendar Planning Mode

**File: `src/components/CalendarView.tsx`**

When `planningMode` is true, add a blitz section inside the planning instruction card (or just below it):

- Import `useBlitzes` hook to get all future blitzes
- Use `repData.committed_blitzes` to identify committed vs available
- Display committed blitzes as green cards with "Leave" action
- Display uncommitted blitzes as outline cards with "Join" action
- On commit, update `reps.committed_blitzes` (same logic as Goals page `handleConfirmCommitToBlitz`), which triggers `usePlannedDaysSync` to auto-add those dates as planned work days
- Add confirm/uncommit drawers (mirroring the Goals page pattern)

Layout within the planning mode card:
```text
+----------------------------------+
| Plan Your Work Days              |
| - Tap to add, tap to remove      |
| - Sundays locked                 |
| - XX days planned                |
+----------------------------------+
| Blitz Trips                      |
| [Spring Blitz - Apr 14]  [Join]  |
| [Summer Blitz - Jun 2]  [Joined] |
+----------------------------------+
```

The blitz section only shows during preseason (before global summer start) since that is when blitz planning is relevant.

## Technical Details

### QuickEditGoalsDrawer Changes
- Import `Calendar`, `Popover`, `format`/`parseISO` from date-fns
- Add `summerStart`/`summerEnd` local state initialized from props
- Add `CalendarIcon` date picker rows after the tier cards
- In `handleSave`, additionally upsert `season_config` and invoke the edge function if dates changed
- Invalidate `season-config-for-goals-page`, `season-config`, `season-config-whatif` queries

### CalendarView Changes
- Import `useBlitzes` hook
- Add state for `confirmCommitBlitz` / `confirmUncommitBlitz`
- Add commit/uncommit handler functions (same pattern as Goals.tsx)
- Add blitz list UI inside the planning mode card
- Add confirm/leave drawers at the bottom of the component

### Files Changed
| File | Change |
|------|--------|
| `src/components/goals/QuickEditGoalsDrawer.tsx` | Add summer date pickers below goal tiers |
| `src/pages/Goals.tsx` | Pass summer date props to QuickEditGoalsDrawer |
| `src/components/CalendarView.tsx` | Add blitz list + commit actions in planning mode |

### No Database Changes
All required tables (`season_config`, `reps.committed_blitzes`, `planned_work_days`) and the `update-summer-dates` edge function already exist.
