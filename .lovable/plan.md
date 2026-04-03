

## Clickable KPI Tiles in Rep Drill-Down

### Problem
The KPI tiles (Doors, DMs, Pitches, Trans, Pres, FP+) in the individual rep drill-down are static. Leaders can't tap them to get deeper insight. Showing "who contributed" (like the team-level drawer) is pointless for a single rep.

### What Leaders Actually Need

For **effort metrics** (Doors, DMs, Pitches, Trans, Pres), the most instructive view is:
1. **Enlarged sparkline** with daily trend and average line — shows consistency vs spikiness
2. **Conversion funnel context** — how this metric connects to outcomes (e.g., Doors: "29.3% → DM", "79.6% → Pitch from DM")
3. **Daily average** and **best day** — quick benchmarks

For **FP+**, show the **deal breakdown** — FP vs Upgrade split, avg PRMR per deal, time to sell, difficulty distribution. This reuses the existing `DealAnalyticsInline` from `FpDetailDrawer.tsx`, scoped to just this rep.

### Layout

```text
Effort metric tap (e.g. Doors):
┌────────────────────────────────┐
│ Doors                          │
│ 167 doors · Last Month         │
│ ──── sparkline (enlarged) ──── │
│              ─── avg: 6.4/day  │
│                                │
│ Funnel                         │
│ 29.3% → Decision Makers       │
│ 79.6% → Pitches (from DMs)    │
│                                │
│ Best Day    23 doors           │
│ Daily Avg   6.4 doors          │
└────────────────────────────────┘

FP+ tap:
┌────────────────────────────────┐
│ FP+ Details                    │
│ (Deal breakdown - FP vs        │
│  Upgrade, avg PRMR, time to    │
│  sell, difficulty, day-of-week)│
└────────────────────────────────┘
```

### Technical Plan

**New file: `src/components/reports/v2/RepKpiDetailDrawer.tsx`**
- A drawer specifically for individual rep KPI drill-down (not team)
- Props: `open`, `onOpenChange`, `metricKey` (doors/dms/pitches/transitions/presentations/fp), `current` (ComparisonTotals), `sparklineHistory` (SparklinePoint[]), `repName`, `periodLabel`, `userId`, `dateRange`
- For effort metrics:
  - Enlarged `MicroSparkline` with gold average line and label
  - Compute conversion ratios from `current` totals (e.g., `dms/doors`, `pitches/dms`, `transitions/pitches`)
  - Show "Daily Avg" (total / days in sparkline) and "Best Day" (max from sparkline data)
- For FP+:
  - Reuse `DealAnalyticsInline` content from `FpDetailDrawer.tsx` (extract it or call with `userIds=[userId]`)
  - Shows FP vs Upgrade, avg PRMR, time to sell, difficulty, day-of-week chart

**Modified: `src/components/reports/v2/RepPeriodKpis.tsx`**
- Add `onKpiTap?: (metricKey: MetricKey) => void` prop
- Make each KPI tile clickable when `onKpiTap` is provided (add `onClick`, cursor-pointer, active:scale feedback)

**Modified: `src/components/reports/v2/RepDrillDownDrawer.tsx`**
- Add state: `activeKpiMetric` (MetricKey | null)
- Pass `onKpiTap` to `RepPeriodKpis` that sets the active metric
- Render `RepKpiDetailDrawer` with the rep's `userId`, `currentTotals`, `sparklineHistory`, and date range
- For FP+ metric, pass `userIds=[rep.userId]` to reuse deal analytics query

### Conversion Funnel Logic
From `current` totals, compute:
- Doors tile: `DM% = dms/doors`, `Pitch% = pitches/dms`
- DMs tile: `from Doors = dms/doors`, `→ Pitch = pitches/dms`
- Pitches tile: `from DMs = pitches/dms`, `→ Trans = transitions/pitches`
- Transitions tile: `from Pitches = transitions/pitches`, `→ Pres = presentations/transitions`
- Presentations tile: `from Trans = presentations/transitions`, `→ Close = fp/presentations`

This gives leaders the "so what" — not just "167 doors" but "and 29% answered."

