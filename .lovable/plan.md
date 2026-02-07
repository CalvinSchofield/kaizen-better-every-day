
# Bulletproof Track: Offline-First Architecture

## Problem Summary
Javier's data was erased because he tapped "+1 door" while the app was still fetching from the database. The optimistic update started with an empty cache (zeros) and overwrote his existing server data with `doors_knocked: 1` + zeros for everything else.

### Current Architecture Gaps
1. **Cache can be empty** - React Query persisted cache may expire or not exist
2. **isLoading is unreliable** - Returns `false` when ANY cached data exists (even zeros)
3. **No "freshness gate"** - User can interact before we've verified we have real data
4. **Optimistic updates assume cache is truth** - But cache can be stale/empty

---

## Solution: True Offline-First with Freshness Gate

### Phase 1: Instant Hydration from localStorage Backup

**Goal**: Never show zeros. Always have data ready immediately.

**Changes to `useDailyEntry.ts`**:
- Add `initialData` option to React Query that pulls from localStorage backup FIRST
- This means even on cold launch, the UI shows the last known state instantly
- The cache no longer controls what users see on first render

```
Query Flow (Current):
[Launch] → [Show zeros/skeleton] → [Fetch server] → [Show data]

Query Flow (Fixed):
[Launch] → [Read localStorage backup] → [Show last known state] → [Fetch server] → [Merge if newer]
```

### Phase 2: Freshness Gate for Mutations

**Goal**: Block counter changes until we're confident we have reliable data.

**New state tracking**:
- Add `isFreshDataVerified` flag that becomes `true` only when:
  1. Server fetch completes successfully, OR
  2. We're offline but have a valid localStorage backup

**Changes to `TrackWithLayout.tsx` > `handleCounterChange`**:
- Replace simple `isLoadingEntry` check with `!isFreshDataVerified`
- Show appropriate message: "Syncing your data..." instead of blocking

**Changes to `useDailyEntry.ts`**:
- Track `fetchStatus` (idle, fetching, success, error)
- Only allow mutations when `fetchStatus === 'success'` OR (offline AND backup valid)

### Phase 3: Smart Merge on Mutation

**Goal**: Never lose data by overwriting higher counts with lower counts.

**Changes to `onMutate` handler**:
- Before applying optimistic update, compare with localStorage backup
- Take the HIGHER value for each counter when merging
- Never create new entry with zeros if backup exists

```typescript
// Current (dangerous):
if (!old) {
  return { doors_knocked: 0, ...updates };
}

// Fixed (safe):
if (!old) {
  const backup = getBackupFromStorage(userId, entryDate);
  return {
    doors_knocked: Math.max(backup?.doors_knocked || 0, updates.doors_knocked || 0),
    decision_makers: backup?.decision_makers || 0,
    // ... etc
    ...updates,
  };
}
```

### Phase 4: Server-Side Conflict Resolution

**Goal**: Database never accepts a write that would lose data.

The existing `upsert_daily_entry_safe` PostgreSQL function already does some protection, but we should verify/enhance:
- Add `GREATEST()` logic for counters: never reduce a counter value
- Add timestamp array merging: never lose tap timestamps

### Phase 5: Visual Sync Status

**Goal**: User always knows app state at a glance.

**Sync indicator states**:
1. 🟢 **Synced** - Data matches server
2. 🟡 **Syncing** - Save in progress
3. 🟠 **Offline** - Using local data, will sync when online
4. 🔴 **Error** - Sync failed, retrying

**Changes**:
- The existing `SyncIndicator` component can be enhanced
- Add subtle "Last synced: 2 min ago" timestamp
- When offline, counters still work and increment visually

---

## Technical Implementation Details

### Files to Modify

1. **`src/hooks/useDailyEntry.ts`**
   - Add `initialData` from localStorage backup for instant hydration
   - Add `isFreshDataVerified` state export
   - Enhance `onMutate` with backup-aware merge logic
   - Add network status awareness

2. **`src/components/TrackWithLayout.tsx`**
   - Replace `isLoadingEntry` guard with `isFreshDataVerified` check
   - Add visual feedback when data is syncing
   - Handle offline queue more prominently

3. **`src/hooks/useTrackBackup.ts`**
   - Add `getInstantBackup()` - synchronous read for `initialData`
   - Enhance backup to include `lastServerSync` timestamp
   - Add smart merge helper function

4. **`src/pages/Track.tsx`**
   - Show subtle overlay when `!isFreshDataVerified` instead of full skeleton
   - Allow viewing data but show "syncing" state on counters

5. **Database function** (if needed)
   - Verify `upsert_daily_entry_safe` uses `GREATEST()` for counters

---

## Recovery: Restoring Javier's Data

Looking at the database, Javier's timestamps for other counters are intact for today (Feb 6th entry):
- `decision_makers`: 15 with timestamps
- `pitches`: 7
- `transitions`: 5
- `presentations`: 3
- `closes`: 3

His `doors_knocked` is 0 with empty timestamps. However, his **previous day** (Feb 5th, finalized) shows healthy data with 56 doors knocked.

**Unfortunately, today's doors_knocked timestamps were overwritten and lost.** We cannot recover the exact count automatically. Options:
1. Ask Javier approximately how many doors he knocked today
2. Use an estimate based on his typical ratios (e.g., 15 DMs usually = ~40-50 doors)

---

## Expected Outcome

After implementation:
- ✅ App feels instant - no loading states on Track page (uses localStorage backup)
- ✅ Counters work offline - taps are queued and synced when back online
- ✅ Data never lost - smart merge always takes higher values
- ✅ Clear sync status - user knows if data is synced or pending
- ✅ Tap-while-loading is safe - blocked until fresh data verified
