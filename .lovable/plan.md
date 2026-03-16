

## Spending Baseline: One-Time Initial Sync Step + Goals Page Edit

The spending baseline step appears **only once** — during the very first sync when the app is catching up to pre-tracking work. It never appears in biweekly syncs. Users can still edit it later from the Goals page if needed.

### Changes

**1. `src/components/catchup/CatchUpWizard.tsx`** — Add `'spending'` step

- Add step between `'prmr'`/`'days'` and `'confirm'`, only in the `isInitialSync` flow
- Auto-skip if FP+ is 0 (user said they haven't sold yet — no spending to baseline)
- UI: dollar input, "Where do I find this?" link to Curator Source, prominent "Skip — I have none" button
- Add `spendingBaseline` state, include in `handleSubmit` as `baseline_spent`

**2. `src/components/goals/earnings/NetPayWaterfall.tsx`** — Subtle edit access

- Add optional `baselineSpent` and `onEditBaseline` props
- In spending sublabel: if baseline exists show "Incl. $X baseline" tappable text; if none show "+ Add baseline"

**3. `src/components/goals/EarningsBreakdownCard.tsx`** — Wire up sheet + calculations

- Import `SpendingBaselineSheet`, fetch `baseline_spent` from official totals
- Add baseline to spending total in net pay calculation
- Pass `baselineSpent` and `onEditBaseline` to `NetPayWaterfall`

### Step visibility logic
```
Initial sync (isInitialSync=true) + FP+ > 0  →  show spending step
Initial sync + FP+ = 0                        →  auto-skip
Biweekly sync (isInitialSync=false)            →  never shown
```

### Files
- `src/components/catchup/CatchUpWizard.tsx`
- `src/components/goals/earnings/NetPayWaterfall.tsx`
- `src/components/goals/EarningsBreakdownCard.tsx`

