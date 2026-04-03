# Planning Feature UX Audit & Improvement Plan

## Current State Summary

The planning feature is a **modal toggle** — users tap "Plan" to enter planning mode, tap calendar days to mark work days, then tap "Done." While in planning mode, a large instruction card appears below the calendar explaining how it works, and a floating bar at the bottom shows the count.

## UX Issues a World-Class Mobile Developer Would Flag

### 1. Hidden affordance — users don't know "Plan" exists

The "Plan" pill button sits in the top-right corner, small and muted. Non-tech-savvy users will never discover it organically. The empty-state CTA helps, but once they dismiss it or plan one day, it disappears forever. 

### 2. Mode confusion — "Am I in planning mode or not?"

Tapping a day does completely different things depending on the mode (opens day detail vs. toggles planned). The only indicator is a subtle background gradient and the pill changing from "Plan" to "Planning." Users who accidentally enter planning mode will be confused when tapping a day doesn't open it.

### 3. The instruction card is too verbose

Three bullet points with icons (Pointer, Undo, Lock) explain mechanics that should be self-evident from the interaction itself. This card takes up significant scroll real estate and pushes content below the fold. A world-class app would make the interaction obvious enough that instructions aren't needed. Not to mention that the card to explain is below everything o some people may never see it. 

### 4. Too much crammed into planning mode

Planning mode currently bundles three separate concerns: (a) toggling work days, (b) joining blitz trips, and (c) setting summer dates. These are conceptually different tasks with different frequencies — summer dates are set once, blitzes are committed to occasionally, but day planning is ongoing. ******Correction -- day planning is ongoing during the preseason. Once the summer starts, you don't really "plan your days" much, but rather request off days.****** planning mode is really most used during the preseason. once summer start and end dates are set, then the rep might go in a couple times to change their plan and take off days rarely.

### 5. No visual feedback on the day cell itself during planning

When you tap a day in planning mode, the only change is a subtle `bg-accent/30` background. There's no checkmark, no animation, no satisfying micro-interaction. For non-tech-savvy users, it's unclear if their tap registered.

### 6. The floating bar is informational, not actionable

The bottom bar just says "X days planned" with a "Done" button. It doesn't help users understand if they've planned enough days or guide them toward completion.

---

## Recommended Changes

### A. Make planning mode entry unmistakable

- Replace the tiny "Plan" pill with a more prominent, always-visible entry point when no days are planned. ***********Yes this is good. If no days are planned and the user has access to the calendar, then we want to guide their setup. Liike if i just got the app, set my goals and as part of that my summer start and end dates, then im taken to the calendar page to plan and make it mandatory to use anything esle on the calendar page next*********
- When planning mode is active, add a **top banner** (not just a gradient) that clearly says "Tap days to plan" with a distinct color — like a toolbar stripe across the top of the calendar grid
- This replaces the verbose instruction card entirely

### B. Add satisfying tap feedback on day cells

- When a day is toggled ON in planning mode, show a brief checkmark animation (scale-in) on the cell. haptic feedback as well
- When toggled OFF, show a brief fade-out

### C. Simplify the planning card — remove instructions, keep actions

- Delete the 3-line instruction block (Pointer/Undo/Lock)
- Keep only: the "X days planned" counter, the Blitz Trips section, and the Summer Dates section
- Or better: move Blitz Trips and Summer Dates into a **separate settings/config area** (they're one-time setup, not daily planning)

### D. Make off day stings a little in the summer

- Show something like "X summer days planned off" based on their summer date range
- Add a subtle money amount of what that means if we have their daily rate and their pay level. Ex. if on average i sell 1.8 a day and im at a pay level where that means $1500 a day, then wehn i take off 8 days thats $12k. I want to show that subtly somewhere. Don't show this if we don't have any daily averages yet.

### E. Improve exit from planning mode

- Auto-exit planning mode if the user navigates away 
- The "Done" button should give a success haptic and a brief toast: "Plan saved" (even though it auto-saves, the confirmation matters psychologically)

### F. Better empty state that teaches by doing

- Instead of a text-heavy empty state card, show a single-line prompt above the calendar: **"Tap the days you'll work this season"** with an arrow pointing at the grid
- Remove the current multi-paragraph empty state card ******if its during the summer, lets have this say "tap the days you'll take off this summer". If its preseason, then keep the "tap the days you'll work" stuff

---

## Files to Modify


| File                              | Change                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/components/CalendarView.tsx` | Replace instruction card with inline banner, add tap animations to day cells, simplify floating bar, improve empty state |


## What stays the same

- The core tap-to-toggle mechanic — it's the right interaction pattern
- Auto-saving planned days — no explicit save needed for day toggles
- Sunday/past-date restrictions
- The blitz commit/uncommit confirmation drawers
- Summer date pickers (but potentially relocated)

## Scope

This is primarily a UI/UX polish pass on a single component. No database changes, no new hooks, no new pages. Estimated ~200 lines of diff in `CalendarView.tsx`.