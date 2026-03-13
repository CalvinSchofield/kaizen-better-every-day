

## Problem

The pace context line currently shows three separate numbers — `Avg X/day`, `Need Y/day`, `Z/week` — and then each timeframe shows a different "goal" number. The user can't tell that these are all derived from the same daily mission. It feels like different targets rather than one consistent mission.

## Solution: One Mission, Scaled to Timeframe

Simplify the display so the **daily catch-up pace is the single anchor**. Everything else is just that number multiplied out:

- **Day**: Need **2.4** EFP today
- **Week**: Need **14.4** EFP this week (2.4 × 6 work days)  
- **Month**: Need **52.8** EFP in March (2.4 × 22 work days)
- **Season**: Need **240** EFP total (the goal itself)

### UI Changes to `UnifiedGoalProgress.tsx`

1. **Replace the triple pace line** (`Avg X/day | Need Y/day | Z/week`) with a single, clear "mission statement" that changes with the selected timeframe:

```text
Day view:    "Your mission: 2.4 EFP today  ·  Avg 1.8/day"
Week view:   "Your mission: 14.4 EFP this week (2.4/day × 6 days)"
Month view:  "Your mission: 52.8 EFP in March (2.4/day × 22 days)"
Season view: "240 EFP goal  ·  Need 2.4/day to finish on pace"
```

2. **Keep severity coloring** on the mission number (green/amber/red based on whether dailyNeeded is achievable relative to user's average).

3. **Keep "Avg X/day"** as secondary context — it's helpful and not confusing.

4. **The progress bar goal stays the same** (`dailyNeeded × planned days in period`) — but now the label explicitly shows the daily rate relationship so users understand it's the same mission scaled up.

### Changes

- **`src/components/goals/UnifiedGoalProgress.tsx`**: Replace the pace context section (lines 287-298) with a timeframe-aware mission statement. Update both Full and Compact modes.
- **No calculation changes** — the math in `useGoalPaceCalculator` is already correct. This is purely a display clarity fix.

