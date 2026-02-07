

# Productivity Per Hour Bug Fix

## Root Cause Identified

The "Productivity per Hour" section shows **0.0** for all metrics because of **corrupted break period data** in your entries.

### The Bug

In `useInsightsData.ts`, when calculating work hours, the code subtracts break periods:

```javascript
entry.break_periods.forEach((breakPeriod: any) => {
  const breakStart = new Date(breakPeriod.start);
  const breakEnd = new Date(breakPeriod.end);  // ← PROBLEM: breakPeriod.end is ""
  minutes -= differenceInMinutes(breakEnd, breakStart); // ← Returns NaN
});
```

When `breakPeriod.end` is an empty string:
1. `new Date("")` creates an `Invalid Date`
2. `differenceInMinutes(Invalid Date, validDate)` returns `NaN`
3. `minutes -= NaN` makes `minutes = NaN`
4. `acc.totalHours += NaN / 60` propagates `NaN` through ALL entries
5. `activityTotals.totalHours = NaN`
6. `doorsPerHour = doors / NaN = NaN` → displayed as "0.0"

### Your Affected Entries

| Date | Issue |
|------|-------|
| 2026-01-21 | Break started at 00:43 but never ended |
| 2025-12-19 | Break started at 23:27 but never ended |
| 2025-12-06 | Break started at 03:01 but never ended |

These incomplete breaks happen when someone taps "Break" but the break never gets ended (app crash, connection loss, or saved without ending break).

---

## Solution

### Part 1: Fix the Calculation (Defensive Code)

Add validation to skip invalid break periods:

```javascript
entry.break_periods.forEach((breakPeriod: any) => {
  // Skip incomplete break periods (no start or end)
  if (!breakPeriod.start || !breakPeriod.end) return;
  
  const breakStart = new Date(breakPeriod.start);
  const breakEnd = new Date(breakPeriod.end);
  
  // Validate the dates are valid
  if (isNaN(breakStart.getTime()) || isNaN(breakEnd.getTime())) return;
  
  const breakMinutes = differenceInMinutes(breakEnd, breakStart);
  
  // Only subtract positive break durations
  if (breakMinutes > 0) {
    minutes -= breakMinutes;
  }
});
```

### Part 2: Clean Up Corrupted Data

Option A: **Data Migration** - Find and fix all incomplete breaks by setting `end` to equal `start` (zero-length break):

```sql
UPDATE daily_entries
SET break_periods = (
  SELECT jsonb_agg(
    CASE 
      WHEN bp->>'end' = '' OR bp->>'end' IS NULL 
      THEN jsonb_set(bp, '{end}', bp->'start')
      ELSE bp
    END
  )
  FROM jsonb_array_elements(break_periods) AS bp
)
WHERE jsonb_array_length(break_periods) > 0
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(break_periods) AS bp
    WHERE bp->>'end' = '' OR bp->>'end' IS NULL
  );
```

Option B: **Leave data as-is** - The defensive code will handle it. Data stays historical.

### Part 3: Prevent Future Corruptions

In the break ending logic, ensure breaks always get a valid end time, even during error scenarios or auto-finalization.

---

## Answer to Your Questions

### Will this work for manual entries?

**Yes, with one requirement**: The rep must enter both a `work_start_time` AND `work_end_time`.

The calculation uses:
```javascript
if (entry.work_start_time && entry.work_end_time) {
  // Calculate hours
}
```

If a rep enters data manually:
- **WITH start/end times**: Productivity will calculate correctly
- **WITHOUT start/end times**: That entry contributes 0 hours to the total, making per-hour metrics lower/invalid

### When would productivity NOT work?

1. **No time data** - Entry has no `work_start_time` or `work_end_time`
2. **Corrupted break periods** - Empty start/end values (your current issue)
3. **Invalid dates** - Malformed timestamp strings
4. **End before start** - Negative work duration (should be validated)
5. **No activity** - Zero doors, pitches, etc. (nothing to divide)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useInsightsData.ts` | Add defensive validation for break periods in both calculation loops |
| `src/hooks/useTeamAggregatedRankings.ts` | Same fix for team insights |
| `src/hooks/useRepDrillDownData.ts` | Same fix for rep drill-down |
| Database migration (optional) | Clean up corrupted break_periods data |

---

## Implementation Priority

1. **Critical**: Fix `useInsightsData.ts` to handle invalid break periods
2. **Important**: Apply same fix to other hooks that calculate hours
3. **Optional**: Database cleanup migration
4. **Future**: Add validation when saving breaks to prevent corruption

