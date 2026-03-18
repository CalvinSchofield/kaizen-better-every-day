

## Record Detection for Reports Dashboard

### Problem
The PulseHero stat grid shows current totals but doesn't indicate when those totals are all-time records for the group. The user wants intelligent, timeframe-aware record detection: "best day ever" for day views, "best week ever" for week views, etc. Also wants day-of-week records (e.g., "best Saturday ever") and timing records (earliest avg start).

### Approach: Subtle record badges on stat tiles + a tappable drill-down

**UX Design** (world-class mobile simplicity):
- When a metric is a record, the StatTile gets a subtle gold shimmer ring and a small "crown" icon. No text clutter on the grid itself.
- Below the stat grid, a compact "Records" banner appears listing which records were broken (e.g., "Best day PRMR ever | Earliest group start"). Tappable to expand details.
- Keep the dashboard clean — records are celebratory, not noisy.

### Architecture

**1. Compute all-time records in `useTeamInsightsData.ts`**

The `allEntriesWithActivity` array (already fetched, line 356) contains all historical entries. Add a new section that:
- Groups `allEntries` by day → computes daily group totals (same logic as `dailyGroupData` but for all-time)
- Groups by ISO week (Sun-Sat) → computes weekly group totals
- Groups by month → computes monthly group totals
- For each granularity, tracks the record value for: FP+, PRMR, Doors, DMs, Pitches, Presentations, Closes, earliest avg start, latest avg end
- Also tracks day-of-week records (best Monday ever, best Tuesday ever, etc.)

Returns a new `allTimeRecords` object on `TeamInsightsData`.

**2. Compare current period in `useReportsV2Data.ts`**

New computed property `activeRecords`:
- Based on `effectivePreset`, determine granularity:
  - `today` / `yesterday` → compare vs all-time daily records AND day-of-week records
  - `week` / `lastWeek` → compare vs all-time weekly records
  - `month` / `lastMonth` → compare vs all-time monthly records
  - `preseason` / `ytd` → compare vs season (only one season, so no comparison — skip)
- For each metric, flag `isRecord: true` if current total >= all-time record

**3. Surface in `PulseHero.tsx`**

- New optional prop `records?: Record<string, boolean>` mapping metric keys to record status
- `StatTile` gets an optional `isRecord` prop:
  - Adds a gold ring (`ring-2 ring-amber-400/60`) and a tiny crown icon
  - Subtle entrance animation (scale bounce)
- Below the secondary metrics row, render a `RecordBanner` component when any records are active:
  - Compact amber strip: "🏆 Best [day/week/month] FP+ ever" (lists up to 3 records)
  - Tappable → opens a `RecordDetailsDrawer` showing all broken records with historical context (previous record value, date, % improvement)

**4. Day-of-week intelligence**

For day-level presets (`today`, `yesterday`), also check:
- "Best [Tuesday] ever for Doors"
- "Earliest group start on a [Wednesday]"
- These appear as secondary items in the RecordBanner

### Files to modify

| File | Change |
|---|---|
| `src/hooks/useTeamInsightsData.ts` | Add all-time record computation from `allEntries`, new `allTimeRecords` property on return type |
| `src/hooks/useReportsV2Data.ts` | Compute `activeRecords` by comparing current totals vs all-time records based on preset granularity; expose from hook |
| `src/components/reports/v2/PulseHero.tsx` | Add `records` prop to StatTile (gold ring + crown), render RecordBanner below secondary metrics |
| `src/components/reports/v2/RecordBanner.tsx` | **Create** — compact amber strip listing broken records, tappable for details |
| `src/components/reports/v2/RecordDetailsDrawer.tsx` | **Create** — drawer showing all broken records with previous record value/date and % improvement |
| `src/pages/ReportsV2.tsx` | Pass `activeRecords` to PulseHero, wire up RecordDetailsDrawer state |

### Record types tracked

```text
Metric keys: fp, prmr, doors, dms, pitches, presentations, closes, avgStart, avgEnd, activeHours
Granularities: daily, weekly, monthly
Day-of-week: per day name (Sun-Sat) for daily presets only
```

### Edge cases
- Live/today view: records are provisional (data still accumulating) — show "On pace for record" instead of "Record" if current value is within 80% of record
- First-ever period: everything is technically a record — suppress if < 3 comparable periods exist
- `preseason` / `ytd` / `custom`: no equivalent comparison pool — skip record detection
- Team filter changes: records are relative to the filtered group, recalculated when filter changes

