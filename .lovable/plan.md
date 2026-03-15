

## Problem

The "Pace looks aggressive" warning on the DailyMissionCard uses a hard-coded threshold: **3+ for vets, 2+ for rookies**. Your daily goal is exactly 3 EFP, so it fires. This is a blunt check with no context — it doesn't consider your actual historical performance, track record, or whether you've consistently hit that number before.

## Solution

Raise the thresholds and make the check smarter by incorporating historical data.

**File: `src/components/track/DailyMissionCard.tsx`** (~lines 75-77)

1. **Increase base thresholds** — Change vet threshold from 3 to 4, rookie from 2 to 3. These better reflect realistic "stretch" territory.

2. **Use historical average as override** — If the user has enough historical data (from `useSmartActivityGoals` or the pace calculator's knocking days), compare the daily goal against their proven daily average. Only show the warning if the required pace exceeds **1.5x their historical daily average** AND exceeds the base threshold. This way, someone who regularly sells 3/day never sees the warning at 3.

### Logic sketch
```typescript
// Base thresholds (safety net for new users)
const baseThreshold = isRookie ? 3 : 4;

// If we have historical pace data, use it
const historicalDailyAvg = data.historicalDailyAvg; // from useGoalPaceCalculator
const dynamicThreshold = historicalDailyAvg > 0 
  ? Math.max(baseThreshold, historicalDailyAvg * 1.5) 
  : baseThreshold;

const isPaceUnrealistic = dailyGoal >= dynamicThreshold;
```

3. **Expose `historicalDailyAvg` from `useGoalPaceCalculator`** — This hook already has access to knocking days and total production. Add a simple `currentProgress / knockingDays` field to its return value so the DailyMissionCard can use it.

### Files to change
- `src/hooks/useGoalPaceCalculator.ts` — Add `historicalDailyAvg` to the returned data
- `src/components/track/DailyMissionCard.tsx` — Replace hard-coded threshold with dynamic logic

