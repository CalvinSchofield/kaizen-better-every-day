
# Bulletproof Track: Offline-First Architecture

## ✅ IMPLEMENTATION COMPLETE (Feb 7, 2026)

All 5 phases have been implemented to prevent data loss scenarios like Javier's.

---

## Problem Summary
Javier's data was erased because he tapped "+1 door" while the app was still fetching from the database. The optimistic update started with an empty cache (zeros) and overwrote his existing server data with `doors_knocked: 1` + zeros for everything else.

### Architecture Gaps (FIXED)
1. ~~**Cache can be empty**~~ → Now uses localStorage backup as `initialData`
2. ~~**isLoading is unreliable**~~ → Replaced with `isFreshDataVerified` flag
3. ~~**No "freshness gate"**~~ → Counter changes blocked until data verified
4. ~~**Optimistic updates assume cache is truth**~~ → Now uses `smartMergeEntries()` with Math.max

---

## Implemented Solutions

### ✅ Phase 1: Instant Hydration from localStorage Backup
**File**: `src/hooks/useDailyEntry.ts`
- Added `getInitialDataFromBackup()` for synchronous localStorage read
- React Query uses this as `initialData` so UI never shows zeros on cold launch
- Helper `getInstantBackup()` exported from `useTrackBackup.ts`

### ✅ Phase 2: Freshness Gate for Mutations  
**Files**: `src/hooks/useDailyEntry.ts`, `src/components/TrackWithLayout.tsx`
- Added `isFreshDataVerified` state that becomes true when:
  - Server fetch completes successfully, OR
  - User is offline but has valid localStorage backup
- `handleCounterChange` now blocks taps until `isFreshDataVerified` is true
- Shows "Syncing your data..." toast instead of silently overwriting

### ✅ Phase 3: Smart Merge on Mutation
**File**: `src/hooks/useTrackBackup.ts`
- Added `smartMergeEntries()` helper that takes HIGHER value for each counter
- Merges timestamp arrays with deduplication
- Merges sales_log by ID (no duplicates)
- `onMutate` handler now uses this when cache is empty

### ✅ Phase 4: Server-Side Conflict Resolution
**Database Function**: `upsert_daily_entry_safe`
- Enhanced to use `GREATEST()` for all counter fields
- Counters can ONLY go UP, never reduced by a sync
- Timestamp arrays are merged server-side (deduped + sorted)
- Uses `LEAST()` for work_start_time, `GREATEST()` for work_end_time

### ✅ Phase 5: Visual Sync Status
**Already existed**: `SyncIndicator` component
- Shows offline/syncing/error states appropriately
- TrackWithLayout already manages `syncStatus` state

---

## Recovery: Javier's Data

Javier's `doors_knocked` for Feb 6th was overwritten to 0. The timestamps were lost.
**Recommendation**: Ask Javier for his approximate count and manually update via SQL.

---

## Expected Outcome

After implementation:
- ✅ App feels instant - no loading states on Track page (uses localStorage backup)
- ✅ Counters work offline - taps are queued and synced when back online
- ✅ Data never lost - smart merge always takes higher values
- ✅ Clear sync status - user knows if data is synced or pending
- ✅ Tap-while-loading is safe - blocked until fresh data verified
