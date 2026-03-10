

## The Problem: Two Different Numbers Measuring Two Different Things

**"162 days planned"** on the Goals page = ALL planned days across the entire season (preseason + summer). This is just `plannedDays.length`.

**"136 days"** in the What-If drawer = only the planned days that fall ON or AFTER the summer start date. It filters `plannedDays` to only count summer-range dates.

So 162 - 136 = 26 preseason planned days. Neither is "lying" — they're counting different date ranges. But the What-If drawer IS correctly pulling from the actual `planned_days` table (which already excludes off days you've removed). If you've marked off days in the calendar, those should already be removed from `planned_days` and thus not counted in the 136.

**However**, there's a subtle issue: the What-If drawer does NOT cross-check against `excluded_summer_days` from `season_config`. It only counts what's in the `planned_days` table. If the sync between excluded days and planned days got out of sync at any point, the 136 could be wrong.

## Plan

### 1. Fix the "162 days planned" badge to show context-appropriate counts
In `CalendarPlanningPreview.tsx`, the badge at line 227 shows `stats.totalPlanned` which is ALL planned days. When viewing a summer tier (Must/Will/Could), it should show only summer planned days. When viewing Preseason, show only preseason planned days. This prevents confusion.

### 2. Make What-If drawer authoritative by cross-referencing excluded days
In `WhatIfScenarioDrawer.tsx` (lines 136-143), after counting planned summer days, also subtract any `excludedSummerDays` that might still exist in the `planned_days` table due to sync issues. This makes the number defensive:

```typescript
const currentPlanned = plannedDays?.filter(d => {
  const date = parseISO(d.planned_date);
  if (isSummerStarted) {
    return !isBefore(date, today) && !isBefore(date, summerStart) && !excludedSummerDays.includes(d.planned_date);
  }
  return !isBefore(date, summerStart) && !excludedSummerDays.includes(d.planned_date);
}).length || 0;
```

### 3. Update the CalendarPlanningPreview stats to split counts
In `CalendarPlanningPreview.tsx` around line 96, split `totalPlanned` into `preseasonPlanned` and `summerPlanned`, then display the relevant one based on `activeTier`:

- Preseason tab: "X preseason days planned · Y worked"
- Must/Will/Could tabs: "X summer days planned · Y worked"

This way the number on the Goals page will match What-If when looking at summer tiers.

### Files to modify
- `src/components/goals/CalendarPlanningPreview.tsx` — split planned day counts by season, display contextually
- `src/components/goals/WhatIfScenarioDrawer.tsx` — add defensive `excludedSummerDays` filter to planned day count

