

# Fix: Goal Progress Propagation + Fallback Daily Mission Average

## Two Issues

### Issue 1: Goal progress bar not updating everywhere
The centralized invalidation utility has **mismatched query keys** — it invalidates `preseason-fp` but the actual key is `preseason-fp-total`. It also misses several keys that `useGoalPaceCalculator` depends on: `today-entry-unified`, `all-entries-unified`, `official-totals-pace`, and `historical-summer-avg-pace`.

### Issue 2: "0 EFP" Today's Mission when no planned days remain
When `remainingDays === 0`, `dailyNeeded` becomes 0. Instead of showing "0 EFP to stay on track", we should show the user's season-appropriate average as a fallback target.

## Changes

### File 1: `src/utils/goalInvalidation.ts`
Fix mismatched keys and add missing ones:
- `preseason-fp` → `preseason-fp-total` (actual key)
- Add `today-entry-unified` 
- Add `all-entries-unified`
- Add `official-totals-pace`
- Add `ytd-prmr-total`
- Also add these to `invalidatePlannedDaysQueries`

### File 2: `src/components/track/DailyMissionCard.tsx`
When `dailyGoal` is 0 (no remaining planned days) but goals exist:
- Fall back to `data.userDailyAvg` as the display value
- Change subtitle from "to stay on track" to "your avg — beat it today"
- This uses the existing `userDailyAvg` from the pace calculator, which is already season-aware (computed from current season's knocking days)

### File 3: `src/hooks/useGoalPaceCalculator.ts` (pure function)
When `remainingDays === 0` and `dailyNeeded` would be 0, expose a `fallbackDailyAvg` in the day timeframe data so consumers know when they're showing a fallback. The `userDailyAvg` field already computes the correct season-specific average (preseason entries during preseason, summer entries during summer) since it divides `currentProgress / knockingDaysCompleted` and `currentProgress` is already scoped to the active season.

