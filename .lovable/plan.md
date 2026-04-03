

## Redesign RepDrillDownDrawer — World-Class Rep Drill-Down

### Current State
The `RepDrillDownDrawer` currently shows a day-by-day activity ring view with stats grid, goal progress, coaching callouts, and SMS action. It lacks:
- A link to the rep's profile page
- KPI tiles with historical comparison (sparklines + deltas) like Reports V2
- A momentum/pulse sentence for the individual rep
- Beautiful timing visualization
- Reports V2 visual language

### What Changes

**1. Header Redesign — Profile Link + Context**
- Add `ProfileAvatar` (clickable → navigates to `/profile/:userId`) next to the rep's name
- Keep year badge and team name
- Replace calendar icon with a small "View Profile" link/button using `ExternalLink` icon
- Keep the calendar button as secondary action

**2. Period Stats Section — Mini Pulse Hero for the Rep**
Add a new section at the top (above the day view) showing the **aggregate stats for the selected date range** (passed from ReportsV2 via `dateRangeStart`/`dateRangeEnd`). This mirrors PulseHero:
- Momentum sentence: "{name} produced {fp} FP+ {period} — {delta}% vs {comparison}"
- 6 KPI tiles (Doors, DMs, Pitches, Trans, Pres, FP+) with delta percentages from comparison period
- PRMR prominently displayed
- Uses the same comparison logic from `useReportsV2Comparison` but filtered to a single `user_id`

**New hook: `useRepComparison`** — adapts `useReportsV2Comparison` for a single rep by filtering `daily_entries` to one `user_id`. Returns `ComparisonTotals` and sparkline history for that rep only.

**3. Timing Visualization**
- Show avg start time, avg end time, and total active hours for the period
- Add a simple bar chart showing daily work windows (start → end) for each day in the range, stacked vertically — similar to a Gantt-style view
- Reuse `HourlyActivityChart` for the selected day view

**4. Day View — Keep but Refine**
- Keep the existing WeekActivityStrip, ActivityRing/Timeline, FinalizedStatsGrid, and SalesLogDrawer
- Remove the old goal section and coaching callouts from day view
- Add the `UnifiedGoalProgress` bar in compact mode (D/Y) at the top of the day section

**5. Remove from Drawer**
- Goal progress calculation logic (the big `useMemo` block) — replace with `useGoalPaceCalculatorForUser` compact display
- `EffortCoachingCallouts` and `CoachingCallouts` — keep the drawer focused on data, not coaching text
- `PurposeDisplayCard` — available on profile page
- SMS button — move to a small icon in the header

**6. Layout Structure**
```text
┌─────────────────────────────────┐
│ [Avatar] Name [Vet] → Profile   │
│ Team Name                       │
├─────────────────────────────────┤
│ PERIOD OVERVIEW (Last Month)    │
│ "3.2 FP+ — ↓12% vs prior"      │
│ ┌─────┬─────┬─────┐            │
│ │Doors│ DMs │Pitch│            │
│ │ 142 │  38 │  24 │            │
│ │↓12% │↑5%  │↓8%  │            │
│ ├─────┼─────┼─────┤            │
│ │Trans│Pres │ FP+ │            │
│ │  8  │  6  │ 3.2 │            │
│ │↓15% │↑20% │↓12% │            │
│ └─────┴─────┴─────┘            │
│ $272 PRMR  1:30 PM→6:45 PM     │
│ 5.2h avg active                 │
├─────────────────────────────────┤
│ DAILY WORK TIMES               │
│ ▓▓▓▓▓▓░░░  Mon (1p-7p)        │
│ ▓▓▓▓░░░░░  Tue (2p-6p)        │
│ ▓▓▓▓▓▓▓░░  Wed (12p-7p)       │
├─────────────────────────────────┤
│ Goal: ━━━━━━━━━░░ 72% (D/Y)   │
├─────────────────────────────────┤
│ M T W T F S S  (week strip)    │
│     [Activity Ring / Timeline]  │
│     [Stats Grid for day]       │
└─────────────────────────────────┘
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useRepComparison.ts` | **Create** — single-rep comparison hook (adapts useReportsV2Comparison for one userId) |
| `src/components/reports/v2/RepDrillDownDrawer.tsx` | **Rewrite** — new layout with profile link, period KPIs, timing chart, streamlined day view |
| `src/components/reports/v2/RepTimingChart.tsx` | **Create** — daily work-window visualization (horizontal bars showing start→end for each day) |
| `src/components/reports/v2/RepPeriodKpis.tsx` | **Create** — mini KPI grid with deltas for a single rep (reuses StatTile pattern from PulseHero) |
| `src/pages/ReportsV2.tsx` | **Minor update** — ensure dateRange props pass correctly to the drawer |

### Technical Details

- **`useRepComparison` hook**: Queries `daily_entries` for the single userId across both the current and comparison date ranges. Uses the same comparison range logic from `useReportsV2Comparison` (getComparisonRange). Returns per-metric deltas and sparkline points.
- **`RepTimingChart`**: SVG-based horizontal bar chart. Each row = one day in the date range. Bar position maps work_start_time → work_end_time on a 6am–11pm axis. Color-coded by hours worked.
- **Profile navigation**: Uses `ProfileAvatar` component with `onBeforeNavigate` to close the drawer chain before navigating.
- **No new database changes** — all data already available in `daily_entries` and existing hooks.

