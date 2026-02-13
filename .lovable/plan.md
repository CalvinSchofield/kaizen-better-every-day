

## Stable Heatmap Coloring: Use Planned Days as Baseline

### What's Changing

The heatmap cell colors will use a **fixed even-split baseline** based on the rep's actual **planned work days** — not all available Mon-Sat days in the season. This prevents cells from looking artificially dim as the season progresses.

### Current Issue

The preseason pace baseline (`preseasonDailyPace`) currently uses `knockingDays + remainingPreseasonWorkDays`, where `remainingPreseasonWorkDays` either counts future planned days OR falls back to all remaining Mon-Sat days. As days pass, this denominator shrinks, inflating the pace and making past good days look pale.

Summer pace already correctly uses only planned days.

### The Fix

**File: `src/components/goals/CalendarPlanningPreview.tsx`**

1. **Preseason baseline** (used for cell coloring only):
   - Count all preseason planned days: past worked days (`knockingDays`) + future planned preseason days (`futurePreseasonPlanned`)
   - Formula: `preseasonGoal / (knockingDays + futurePreseasonPlanned)`
   - If no future days are planned, fall back to `knockingDays + 1` (today) to avoid division by zero while keeping the baseline reasonable

2. **Summer baseline** — already correct, uses `futureSummerPlannedAll`. No change needed.

3. **Badge (`dailyNeeded`)** — unchanged. This still shows the real-time catch-up pace so the rep knows what they actually need per day.

### Technical Detail

```text
BEFORE (line 150):
  preseasonDailyPace = preseasonGoal / (knockingDays + remainingPreseasonWorkDays)
  // remainingPreseasonWorkDays = futurePreseasonPlanned OR all Mon-Sat left
  // Shrinks daily, inflating pace

AFTER:
  totalPreseasonPlannedDays = knockingDays + futurePreseasonPlanned
  // If futurePreseasonPlanned is 0, fallback to knockingDays + 1
  preseasonDailyPace = preseasonGoal / totalPreseasonPlannedDays
  // Fixed denominator based on actual plan
```

### Summary

| Aspect | Before | After |
|--------|--------|-------|
| Preseason cell coloring | Shifts as days pass | Stable against planned days |
| Summer cell coloring | Based on planned days | No change |
| Badge (daily needed) | Dynamic catch-up pace | No change |
| File changed | CalendarPlanningPreview.tsx | CalendarPlanningPreview.tsx only |

