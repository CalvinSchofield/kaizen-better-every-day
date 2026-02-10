

# Planning Mode Visual Overhaul

## Goal
Make planning mode feel like a distinct, prestigious experience -- visually separated from the normal calendar with a unique atmosphere, and replace the goals/insights cards with a helpful instruction card.

## Changes

### 1. Distinct Planning Mode Background and Atmosphere
When `planningMode` is true, the entire calendar page wrapper shifts to a different visual treatment:
- Background changes from `bg-background` to a subtle gradient or tinted background (e.g., `bg-gradient-to-b from-primary/5 to-background` -- a soft wash of the brand color)
- Calendar day tiles in planning mode get a slightly different styling -- tappable days show a subtle pulse/glow effect, planned days use a more prominent filled state
- The "Planning" toggle button stays highlighted as it is now
- Smooth crossfade transition between modes using framer-motion

### 2. Hide Goals Card and Summary Teaser in Planning Mode
Wrap `GoalProgressCard` and `CalendarSummaryTeaser` in a condition: only render when `!planningMode`. This clears the lower section for the instruction card.

### 3. New Planning Mode Instruction Card
When `planningMode` is true, show a clean, elegant card in place of the goals/insights section:
- Icon + heading: "Plan Your Work Days"
- Bullet-style instructions with small icons:
  - Tap a day to mark it as a work day
  - Tap again to remove it
  - Sundays and past dates cannot be planned
- Shows current count: "X days planned so far"
- Subtle, polished design -- rounded card, muted tones, no clutter

### 4. File Changes

**Edit: `src/components/CalendarView.tsx`**
- Wrap the outer `div` className in a `cn()` call that adds the planning mode background classes when active
- Add `AnimatePresence` / `motion.div` around the goal card section and the new instruction card for smooth transitions
- Conditionally render `GoalProgressCard` + `CalendarSummaryTeaser` only when `!planningMode`
- Conditionally render the new inline planning instruction card when `planningMode` is true
- The instruction card is simple JSX inline in this file (no new component needed -- it's ~20 lines of markup)

### Technical Details

Background transition approach:
```
cn(
  "min-h-screen p-4 pb-24 transition-colors duration-300",
  planningMode
    ? "bg-gradient-to-b from-primary/8 via-primary/3 to-background"
    : "bg-background"
)
```

Planning instruction card (replaces goals section):
```
- CalendarDays icon
- "Plan Your Work Days" heading
- 3 short instruction lines with icons (tap to add, tap to remove, Sundays locked)
- Planned days count pulled from existing `plannedDays?.length`
```

Legend row stays visible in both modes (it's useful context for planning too).

