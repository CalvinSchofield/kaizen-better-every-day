

# Remove Old CatchUpWizard — Use Only BiweeklySyncGate

## Problem

There are two sync flows in `Goals.tsx`:
1. **BiweeklySyncGate** — the newer full-screen flow with "Use what I've tracked" vs "Enter manually" choices. Only triggers automatically during biweekly sync windows or initial setup.
2. **CatchUpWizard** — the older modal that just asks you to type in numbers. Still wired to manual "Sync" buttons on the page.

When you tap a sync button outside the biweekly window, you get the old flow. That's what you're seeing.

## Fix

### Step 1: Replace CatchUpWizard with BiweeklySyncGate for manual syncs

In `Goals.tsx`:
- Remove the `CatchUpWizard` import and its `<CatchUpWizard>` JSX block
- Remove `showCatchUpWizard` state
- Replace all `onSyncClick={() => setShowCatchUpWizard(true)}` callbacks with a new handler that opens the `BiweeklySyncGate` in a full-screen overlay/sheet
- Reuse the same `BiweeklySyncGate` component with `isInitialSync={false}` for manual syncs

### Step 2: Make BiweeklySyncGate work as both a gate AND a manual trigger

Currently it renders as a full page replacement. Add an optional `mode` prop:
- `mode="gate"` (default) — current behavior, replaces the page
- `mode="manual"` — renders inside a Sheet/Dialog so it can be opened on demand

### Step 3: Clean up dead code

- Remove `CatchUpWizard.tsx` file entirely (or keep for reference but remove all imports)
- Remove the `CatchUpWizard` export from `src/components/catchup/index.ts`
- Update any other files importing `CatchUpWizard`

### Files Modified
- `src/pages/Goals.tsx` — remove old wizard, wire sync buttons to BiweeklySyncGate
- `src/components/catchup/BiweeklySyncGate.tsx` — add `mode` prop for manual trigger support
- `src/components/catchup/index.ts` — remove CatchUpWizard export

