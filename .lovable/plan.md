

## Pending Pipeline Indicator — Calendar Progress + Goals Page

### Problem
1. `calcTimeframe` in `useGoalPaceCalculator` (line 263-265) skips only `never_installed` for unfinalized sales but NOT `pending` — inconsistent with `usePreseasonFP` which excludes pending. This means Week/Month bars may still count pending sales.
2. No visual indicator anywhere shows how much production is "in the pipeline" (scheduled out, awaiting install confirmation).
3. No card on the Goals page surfaces pending installs or links to the CRM.

### Changes

**1. Fix `calcTimeframe` pending skip** (`src/hooks/useGoalPaceCalculator.ts`)
- Line 265: Add `if (sale.install_status === 'pending') continue;` alongside the existing `never_installed` skip
- Lines 476-477: Same fix in `todayLiveFP` calculation

**2. Add `pendingPipeline` to `GoalPaceData`** (`src/hooks/useGoalPaceCalculator.ts`)
- Calculate total pending FP from all entries' `sales_log` where `install_status === 'pending'`
- Add `pendingPipeline: number` to `GoalPaceData` and `TimeframeData` interfaces
- Pass through from `calculateGoalPace` and hook

**3. Add striped "pipeline" segment to `SegmentedBar`** (`src/components/goals/UnifiedGoalProgress.tsx`)
- Accept new `pending` prop on `SegmentedBar`
- Render a third segment after live with a striped/hatched pattern (CSS repeating-linear-gradient) in a muted blue/purple
- Add "Pipeline" to the legend when `pending > 0`
- Show pending amount in the header numbers: e.g. `3.2 (+0.5 live) (+2.0 pipeline)`

**4. Add `pendingPipeline` to `TimeframeData` in `calcTimeframe`**
- Track pending FP separately in the period loop
- Include in the returned `TimeframeData` so each timeframe (D/W/M/Y) shows its own pipeline

**5. Create `PendingInstallsCard`** (`src/components/goals/PendingInstallsCard.tsx`)
- New card component styled similar to `CanceledStatsCard` (amber/blue border)
- Shows count and total EFP/FP+ of pending installs
- Clock icon, "Scheduled Out — Awaiting Install" title
- Tapping navigates to `/customers` via `useNavigate`
- Only renders when there are pending sales (self-gating)
- Uses `usePendingInstalls` hook (already exists) or queries all entries for pending sales

**6. Add `PendingInstallsCard` to Goals page** (`src/pages/Goals.tsx`)
- Insert below the `CanceledStatsCard` (after line 952)
- Import and render `<PendingInstallsCard />`

**7. GoalHeroRing pending indicator** (`src/components/goals/GoalHeroRing.tsx`)
- Add optional `pendingPipeline` prop
- When > 0, show a small dashed arc segment or a subtle badge below the ring: "2.0 in pipeline" with a clock icon
- Keeps the ring clean while surfacing the info

### File Summary

| File | Change |
|------|--------|
| `src/hooks/useGoalPaceCalculator.ts` | Fix pending skip in `calcTimeframe` + `todayLiveFP`; add `pendingPipeline` to data |
| `src/components/goals/UnifiedGoalProgress.tsx` | Add striped pipeline segment to `SegmentedBar`; update numbers + legend |
| `src/components/goals/PendingInstallsCard.tsx` | New card: pending installs summary → navigates to CRM |
| `src/pages/Goals.tsx` | Render `PendingInstallsCard` below `CanceledStatsCard` |
| `src/components/goals/GoalHeroRing.tsx` | Add `pendingPipeline` badge below ring |

