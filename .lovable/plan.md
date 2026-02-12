

# Updated Biweekly Sync Gate -- Knocking Days Handling

## The Change

Step 5 (Knocking Days) in the sync flow needs special treatment because the rep may not know how many days they've actually worked. Unlike FP+, FP Sold, and PRMR which are clearly shown on Curator, knocking days is something the rep either knows from personal tracking or doesn't.

## Updated Step 5: Knocking Days

The step presents **three options** instead of two:

1. **"Use tracked: 15 days"** -- prefills with the app's tracked knocking days count (same as other metrics)
2. **"Enter total days worked"** -- reveals a number input for manual entry
3. **"I'm not sure"** -- skips this metric with a clear explanation of the consequence

### When "I'm not sure" is Selected

- We store `knocking_days = NULL` (or a sentinel value like `-1`) in `official_totals` to indicate "unknown baseline"
- A brief explanation appears: "No problem -- we'll calculate your pace based on the days you track going forward. The more days you log, the more accurate your pace gets."
- The pace calculator (`salesPaceCalculator.ts`) must handle this case:
  - Instead of using `officialKnockingDays + trackedKnockingDaysSinceVerification`, it uses **only** `trackedKnockingDaysSinceVerification` (days tracked since this sync point)
  - `totalDays = trackedKnockingDaysSinceVerification + futurePlannedDays`
  - This means pace is calculated purely on "going forward" data

### How This Affects Pace Calculation

Currently the pace formula is:
```text
totalDays = knockingDays (all worked) + futurePlannedDays
dailyGoal = fundedGoal / totalDays
```

With unknown baseline knocking days, this changes to:
```text
remainingGoal = fundedGoal - currentProgress (FP+ already done)
remainingDays = trackedKnockingDaysSinceVerification + futurePlannedDays
dailyGoal = remainingGoal / remainingDays (if remainingDays > 0)
```

This is actually a **catch-up pace** since we don't know historical days -- but it's the most useful number for the rep because it tells them "given where you are now and how many days you have left, here's what you need per day."

### Subsequent Syncs

On the next biweekly sync (2 weeks later):
- If they previously selected "I'm not sure," the tracked days since that sync point will now be known
- The step will still show all three options, but the "Use tracked" option will now reflect the accurate count from the last 2 weeks
- Over time, as syncs accumulate, the knocking days count becomes increasingly accurate

## Technical Changes

### Files to Modify

**`src/hooks/useOfficialTotals.ts`**
- Update `knocking_days` type to allow `null` to represent "unknown"
- Adjust upsert logic to pass `null` when rep selects "I'm not sure"

**`src/hooks/useEffectiveFP.ts`**
- When `officialKnockingDays` is `null` (unknown), set `effectiveKnockingDays = trackedKnockingDaysSinceVerification` instead of `officialKnockingDays + trackedKnockingDaysSinceVerification`
- Add a `knockingDaysUnknown: boolean` field to the result interface so downstream components can show contextual messaging

**`src/utils/salesPaceCalculator.ts`**
- When `knockingDays` is 0 and we detect the "unknown baseline" state, use the remaining-goal-based calculation
- The input interface gains an optional `knockingDaysUnknown?: boolean` flag
- When true: `dailyGoal = (fundedGoal - currentProgress) / futurePlannedDays`

**`src/components/catchup/BiweeklySyncGate.tsx`** (new file from prior plan)
- Step 5 renders three chip-style options instead of two
- "I'm not sure" chip triggers a brief explanation and stores `null` for knocking days
- Visual: the "I'm not sure" option is styled slightly differently (outline instead of filled) to subtly encourage entering a number while making it acceptable to skip

### Database

No schema change needed -- `knocking_days` in `official_totals` already allows `NULL` (it's `integer | null`).

## Summary of All Sync Flow Steps (Final)

1. **Open Curator** -- link + filter instructions
2. **FP+** -- "Use tracked" or "Enter Vivint's number"
3. **FP Sold** -- "Use tracked" or "Enter Vivint's number"
4. **Total PRMR YTD** -- "Use tracked" or "Enter Vivint's number"
5. **Knocking Days** -- "Use tracked" or "Enter total" or **"I'm not sure"** (skip allowed, pace adjusts)
6. **Open Source Earnings** -- link + check for unfunded
7. **Update CRM** -- mark unfunded/cancelled
8. **Confirmation** -- summary + save

