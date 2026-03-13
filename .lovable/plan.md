

## Fix: Calendar Cell Daily Goal Badge Mismatch

### Problem
The "2.5" badge on calendar day cells comes from `calculateSalesPace()` (the old calculator in `salesPaceCalculator.ts`), while the "2.37" mission statement comes from `useGoalPaceCalculator` (the new unified calculator). Two separate code paths = two different numbers.

### Solution
Remove the old `calculateSalesPace` usage from `CalendarView.tsx` and instead pass the unified `dailyNeeded` value from `useGoalPaceCalculator` down to the calendar cells.

### Changes

**`src/components/CalendarView.tsx`**:
- Remove the `calculateSalesPace` import and the `preseasonDailyGoal` / `summerDailyGoal` `useMemo` block (lines 122-167)
- Remove the `getDailyGoalForDate` callback (lines 169-178)
- Accept `dailyGoal: number | null` as a prop from the parent, sourced from `useGoalPaceCalculator().dailyNeeded`
- Use that single `dailyGoal` value for all calendar cell badges

**`src/components/goals/CalendarGoalProgress.tsx`** (or parent `Calendar.tsx`):
- Already calls `useGoalPaceCalculator()` — expose `data.dailyNeeded` and pass it to `CalendarView` as a prop

This ensures the badge and the mission statement always show the same number because they come from the same calculation.

### No math changes
The unified calculator's formula is already correct (catch-up pace = remaining / remaining planned days). This is purely wiring — one source of truth instead of two.

