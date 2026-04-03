

# Team Goals Tab Overhaul

## Overview

Redesign the Goals tab to be a filterable, date-aware coaching dashboard with compact scannable rows, profile photos, tap-to-expand details, and a goal tier selector for the aggregate summary — matching the Reports V2 UX patterns.

## Key Features

### 1. Unified Filter + Date Presets (Reports V2 style)
- Add `UnifiedFilterDrawer` for hierarchy/year/watchlist filtering (same as Summer Availability tab)
- Add the same date preset pill row from Reports V2: Live, Yesterday, This Week, Last Week, This Month, Last Month, Preseason, YTD + Custom
- Reuse `useAvailableTeamReportsPresets` for smart preset availability
- Reuse `CustomDateRangeDrawer` for custom date range selection
- Date range filters entries to show "how did reps do on their goals **during that period**" — FP+ earned in range, doors knocked in range, etc.

### 2. Aggregate Team Summary with Goal Tier Selector
- Top card shows: total filtered reps, sum of FP+ earned (in selected period), sum of goals across all filtered reps
- **Goal tier toggle** (Must Do / Will Do / Could Do) — changes which goal column is summed for the aggregate and used for individual pace calculations
- Progress bar showing team aggregate progress against selected tier
- Status breakdown chips (Ahead / On Track / Behind / At Risk counts)

### 3. Compact Rep Rows with Profile Photos
- Slim row design with status-colored left border accent (emerald/blue/amber/red)
- Profile photo via `Avatar`/`AvatarFallback` (add `profile_photo_url` to query)
- Inline: name, year badge, mini progress bar, status pill, key stats (daily pace, variance)
- Sorted: At Risk → Behind → On Track → Ahead → No Goals

### 4. Tap-to-Expand Accordion Details
- Tapping a row expands it inline (one at a time)
- Expanded view shows:
  - Goal tiers (Must/Will/Could) with active tier highlighted
  - Variance from expected pace (+2.3 FP ahead / -4.1 behind)
  - Period performance: FP+ earned in selected date range, doors knocked, knocking days
  - Summer date range
  - Action buttons: "View Profile" (onRepClick), "Edit Dates"
  - For no-goals reps: "Nudge to Set Goals" button

### 5. "No Goals" Section
- Separated to bottom in collapsible section with count badge
- Each rep shows photo + name + nudge button

## Technical Approach

- **Date filtering**: When a date preset or custom range is selected, filter `entriesData` to only include entries within that range before computing FP+, knocking days, and pace. The goal targets remain the full-season values — only progress is scoped to the period.
- **Goal tier selector**: `useState<'mustDo' | 'willDo' | 'couldDo'>('willDo')` at the top level. Pass to aggregate sum calculation and individual `getActiveGoal` function. Overrides individual rep `focusTier` when viewing team-level.
- **Reuse existing hooks**: `useAvailableTeamReportsPresets(filteredUserIds)` for smart preset pills, `CustomDateRangeDrawer` for custom range.
- **Profile photos**: Add `profile_photo_url` to the reps query select. Use `Avatar`/`AvatarImage`/`AvatarFallback`.

## Files to Modify

| File | Change |
|---|---|
| `src/components/mygroup/GoalsTabView.tsx` | Full redesign: unified filter, date presets, goal tier selector, compact rows with photos, accordion expand, no-goals section |

No database changes required. All components and hooks already exist.

