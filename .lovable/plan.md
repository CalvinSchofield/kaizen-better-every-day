

## Problem

The calendar's summer daily pace (3.9/day) doesn't match the What If calculator (3.21/day for Could Do) because they use different formulas:

- **What If drawer**: `summerSellNeeded = (focusGoal - forecastedPreseasonTotal × (1 - cancelRate)) / (1 - cancelRate)`, then divides by summer days
- **Calendar (`useGoalPaceCalculator`)**: `summerDailyPace = (summerGoalBuffered - summerProgress) / summerRemainingDays` -- only subtracts actual summer progress (currently 0), completely ignoring preseason contribution

The summer goal tiers (Must Do 450, Will Do 475, Could Do 500) are **season totals**, not summer-only. Preseason production counts toward them. The calendar needs to forecast what the preseason total will be and subtract that (cancel-rate-adjusted) from the summer goal, just like the What If drawer does.

## Plan

**File: `src/hooks/useGoalPaceCalculator.ts`** (lines ~446-473)

Update the `summerDailyPace` calculation to:

1. **Forecast preseason total**: `forecastedPreseason = preseasonProgress + (preseasonDailyPace × preseasonRemainingDays)`
2. **Apply preseason cancel rate**: `netPreseason = forecastedPreseason × (1 - cancelRate)`
3. **Calculate summer sell needed**: `remainingToFund = max(0, summerGoalBuffered - netPreseason)`, then apply cancel rate for summer: `summerSellNeeded = remainingToFund / (1 - cancelRate)` (matching What If logic)
4. **Divide by summer remaining days**: `summerDailyPace = summerSellNeeded / summerRemainingDays`

This mirrors the What If drawer's formula exactly, so the calendar daily targets will match.

