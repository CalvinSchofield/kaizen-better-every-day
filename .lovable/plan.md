

# Audit & Fix: Goal/Planned Days Changes Not Propagating

## Problem

When you change your preseason goal (e.g. 90 → 75) or update planned work days, the new values don't propagate to all views. The root cause is **fragmented cache keys** — the same data (e.g. `season_config`) is fetched under 6+ different React Query keys, and mutations only invalidate a subset of them.

### Current Query Key Fragmentation

The `season_config` table alone is cached under:
- `season-config` (useAppMode, usePrefetchData)
- `season-config-for-goals-page` (Goals.tsx)
- `season-config-for-goals` (CalendarPlanningCard)
- `season-config-unified` (useGoalPaceCalculator)
- `season-config-focus-tier` (useFocusTier)
- `season-config-whatif` (CalendarPlanningPreview)
- `season-config` with userId (usePlannedDaysSync)

When QuickEditGoalsDrawer saves summer dates, it only invalidates 3 of these. The goal pace calculator, focus tier, and calendar planning card never see the update until staleTime expires (5 minutes).

Similarly, when `planned_work_days` are changed, only `planned-days` is invalidated — but `worked-days-data`, `downline-goal-pace`, `goal-pace` queries, and the heatmap all use separate keys.

## Fix

### Step 1: Create a centralized invalidation utility

Create `src/utils/goalInvalidation.ts` with a single function `invalidateGoalRelatedQueries(queryClient)` that invalidates ALL goal-dependent query keys in one call:

- `rep-goals`
- All `season-config*` variants (use prefix matching)
- `planned-days`
- `worked-days-data`
- `effective-fp`
- `downline-goal-pace`
- `all-entries-unified`
- `today-entry-unified`
- `preseason-fp`
- `cumulative-fp`

### Step 2: Wire centralized invalidation into all mutation points

Replace scattered `queryClient.invalidateQueries` calls with the centralized function in:

- **`useRepGoals.ts`** — `updateGoals` onSuccess
- **`QuickEditGoalsDrawer.tsx`** — after saving goals + summer dates
- **`usePlannedDays.ts`** — all add/remove/clear onSuccess handlers
- **`CalendarPlanningCard.tsx`** — after summer date changes
- **`CalendarView.tsx`** — after summer date changes
- **`Goals.tsx`** — setup wizard completion, manual sync completion, focus tier changes
- **`usePlannedDaysSync.ts`** — after exclusion changes

### Step 3: Fix the localStorage planned-days cache staleness

`usePlannedDays.ts` uses a 24-hour localStorage cache as `placeholderData`. After mutations, the localStorage cache is only updated on the next successful fetch. If the app is closed before that fetch completes, the stale localStorage cache wins on next launch.

Fix: Update the localStorage cache immediately inside each mutation's `onSuccess`, or clear it on mutation so the next load fetches fresh.

### Step 4: Fix the infinite removeChannel stack overflow

The runtime error (`Maximum call stack size exceeded` in `removeChannel`) is a recursive loop where unsubscribing from a channel triggers another unsubscribe. This is likely from a realtime subscription cleanup that re-triggers itself. Investigate and add a guard flag to prevent re-entrant cleanup.

### Files Modified
- `src/utils/goalInvalidation.ts` (new) — centralized invalidation function
- `src/hooks/useRepGoals.ts` — use centralized invalidation
- `src/hooks/usePlannedDays.ts` — use centralized invalidation + fix localStorage cache
- `src/components/goals/QuickEditGoalsDrawer.tsx` — use centralized invalidation
- `src/components/goals/CalendarPlanningCard.tsx` — use centralized invalidation
- `src/components/CalendarView.tsx` — use centralized invalidation
- `src/pages/Goals.tsx` — use centralized invalidation at all mutation points
- `src/hooks/usePlannedDaysSync.ts` — use centralized invalidation

