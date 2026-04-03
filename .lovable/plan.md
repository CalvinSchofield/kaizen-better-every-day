

# Date-Aware Goal Context in Team Goals Tab

## Your Question First
No, this is not too much. The intent is exactly right: **"who needs coaching this week/month?"** The date filter should answer that by showing expected vs actual for the period. That's the coaching signal. It doesn't replace Reports — it just lets you spot who fell behind *recently* vs who's been behind all season.

## What Changes

### 1. Aggregate Card — Show Expected vs Actual for Period
When a period is selected (not YTD), calculate how much the team *should have produced* based on knocking days in that period multiplied by each rep's daily target.

Currently shows:
```
This Week: +12.5 FP+
```

Will show:
```
This Week: +12.5 / 18.0 expected FP+
```

The progress bar at the top will also shift to show period progress vs period expected when a date filter is active, instead of always showing season progress.

### 2. Rep Expanded View — Period Goal Context
When a rep is expanded and a period filter is active, show period-specific expected vs actual in the metrics grid:

- **Period column**: `+3.2 / 5.1 expected` (based on their knocking days in that period x their daily pace target)
- **Period status indicator**: If they produced less than expected for that period, show an amber/red accent. If more, show green.

This replaces the current static "Progress / Variance / Need per Day" grid with period-aware numbers when a date filter is active. When on YTD, it stays exactly as-is.

### 3. Period Pace Status on Rep Rows
When a period is selected, the status pill on each rep row will reflect **period performance** instead of season-long status:
- Rep hit their daily target during this period → show as "On Pace" (blue)  
- Rep exceeded daily target → "Strong" (green)
- Rep missed daily target → "Missed" (amber)
- Rep who already met their season goal → stays "Goal Met" (green)

When back on YTD, everything reverts to the current season-long pace status.

## Technical Approach

### File: `src/components/mygroup/GoalsTabView.tsx`

1. **Add `periodExpected` to `RepGoalInfo`** — calculated as `periodKnockingDays × dailyTarget` for each rep when a period filter is active.

2. **Add `periodPaceStatus`** — derived from comparing `periodProgress` vs `periodExpected`. Only computed when `isPeriodFiltered` is true.

3. **Update aggregate card** — when `isPeriodFiltered`, show `aggregate.periodProgress / aggregate.periodExpected` and set the progress bar to `periodProgress / periodExpected` percentage.

4. **Update rep row display** — when `isPeriodFiltered`, use `periodPaceStatus` for the status pill color/label instead of the season-long `paceStatus`.

5. **Update expanded details** — when `isPeriodFiltered`, swap the metrics grid to show period expected, period actual, and period variance instead of season-long numbers.

No new files, no new hooks. All changes in `GoalsTabView.tsx` only.

## What Stays Simple
- No new drawers or pages
- No recalculation of the full pace algorithm for sub-periods — just `knockingDays × dailyTarget` for the period
- Season-long status is always the default (YTD)
- The tab stays focused: goals, pace, who needs coaching

