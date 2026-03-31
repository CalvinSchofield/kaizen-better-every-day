

# Codebase Audit: Dead Code, Unused Functions, and TestFlight Performance

## Summary

After reviewing ~170 hooks, ~70 edge functions, all pages, utilities, and the full component tree, the codebase is in reasonable shape. Most hooks and edge functions are actively used. Below are the concrete findings.

---

## 1. Dead Code to Remove

### Unused Hooks (no imports anywhere)
| File | Status |
|------|--------|
| `src/hooks/useRepsWithSaleCount.ts` | Zero imports — completely dead |
| `src/hooks/useSmartRepSorting.ts` | Zero imports — completely dead |
| `src/hooks/useWorkingStatus.ts` | Zero imports — completely dead |

### Unused Edge Functions (no client invocation)
| Function | Status |
|----------|--------|
| `supabase/functions/seed-demo-data/` | Never called from frontend — dev-only artifact |
| `supabase/functions/cleanup-demo-data/` | Never called from frontend — dev-only artifact |
| `supabase/functions/backfill-badges/` | Never called from frontend — one-time migration script |

### Stale Files
| File | Status |
|------|--------|
| `src/utils/salesLogCalculations.test.ts` | Test file with no test runner configured — dead weight |
| `export-package/` directory | Old export artifact, references stale imports (e.g., `useAboutTeamPrefetch`). Not part of the build but adds confusion |

**Total: 3 hooks, 3 edge functions, 1 test file, 1 stale directory**

---

## 2. Code That Could Be Consolidated (Not Dead, But Redundant)

### Duplicate Mapbox Token Fetching
`get-mapbox-token` is invoked from 4 separate components (`LogSaleSheet`, `SaleDetailSheet`, `CustomerMap`, `LogSale`), each with identical `useState`/`useEffect` patterns. Should be a single `useMapboxToken()` hook.

### Duplicate Cache-Clearing Logic
`useCurrentUserId.ts` has the same cache-clearing block copy-pasted twice (lines 88-104 and 132-148). Should be extracted to a helper.

---

## 3. TestFlight vs Web Performance Issues

### Problem: Edge Functions Are the Bottleneck on Native
On web, edge function calls benefit from browser HTTP/2 connection pooling and faster DNS. On TestFlight (WKWebView with local bundled assets), every `supabase.functions.invoke()` is a cold HTTPS request.

**Key slow paths on native:**

1. **`usePrefetchData` Phase 3** fires 3 edge function calls (`fetch-team-access`, `fetch-blitzes`, `fetch-blitz-attendance`) at 1.5s delay. On mobile, these can take 2-5s each. They block leader status, which gates UI elements.

2. **`ProtectedRoute` fires `useSetupStatus`** — 3 parallel DB queries on every route change. On native cold start, this adds 500ms-1s before any gated route renders.

3. **`useRepData` + `useTeamAccess` + `useSetupStatus`** all fire independently on login. On web, the persistent cache (`offlineFirst`) covers this. On TestFlight after a new build, the cache is wiped (new binary = new WebView storage), so everything waterfalls.

### Recommended Fixes

| Issue | Fix |
|-------|-----|
| Edge functions cold on native | Bundle `fetch-team-access` result into a single `useTeamAccess` localStorage cache that survives app updates (like `useCurrentUserId` already does). On resume, refresh in background. |
| `useSetupStatus` fires on every route | Cache result in localStorage with 30min TTL (same pattern as `getCachedLayoutState`). Only re-query on explicit refresh or after setup flow completes. |
| Phase 3 prefetch blocks leader UI | Move `fetch-team-access` to Phase 1 (it gates the most UI elements). Keep blitzes in Phase 3. |
| New TestFlight build = empty cache | Add a "warm cache" step in `useAppResume` that detects empty cache + valid session and triggers prefetch immediately. |

---

## 4. Minor Cleanup Opportunities

- **`goalsSetupCache.ts`** overlaps with the new `useSetupStatus` hook — the old localStorage-based `hasCompletedGoalsSetup` / `syncGoalsSetupFlag` could be migrated to use `useSetupStatus` as the single source of truth
- **`pwaDetection.ts`** is only used in `Auth.tsx` for `PWAInstallGate` — both still active but worth confirming you still want the PWA install gate on the auth page given the TestFlight push

---

## Implementation Plan

### Phase 1: Remove dead code (safe, no behavior change)
1. Delete `useRepsWithSaleCount.ts`, `useSmartRepSorting.ts`, `useWorkingStatus.ts`
2. Delete `seed-demo-data/`, `cleanup-demo-data/`, `backfill-badges/` edge function directories
3. Delete `salesLogCalculations.test.ts`
4. Delete `export-package/` directory

### Phase 2: TestFlight performance fixes
1. Move `fetch-team-access` from Phase 3 to Phase 1 in `usePrefetchData`
2. Add localStorage caching to `useSetupStatus` (30min TTL)
3. Extract `useMapboxToken()` hook from duplicated pattern
4. De-duplicate cache-clearing logic in `useCurrentUserId`

### Phase 3: Optional consolidation
1. Merge `goalsSetupCache.ts` into `useSetupStatus`
2. Review if `PWAInstallGate` is still needed

---

## Files to Modify/Delete

**Delete (7 files + 3 directories)