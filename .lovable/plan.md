

## Track Feature Audit and Hardening Plan

### Issues Found

**1. "Syncing your data..." blocks all interaction on every load**
The freshness gate (`isFreshDataVerified`) blocks counter taps until `fetchStatus === 'idle'`. On slow/spotty connections, this creates a frustrating delay. The user sees "Syncing your data... Please wait a moment before tracking" -- even when there's a perfectly valid localStorage backup to work from.

**Fix**: Allow immediate interaction when a valid backup exists, regardless of fetch status. The backup IS the truth until the server responds. Remove the blocking toast entirely and replace it with a subtle non-blocking sync indicator.

**2. Counter updates have no offline queue -- only sales do**
Sales have a robust `usePendingSalesQueue` with localStorage persistence and auto-retry on reconnect. But counter updates (doors, pitches, etc.) rely solely on React Query's `networkMode: 'offlineFirst'` with 3 retries. If all retries fail while offline, **the mutation is lost** -- only the localStorage backup preserves the data, and it only recovers on next app load, not proactively.

**Fix**: Add an `online` event listener that automatically pushes the latest backup to the server when connection returns, using `upsert_daily_entry_safe` (which merges safely).

**3. Finalize mutation bypasses safe upsert**
`finalizeEntryMutation` uses direct `.upsert()` on `daily_entries`, which can **overwrite** `sales_log`, `counter_timestamps`, and other fields that the safe RPC carefully merges. This is a data loss vector if two devices finalize or if a sale is added mid-finalization.

**Fix**: Route finalization through `upsert_daily_entry_safe` with `p_is_finalized: true`, or at minimum fetch-then-merge before writing.

**4. Backup not marked as server-confirmed after successful mutation**
`saveBackup(entry, isServerConfirmed)` is available but `onSettled`/`onSuccess` of `updateCounterMutation` never calls it with `isServerConfirmed: true`. This means the backup never knows if the server has the latest data.

**Fix**: On successful mutation response, call `saveBackup(mergedEntry, true)`.

### Implementation Plan

**File: `src/hooks/useDailyEntry.ts`**
- Remove the blocking freshness gate. Change `isFreshDataVerified` to always be `true` when a valid backup exists (it already partially does this with `isOfflineWithBackup`, but only when `navigator.onLine === false`).
- Add `onSuccess` handler to `updateCounterMutation` that saves a server-confirmed backup.
- Add an `online` event listener that pushes the latest backup to the server via `upsert_daily_entry_safe` when connection restores.

**File: `src/components/TrackWithLayout.tsx`**
- Remove the blocking "Syncing your data..." toast from `handleCounterChange`. Replace with: if backup exists, allow immediate interaction. Show a tiny non-blocking sync dot (already exists as `SyncIndicator`).
- The freshness gate check on lines 600-608 becomes a soft check: if no backup AND no server data, THEN show a brief loading skeleton (not a toast).

**File: `src/hooks/useTrackBackup.ts`**
- Add `syncBackupToServer` function that pushes current backup via `upsert_daily_entry_safe` RPC.
- Add auto-sync on `online` event.

### What this achieves
- **Zero blocking**: Taps are always instant, backed by localStorage, synced in background.
- **Never lose data**: Counter queue + sales queue + backup recovery + server-side GREATEST() = belt-and-suspenders.
- **Snappy UX**: No more "Syncing your data..." delays. Just a subtle green/amber dot.
- **Finalization safety**: Uses merge-safe path to prevent overwrites.

