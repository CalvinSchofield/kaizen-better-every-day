## Redesign RepGoalSnapshot — Clear, Simple, Beautiful

### The Problem

The current component is overcomplicated. Too many visual elements (segmented bar, legend, period insight card, delta pills) make it hard to instantly digest. The core question a leader asks is simple: **"Did they do what they needed to do, and where does that leave them?"**

### The Vision — Two Clean Sections

**Section 1: Season Standing (YTD)**

- Big number: `23.2 / 30 EFP` with tier badge and On Pace / At Risk / Behind pill
- Single clean progress bar showing total progress toward goal, with a thin vertical marker at "where you should be right now" (YTD expected based on season elapsed days) *****based on planned days?
- One line below: `77% complete · Should be at 68%` (or whatever the YTD expected % is) ******take this out. Keep it more simple

**Section 2: Period Verdict (the selected date range)**

- A compact, color-coded card that answers: "During [Last Month], they worked X days. They needed Y. They sold Z."
- Layout:
  - Left: Period label + days worked count
  - Right: Simple fraction — `Sold 10 / Needed 8` — green if hit, amber if not
  - Below: A single delta line — `+2.0 ahead of pace` or `3.7 short`
- Color: green border/bg tint if hit, amber if not. No bar, no legend, no stacked segments.

**Section 3: No Goals Edge Case**

- When `hasGoals` is false, instead of hiding the section entirely, show a soft card: "No goals set up yet" with a "Nudge to Set Goals" button that triggers an SMS or push to the rep.

### Technical Changes

**File: `src/components/reports/v2/RepGoalSnapshot.tsx**` — Full rewrite

- Remove the segmented prior/period bar, legend, and expected marker
- Replace with a single YTD progress bar + expected marker line
- Simplify period insight to a compact 2-line card
- Use `season.plannedDaysElapsed` and `season.plannedDaysTotal` from GoalPaceData to show YTD expected position on the bar

**File: `src/components/reports/v2/RepDrillDownDrawer.tsx**`

- Show the goal section even when `!hasGoals` — render a "No goals" nudge card instead
- Pass `onSendSms` or a nudge callback so the leader can prompt the rep

### Calculation Logic (unchanged)

- `periodExpected = (activeGoal / season.plannedDaysTotal) * periodDaysWorked` — actual days worked, not estimates
- YTD expected = `(activeGoal / season.plannedDaysTotal) * season.plannedDaysElapsed` — already available in GoalPaceData
- Period delta = `periodFp - periodExpected`