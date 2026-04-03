# Dynamic Historical Context — Momentum KPI Cards

## What We're Building

Transform the static KPI tiles in PulseHero and the Production Trend chart into momentum-aware coaching cards with: adaptive period-over-period deltas, embedded micro-sparklines, and contextual "best" badges.

## Current State

- **PulseHero** shows 6 stat tiles (Doors, DMs, Pitches, Pres, Closes, FP+) with delta % only on FP+ and only in Live view (vs 14-day baseline). 
- **ProductionTrendChart** shows FP+ and Presentations as area charts for multi-day views — no comparison overlay.
- **SalesFunnel** already has 14-day baseline conversion comparisons.
- **useReportsV2Data** fetches a 14-day baseline but no "previous equivalent period" comparison data.
- Date presets already exist: today, yesterday, week, lastWeek, month, lastMonth, preseason, ytd, custom.

## Plan

### 1. Add Comparison Period Data Hook

Create `useReportsV2Comparison.ts` — a new hook that fetches the "previous equivalent period" entries:


| Active Preset     | Comparison Period                                                       |
| ----------------- | ----------------------------------------------------------------------- |
| today / yesterday | Same day of week last week/last day of week there was data for that day |
| week              | Previous week                                                           |
| lastWeek          | The week before that                                                    |
| month             | Previous month                                                          |
| lastMonth         | The month before that                                                   |
| custom            | Same-length range immediately before                                    |
| preseason / ytd   | No comparison (too broad)                                               |


This hook queries `daily_entries` for the comparison date range and returns aggregated totals + per-day breakdown for sparkline data. Reuses the same `userIds` as the main query.

### 2. Add Sparkline Data to Hook

Extend `useReportsV2Data` (or the new comparison hook) to return a `sparklineHistory` array — the last 7-10 data points at the selected granularity:

- Day view → last 7 same-weekdays (e.g., last 7 Tuesdays)
- Week view → last 6-8 weeks
- Month view → last 6 months

Each point: `{ label, doors, dms, pitches, presentations, closes, fp, prmr }`.

### 3. Upgrade StatTile with Sparkline + Delta

Modify `PulseHero.tsx` `StatTile` component:

- Accept `sparklineData?: number[]` and `comparisonDelta?: number` props.
- Render a tiny inline `<Sparkline>` (a simple SVG path, no axes) below the value, ~20px tall.
- Show delta badge for all metrics (not just FP+), sourced from comparison period.
- **Color logic**: Raw effort metrics (Doors, DMs) use neutral delta colors. Ratio/skill metrics (conversion rates in Effort/Skill section) use green/red.
- Add an optional faint "gold line" horizontal marker on the sparkline representing the team historical average for that metric.

### 4. Contextual Record Badges

Update `RecordBanner` and the record detection logic:

- Instead of "Best Ever" or generic "Best Wednesday", make badges time-scoped: "Best Tuesday this Quarter", "Highest Pitch Rate in 6 Months".
- Modify `teamRecordDetection.ts` to accept the current period context and generate a descriptive label.
- Surface these as refined badge text on the StatTile's crown icon tooltip.

### 5. Wire Everything in ReportsV2Page

- Pass comparison data and sparkline history from the new hook into `PulseHero`.
- Pass comparison deltas into `EffortSkillDiagnosis` so the Effort/Skill score rings can show period-over-period change.
- Add a faint "previous period" overlay line to `ProductionTrendChart` when comparison data is available.

### Technical Details

**New file:** `src/hooks/useReportsV2Comparison.ts`

- Single `useQuery` call fetching `daily_entries` for the computed comparison range
- Returns: `{ comparisonTotals, sparklineHistory, isLoading }`
- Comparison date math uses `date-fns` (already imported)

**Modified files:**

- `src/components/reports/v2/PulseHero.tsx` — StatTile gets sparkline + delta; new `MicroSparkline` SVG component
- `src/hooks/useReportsV2Data.ts` — export `sparklineHistory` alongside existing data (or consume from comparison hook)
- `src/pages/ReportsV2.tsx` — instantiate comparison hook, pass data down
- `src/components/reports/v2/ProductionTrendChart.tsx` — optional "previous period" dashed overlay
- `src/components/reports/v2/EffortSkillDiagnosis.tsx` — accept and display period deltas on score rings
- `src/utils/teamRecordDetection.ts` — contextual badge label generation

**No new dependencies needed** — sparklines are simple inline SVGs (polyline), recharts only used for the larger trend chart.