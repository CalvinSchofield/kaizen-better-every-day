

# Fix Goal Pace Calculation: Vivint Sync & PaceDiff

## Problems Found

### 1. The "-181" paceDiff is a math bug
The formula `season.expected = dailyNeeded × seasonKnockingDaysComplete` is circular. `dailyNeeded` is a **catch-up rate** calculated from remaining days, but it's then projected backward over ALL elapsed days to compute "expected." For Quinn:
- dailyNeeded = (33.33 - 11.12) / 3 remaining days = **7.4/day**
- expected = 7.4 × 26 elapsed days = **192.4**
- paceDiff = 11.12 - 192.4 = **-181.28** ← nonsensical

The correct expected should use **linear distribution**: `(activeGoal / totalSeasonDays) × elapsedDays`. For Quinn: (33.33 / 29) × 26 = **29.9**, paceDiff = 11.12 - 29.9 = **-18.8** ← meaningful.

### 2. Goal pace ignores Vivint sync data entirely
Both `useGoalPaceCalculator` (own user) and `useGoalPaceCalculatorForUser` (leader viewing downline) calculate `currentProgress` purely from `daily_entries`. The `official_totals` table (populated by the CatchUp/Vivint sync wizard) is never consulted. If a rep has 23 FP+ according to Vivint but only tracked 11 in the app, goal pace shows them at 11.

The `useEffectiveFP` hook already implements the correct reconciliation model (`official baseline + tracked since verification`), but it's only used for the sync prompt UI — not for actual pace calculations.

## Fix Plan

### 1. Fix paceDiff formula in `calculateGoalPace`
**File: `src/hooks/useGoalPaceCalculator.ts`** (lines 412-421)

Change season expected from catch-up-based to linear:
```
// Before (circular):
season.expected = dailyNeeded * seasonKnockingDaysComplete;

// After (linear):
const linearDailyRate = totalSeasonDays > 0 ? activeGoal / totalSeasonDays : 0;
season.expected = linearDailyRate * seasonKnockingDaysComplete;
```

Apply the same fix to the `calcTimeframe` function (line 322) for Week and Month views — use `activeGoal / totalSeasonDays × periodElapsedDays` instead of `dailyNeeded × periodElapsedDays`.

### 2. Wire `official_totals` into `useGoalPaceCalculator` (own user)
**File: `src/hooks/useGoalPaceCalculator.ts`** (hook section ~line 510+)

- Query `official_totals` for the current season type
- When official totals exist, use `effectiveFP = officialFP + trackedSinceVerification` as `currentProgress` instead of raw tracked totals
- This ensures goal pace reflects Vivint-synced numbers

### 3. Wire `official_totals` into `useGoalPaceCalculatorForUser` (leader view)
**File: `src/hooks/useGoalPaceCalculatorForUser.ts`**

- Add a query for `official_totals` for the target user
- Apply the same effective FP reconciliation: if official totals exist, `currentProgress = officialFP + trackedSinceVerification`
- This ensures leaders see accurate pace for reps who've synced with Vivint

### 4. Pass linear rate into `GoalPaceInput` for timeframe calculations
Add a `linearDailyRate` field to `GoalPaceInput` output so that the `calcTimeframe` helper can compute expected markers using linear distribution rather than catch-up rate across all timeframes.

## Files Modified
- `src/hooks/useGoalPaceCalculator.ts` — fix paceDiff formula + add official_totals query for own user
- `src/hooks/useGoalPaceCalculatorForUser.ts` — add official_totals query for downline user

## Impact
- Goal Progress bars, pace badges, and "needed/day" will reflect Vivint-synced production when available
- The paceDiff trend arrow will show meaningful numbers (-18 instead of -181)
- Smart targets on the Track page will also benefit since they derive from the same goal pace calculator
- No changes needed to UI components — they all consume `GoalPaceData` from these hooks

