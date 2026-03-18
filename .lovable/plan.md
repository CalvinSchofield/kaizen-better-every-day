

# Goal Pace Redesign for Reports Dashboard

## Current Problems

1. **Only shows one goal per rep** (their focus tier) -- you want to see all 4 tiers (preseason, must, will, could)
2. **No timeframe context** -- no Day/Week/Month/Season toggle like the personal goals page has
3. **Doesn't show reps without goals** prominently -- they're buried
4. **Doesn't flag reps who need to plan more days** or adjust goals
5. **Visually flat** -- list of cards with progress bars, no storytelling

## Redesigned Goal Pace Section

### Replace the compact button + drawer with an inline section + enhanced drawer

**Inline Section (on main page):**
- A visually rich card replacing the current one-line button
- 4 status buckets as tappable colored tiles: On Pace (green), At Risk (amber), Behind (red), No Goals (gray), plus a new "Needs Planning" (blue) bucket for reps whose planned days are exhausted
- Below: horizontal scroll of "urgent" rep cards (behind + needs planning) showing name, tier badge, progress ring, and daily needed vs avg
- Tap the section header to open the full drawer

**Enhanced Goal Pace Drawer:**

1. **Timeframe toggle** (D / W / M / Season) at the top -- reuses the same `GoalTimeframe` pattern from the personal goals page. Calculates expected progress for each rep within that timeframe using the same `calculateSalesPace` logic already in the data hook

2. **Multi-tier rep cards** -- Each rep card shows ALL their configured goals as mini progress bars stacked:
   - Preseason goal (blue) -- progress bar + %
   - Must Do (green) -- progress bar + %
   - Will Do (amber) -- progress bar + %
   - Could Do (purple) -- progress bar + %
   - Only shows tiers they've actually set goals for
   - The focus tier is highlighted/primary, others are secondary

3. **"No Goals" section** -- Dedicated section with rep names + a "Send Reminder" action (opens SMS)

4. **"Needs Planning" section** -- Reps whose future planned days count is 0 or very low relative to remaining season. Shows "X days planned, Y days remaining in season" with a warning badge

5. **Sorting**: Behind-first by default, with filter chips to focus on a status

### Data Changes

Extend the `GoalPaceResult` interface to include:
- `allGoals`: `{ preseason?: { goal, progress, percent }, mustDo?: {...}, willDo?: {...}, couldDo?: {...} }` -- all configured tiers with YTD progress
- `futurePlannedDays`: number -- how many planned days remain
- `needsPlanning`: boolean -- true if future planned days < 5 and season has 30+ days left
- `dailyNeeded`: number -- catch-up daily pace for focus tier
- `userDailyAvg`: number -- their historical daily average

The `useReportsV2Data` hook already fetches `allPlannedDays`, `ytdEntries`, `seasonConfigs`, and all 4 goal tiers per rep. We just need to compute all tiers instead of only the focus tier, and add the planned-days-remaining count.

### New/Modified Files

1. **`src/components/reports/v2/GoalPaceSection.tsx`** (new) -- inline section on main page with status tiles + urgent rep scroll
2. **`src/components/reports/v2/GoalPaceDrawer.tsx`** (rewrite) -- full drawer with timeframe toggle, multi-tier cards, no-goals section, needs-planning section
3. **`src/hooks/useReportsV2Data.ts`** -- extend goal pace computation to produce all-tier data + planned days remaining per rep
4. **`src/pages/ReportsV2.tsx`** -- replace the compact button with `GoalPaceSection`

### Visual Design
- Multi-tier progress uses thin stacked bars with tier-colored accents (matching `GOAL_TIER_CONFIG` colors)
- Focus tier gets a filled bar, other tiers get outline/subtle bars
- "Needs Planning" cards have a pulsing blue border
- Large numbers for daily needed vs daily avg comparison
- Tap any rep to drill down to their full profile

