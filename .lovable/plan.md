# Live Intraday Pacing — "How are we doing RIGHT NOW vs normal?"

## The Problem

Today the live view compares your group's current partial-day totals against full-day baselines and last week's same-day final numbers. At 2 PM, showing "you're 60% behind" when the day is only 60% done is misleading. There's no concept of **"where we usually are at this time of day."**

## What a World-Class Version Looks Like

A great sales leader needs one glance to know: **"Are we behind, on track, or ahead compared to a normal day at this exact moment?"** — across all KPIs, not just FP+.

The key insight: Mon–Fri and Saturday are different work patterns. A Saturday with 80 doors at 2 PM might be excellent; the same number on a Wednesday might be behind.

---

## Design Approach

### 1. New: Intraday Pace Engine (`intradayPaceCalculations.ts`)

Build a utility that:

- Takes the team's last 4–6 weeks of daily entries (with timestamps)
- Groups them by **day type**: Weekday (Mon–Fri) vs Saturday (skip Sundays or treat as separate if data exists)
- For each historical work day, calculates cumulative KPI totals at each hour (using `work_start_time` and proportional distribution based on total hours worked)
- Returns: **"By hour X on a typical [Weekday/Saturday], the team usually has Y doors, Z DMs, etc."**

This creates hourly milestone curves per day-type, per KPI.

### 2. New: `useIntradayPace` Hook

- Fetches last 6 weeks of daily entries for all accessible reps (with `work_start_time`, `work_end_time`, all KPI fields)
- Calls the pace engine to compute typical curves for current day type
- Returns `{ expectedNow: { doors, dms, pitches, transitions, presentations, fp }, dayType: 'weekday' | 'saturday', pctDayElapsed, hasEnoughData }`
- Only active when `isLiveView === true`

### 3. Enhanced PulseHero — Intraday Pace Bar

When in live view, add a new element between the pulse sentence and the KPI tiles:

```text
┌─────────────────────────────────────────────┐
│  ⏱ Intraday Pace (Weekday)                  │
│  ████████████████░░░░░░░░  67% of day       │
│                                              │
│  Doors  142 / 128 expected  ▲ +11%          │
│  DMs     41 / 38 expected   ▲ +8%           │
│  FP+    2.1 / 1.8 expected  ▲ +17%          │
└─────────────────────────────────────────────┘
```

- Shows a subtle progress bar of how far through the typical work day the team is (USE 9pm local as typical end time for each day including Saturdays)^*******
- For each key KPI: current value, what's "expected by now" for this day type, and a green/red delta
- Compact — collapses to just the top-line summary if tapped, or shows all KPIs expanded
- Label says "Weekday pace" or "Saturday pace" so the leader knows the comparison is fair

### 4. Enhanced KPI Tile Deltas

Currently, live KPI tile deltas compare against last week's same day (full-day totals). Change this:

- **Live view tiles**: delta shows `% vs expected at this hour` (intraday pace) instead of vs last week's full day
- The "vs same day last week" comparison remains available in the drill-down drawer

### 5. Smarter Pulse Sentence

Update `generatePulseSentence` for live view to use intraday pace:

- "Team is 15% ahead of typical Wednesday pace" (instead of comparing partial vs full day)
- "Saturday pace is tracking — 112 doors vs 108 expected by 2 PM"

---

## Technical Details

### Hourly Curve Calculation

Since we don't have per-hour activity breakdowns (only daily totals with start/end times), we approximate:

- Assume activity is **uniformly distributed** across a rep's work hours
- For a rep who worked 9 AM – 5 PM with 100 doors: ~12.5 doors/hour
- At 2 PM (5 hours in), expected = 62.5 doors from that rep
- Sum across all reps working today to get team expected-by-now

Formula per rep working today:

```
hoursElapsed = min(now - avgStart, avgHoursWorked)
fractionComplete = hoursElapsed / avgHoursWorked
expectedKPI = avgKPIPerWorkDay × fractionComplete
```

This uses existing `RepBaseline` data (avg start, avg hours, avg KPI per day) — no new DB queries needed beyond what baseline already fetches.

### Day-Type Separation

In `calculateRepBaseline`, split the 14-day (or extend to 6-week) lookback into two pools:

- `weekdayBaseline`: entries where `getDay(entry_date)` is 1–5
- `saturdayBaseline`: entries where `getDay(entry_date)` is 6

Use the matching baseline for today's day type.

### Files to Create/Modify


| File                                            | Change                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/utils/intradayPaceCalculations.ts`         | **New** — Core engine: calculates expected-by-now for each KPI given day type and current time |
| `src/utils/baselineCalculations.ts`             | **Modify** — Split baselines by day type (weekday vs Saturday)                                 |
| `src/hooks/useReportsV2Data.ts`                 | **Modify** — Compute intraday pace from existing baseline data when live                       |
| `src/components/reports/v2/PulseHero.tsx`       | **Modify** — Add intraday pace bar component, update pulse sentence and tile deltas            |
| `src/components/reports/v2/IntradayPaceBar.tsx` | **New** — The compact visual showing expected-vs-actual at this hour                           |


### Data Requirements

No new database tables or queries. The existing 14-day baseline fetch already pulls `work_start_time`, `work_end_time`, and all KPI fields. We just need to:

1. Separate weekday vs Saturday entries in the calculation
2. Use the leader's local time (or rep timezone) to determine "hours elapsed today"