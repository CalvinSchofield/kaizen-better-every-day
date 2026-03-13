

## Problem

The Season view shows "13 of 28 work days" because it counts entries from the `planned_work_days` table — which only has entries from ~January onward (or whenever you started planning). It should show **all knocking days since Sep 28, 2025** (the actual season start).

The calculator already computes the correct numbers at lines 176-190:
- `seasonKnockingDaysComplete` — actual finalized knocking days since Sep 28
- `totalSeasonDays` — knocking days + future planned + today

But lines 327-332 only override `actual`, `live`, and `paceDiff` for the season — **not** `plannedDaysElapsed` and `plannedDaysTotal`.

## Fix

### `src/hooks/useGoalPaceCalculator.ts`

After line 332 (where season overrides already happen), add two more overrides:

```typescript
season.plannedDaysElapsed = seasonKnockingDaysComplete;
season.plannedDaysTotal = totalSeasonDays;
```

That's it — two lines. The correct counts are already calculated; they just aren't being passed through to the season timeframe data.

