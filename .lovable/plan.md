

## Contextual Goal Progress in Rep Drill-Down

### Problem
The current Goal Progress shows "Today: 0 / 0 FP+" which is meaningless when viewing "Last Month" data. The timeframes (D/Y) are hardcoded and ignore the date context passed from Reports V2.

### World-Class Approach
Replace the generic `UnifiedGoalProgress` compact bar with a **period-aware goal snapshot** that answers two questions:
1. **"How did they do in this period vs pace?"** — Production during the selected range vs what goal pace demanded for those days
2. **"Where do they stand overall?"** — Season-to-date progress bar for general context

Layout:
```text
┌─────────────────────────────────┐
│ ◎ Goal Progress      ◉ Preseason│
│                                 │
│ Last Month        8.2 / 9.4 FP+ │
│ ━━━━━━━━━━━━━━━━━━░░░  87%     │
│                                 │
│ Season           62.7 / 75 FP+  │
│ ━━━━━━━━━━━━━━━━━━━━━░░░░  84% │
│                         ↘ -14.9 │
└─────────────────────────────────┘
```

The **period row** calculates: `dailyNeeded × plannedDaysInRange` = expected pace for that specific window. Compared against actual production in that range (already available from `useRepComparison` current totals).

The **season row** stays as-is from `useGoalPaceCalculatorForUser` — full season progress with pace indicator.

### Technical Plan

**File: `src/components/reports/v2/RepDrillDownDrawer.tsx`**
- Remove the `UnifiedGoalProgress` compact block (lines 360-368)
- Replace with a new `RepGoalSnapshot` component
- Pass: `downlineGoalPace`, `currentTotals.fp` (period FP+), `periodLabel`, `dateRangeStart`, `dateRangeEnd`

**File: `src/components/reports/v2/RepGoalSnapshot.tsx`** (new)
- Accepts `goalPaceData` (from `useGoalPaceCalculatorForUser`), `periodFp`, `periodLabel`, `dateRangeStart`, `dateRangeEnd`
- **Period pace calculation**: Uses `goalPaceData.dailyNeeded` × number of planned work days that fall within the date range (from `goalPaceData.season` data) to compute expected production for that window
- If planned days data isn't granular enough, falls back to `dailyNeeded × calendarDaysInRange` as approximation
- Renders two progress bars: period row + season row
- Season row shows the pace severity badge (on pace / behind) from `goalPaceData.severity`
- Uses the same tier badge (Preseason/Must/Will/Could) from `GOAL_TIER_CONFIG`
- Matches the visual language of `UnifiedGoalProgress` (same colors, bar style) but with contextual labels

### What stays the same
- `useGoalPaceCalculatorForUser` — no changes, already provides all season-level data
- `useRepComparison` — already provides `currentTotals.fp` for the period
- Tier config and severity colors — reused from existing design tokens

