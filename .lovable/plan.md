

# TestFlight Loading/Timeout Audit

## Root Cause Analysis

The app has a **cascading auth-check bottleneck** that is particularly brutal on native/TestFlight builds where network conditions are worse than browser preview.

### The Core Problem: Redundant `supabase.auth.getUser()` Calls

`getUser()` makes a **network request to Supabase** every time it's called (unlike `getSession()` which reads from local cache). The app calls `getUser()` in a waterfall pattern on every page load:

```text
1. HydrationGate → useCurrentUserId → getUser()          [BLOCKS entire app]
2. ProtectedRoute → getSession()                          [another auth call]
3. ProtectedRoute → useRepData → getUser() AGAIN          [redundant]
4. useDailyEntry queryFn → getUser() AGAIN                [redundant]
5. useDailyEntry queryFn → getUser() A SECOND TIME (L301) [double call!]
6. useTeamAccess queryFn → getSession()                   [another call]
7. usePrefetchData → getSession()                         [another call]
```

On a slow mobile connection (TestFlight on cellular), each `getUser()` can take 1-3 seconds. This waterfall means the app can take **8-15+ seconds** before anything renders. If any single call times out, the 4-second timeout in `useCurrentUserId` fires, but downstream hooks still make their own calls which can also timeout independently.

### Specific Issues Found

1. **`useDailyEntry.ts` L286 + L301**: Calls `getUser()` TWICE in the same queryFn. The second call on line 301 is completely redundant — it re-fetches the user it already has.

2. **`useRepData.ts` has its OWN auth listener**: It independently calls `getUser()` and sets up `onAuthStateChange`, duplicating what `useCurrentUserId` already does. This creates a parallel auth race.

3. **`ProtectedRoute` also independently calls `getSession()` + `onAuthStateChange`**: A third parallel auth check system.

4. **84 files** call `getUser()` individually in their queryFns — each one is a network round-trip on native.

5. **`useTeamAccess` has a 12s timeout**: On slow native networks, this edge function call can hang, blocking the entire My Group / leadership UI.

6. **`usePrefetchData` fires 9+ parallel requests** immediately on auth — on a cold TestFlight launch this saturates the connection.

## Proposed Fix Plan

### Step 1: Eliminate redundant auth calls in critical path
- **`useDailyEntry.ts`**: Remove the duplicate `getUser()` on line 301. Use the user from line 286.
- **`useRepData.ts`**: Stop calling `getUser()` independently. Accept `userId` as a parameter from `useCurrentUserId` (which already verified auth). Remove its own auth state listener.
- **`ProtectedRoute.tsx`**: Use `useCurrentUserId` instead of its own independent `getSession()` + `onAuthStateChange` setup. This eliminates the third parallel auth system.

### Step 2: Replace `getUser()` with `getSession()` in queryFns
- `getSession()` reads from local cache (instant) while `getUser()` hits the network every time
- For queryFns that just need the userId, switch to `getSession()` — the session is already verified by HydrationGate
- Target the most critical hot-path files first: `useDailyEntry.ts`, `useRecapData.ts`, `useAddSaleToEntry.ts`, `useSaleUpdate.ts`

### Step 3: Reduce prefetch pressure on cold launch
- **`usePrefetchData.ts`**: Add a small delay (500ms) before Phase 2 (edge function calls) to let the critical UI render first. Reduce parallel Phase 1 calls to only the 3 most critical (rep-data, daily-entry, season-config).

### Step 4: Add native-aware timeouts
- **`useTeamAccess.ts`**: Reduce timeout from 12s to 8s on native, and ensure stale cache is served immediately while background refresh happens (it partially does this but the `placeholderData` from localStorage scan is fragile).

### Step 5: Prevent HydrationGate from blocking on slow auth
- Currently has a 4s timeout but still blocks rendering. For native builds, if we have a cached userId, render immediately and verify auth in background — the ProtectedRoute will catch truly expired sessions.

## Impact

These changes eliminate ~5-10 redundant network round-trips on every page load. On TestFlight with a 1-2s round-trip time, this could reduce initial load from 10-15s down to 2-3s.

## Files to Modify
- `src/hooks/useDailyEntry.ts` — remove double getUser, switch to getSession
- `src/hooks/useRepData.ts` — remove independent auth, accept userId prop
- `src/components/ProtectedRoute.tsx` — use useCurrentUserId
- `src/hooks/usePrefetchData.ts` — stagger prefetches
- `src/hooks/useTeamAccess.ts` — native-aware timeout
- `src/components/HydrationGate.tsx` — instant render with cached userId on native
- ~10-15 high-traffic queryFn files — getUser → getSession swap

