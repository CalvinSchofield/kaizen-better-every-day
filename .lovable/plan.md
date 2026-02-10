

# Calendar Planning Redesign: Preview Header + Move Planning to /calendar

## Overview

Two changes:
1. **Make the Calendar Planning section on /goals exciting and interactive** -- just like Earnings shows a big "$58,185" hero number that invites tapping, Calendar Planning will show a compelling preview (e.g., "42 days planned | 0.8/day needed") with a visual mini-calendar strip, encouraging interaction.
2. **Move the full day-planning functionality to /calendar** and simplify /goals to only show a read-only summary with a "Plan Days" CTA that navigates to /calendar.

This aligns each page's purpose:
- **/goals** = Progress dashboard (goals progress, earnings, unfunded stats) with teaser previews
- **/calendar** = The action hub for viewing results AND planning days

---

## Part 1: Calendar Planning Preview on /goals (Like Earnings)

Replace the current plain "Calendar Planning" collapsible with a rich, Earnings-style card:

**Preview (collapsed) state shows:**
- Icon + "Calendar Planning" header with chevron (matches Earnings style)
- Hero stat: **"X days planned"** in a large, eye-catching gradient style (earthy orange)
- Subtitle: "Need Y.Y [EFP/FP+]/day to hit your goal"
- Small context chip: "Z days done so far"

**Expanded state shows:**
- Summary stats row (Days Planned | Days Worked | Daily Pace Needed)
- A compact mini-month calendar strip showing planned/worked day dots (read-only, visual only)
- A prominent "Plan Days on Calendar" button that navigates to /calendar (replaces in-place planning)

This mirrors how Earnings works: preview shows the exciting number, expand reveals details, but the actual day-toggling action happens on /calendar.

---

## Part 2: Enable Day Planning on /calendar Page

The /calendar page's `CalendarView` already displays planned days visually. We need to make day cells tappable to toggle planned days (the same functionality currently in `CalendarPlanningCard`).

**Changes:**
- Add a "Planning Mode" toggle pill/button to the CalendarView header area (e.g., a small "Plan" chip)
- When planning mode is active, tapping future day cells toggles them as planned/unplanned (using the existing `usePlannedDays.togglePlannedDay`)
- Reuse all existing logic from `CalendarPlanningCard`: blitz auto-commit prompts, worked-day removal confirmations, summer boundary warnings, off-day exclusions
- Show a small floating summary bar at bottom: "X days planned this month | Y total season"
- Planning mode uses the same haptic feedback (hapticLight on toggle) and optimistic updates

---

## Technical Plan

### New File: `src/components/goals/CalendarPlanningPreview.tsx`
- A new Earnings-style card component replacing the current Calendar Planning collapsible
- Uses `usePlannedDays`, `useRepGoals`, worked days data to compute summary stats
- Collapsed: shows hero stat + pace context
- Expanded: shows summary row, mini calendar dots, and "Plan Days" CTA button
- CTA uses `useNavigate('/calendar')` to send user to the calendar page

### Modified: `src/pages/Goals.tsx`
- Replace `CalendarPlanningCard` import with `CalendarPlanningPreview`
- Remove the existing Collapsible wrapper (the new component handles its own expand/collapse like `EarningsBreakdownCard`)
- Remove props that were only needed for in-place planning (the preview is self-contained)

### Modified: `src/components/CalendarView.tsx`
- Add `planningMode` state toggle
- Add a "Plan" mode pill in the header area
- When active, future day cells become tappable to toggle planned days
- Import and wire `togglePlannedDay` from `usePlannedDays` (already imported)
- Add floating summary bar showing planned day count
- Reuse blitz-commit prompt logic and worked-day removal confirmation from `CalendarPlanningCard`

### No database changes needed
All data (planned_days table, rep_goals) already exists. This is purely a UI restructuring.

### Files untouched
- `CalendarPlanningCard.tsx` -- kept for now as reference; can be deprecated later once the new flow is stable
- All hooks remain unchanged

---

## UX Details

- The preview card animation matches Earnings: `motion.div` with spring transitions on the hero number
- EFP vs FP+ labels are dynamic throughout (same as current)
- Press states use `active:scale-[0.97]` for the native iOS feel
- Planning mode on /calendar uses the same hapticLight feedback on day toggles
- Mini calendar dots in the preview use earthy amber for planned days, green for worked days

