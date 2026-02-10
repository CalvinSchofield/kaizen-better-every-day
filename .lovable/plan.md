
# "What If" Scenario Planner

## What We're Building
The "EFP/day needed" stat card in Calendar Planning will become an interactive tap target that opens a scenario planning drawer. This lets you play with different "what if" situations -- like "What if I start summer with 8 preseason deals?" -- and instantly see how that changes your required daily pace for the summer.

## User Experience

1. **Make the stat card obviously tappable**
   - The "3.2 EFP/day needed" card gets a subtle shimmer/pulse, a small "tap to explore" hint, and a chevron icon to signal interactivity
   - Tapping it opens the What If drawer

2. **What If Scenario Drawer**
   - Clean, focused drawer with a clear title like "Plan Your Summer Pace"
   - An input field: "What if I start summer with ___?" (pre-filled with current forecasted preseason total)
   - As you adjust the number, the drawer instantly recalculates and shows:
     - **Per day** needed across your planned summer days
     - **Per week** needed (assuming 6 day weeks based on planned days)
   - Show 2-3 quick-tap preset scenarios below the input for fast exploration:
     - "Current pace" (your forecasted total based on current daily avg)
     - "+5 more" (forecast + 5)
     - "+10 more" (forecast + 10)
   - Each preset instantly updates the results
   - Results update live as you type/adjust, with smooth number animations

3. **Visual Results**
   - For each of your three summer tiers (Must Do / Will Do / Could Do), show the daily pace needed given the hypothetical preseason total
   - Color-coded: green if pace looks achievable, amber if tight, red if aggressive
   - A small motivational line contextualizing the number (e.g., "That's about 1 deal every 3 days")

## Technical Details

### New file: `src/components/goals/WhatIfScenarioDrawer.tsx`
- Accepts props: `goals`, `currentProgress`, `knockingDays`, `plannedDays`, `efpModeEnabled`, `calculateEfp`
- Uses the same split-forecast math already in CalendarPlanningPreview but with a user-adjustable "hypothetical preseason total" input
- Calculation: For each tier, `remainingForSummer = tierGoal - hypotheticalPreseasonTotal`, then `dailyNeeded = remainingForSummer / plannedSummerDays`
- Weekly estimate = `dailyNeeded * (planned summer days / planned summer weeks)`
- Uses `Drawer` component (mobile-native pattern per project standards)
- Smooth `framer-motion` animations on result number changes
- Haptic feedback on open and preset taps

### Edit: `src/components/goals/CalendarPlanningPreview.tsx`
- Make the third stat card (EFP/day needed) visually tappable:
  - Add `cursor-pointer`, `active:scale-95`, ring/border highlight
  - Add a small sparkle or calculator icon
  - Wire `onClick` to open the WhatIfScenarioDrawer
- Pass required data down to the drawer

### Edit: `src/pages/Goals.tsx`
- No changes needed here -- the drawer state will be managed inside CalendarPlanningPreview

### Key UX Details
- Input uses the correct unit label (EFP or FP+ based on user's mode)
- Cancel rate buffer is applied to tier goals (same as existing logic)
- Preseason goal is excluded from the scenario tiers (only summer tiers shown since the point is planning summer)
- Numbers animate smoothly between scenarios using framer-motion's `AnimatePresence`
