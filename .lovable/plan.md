

# Remove Cancel Icons + Add "Mission Complete" Indicator

## Two Changes

### 1. Remove cancelled/never_installed indicators from calendar cells
Strip the `Ban` icon overlays from both week and month views in `CalendarView.tsx`. The cancelled status is still tracked in `CanceledStatsCard` and the drawer — the calendar cells don't need it.

**Files:** `src/components/CalendarView.tsx` — remove the `hasCancelledSale` logic and the `Ban` icon render blocks in both week and month day cells (~lines 566-591 and 640-663).

### 2. "Mission Complete" checkmark — snapshot the goal at finalization time

Your concern is exactly right. Today's required pace (3.0) is different from November's (2.0). If we compare past days against *today's* goal, days that were victories become failures retroactively. That's demoralizing and dishonest.

**Solution: Store the daily target when the entry is finalized.**

- **Add a `daily_target` column** (numeric, nullable) to `daily_entries`. When a day is finalized, we capture the current `dailyNeeded` value from the goal calculator and save it alongside the entry.
- **Calendar indicator**: For finalized days where `fp_plus >= daily_target` (or EFP equivalent), show a subtle checkmark or small filled dot — the day's "mission" was completed *by the standard that existed at that time*.
- **Days without `daily_target`** (all historical entries before this feature): no indicator shown. Clean and honest — we don't retroactively judge.
- **Visual**: A tiny `✓` or filled emerald dot in the top-right corner of the cell (replacing where the Ban icon was). Subtle enough to not compete with the FP+ number, but satisfying to see a streak of them.

### Implementation

1. **DB migration**: `ALTER TABLE daily_entries ADD COLUMN daily_target numeric;`
2. **Finalization logic**: Where entries are saved/finalized, also write the current `dailyNeeded` value to `daily_target`.
3. **CalendarView.tsx**: Replace the cancelled-sale indicator with a mission-complete indicator: if `entry.daily_target` exists and the day's production (FP+ or EFP depending on mode) meets or exceeds it, render a small emerald checkmark.
4. **CalendarView.tsx**: Remove `hasCancelledSale` checks and `Ban` icon blocks from both week and month views.

### Files Changed
- `src/components/CalendarView.tsx` — remove cancel icons, add mission-complete indicator
- Finalization hook/component (wherever `is_finalized` is set to true) — persist `daily_target`
- DB migration — add `daily_target` column

