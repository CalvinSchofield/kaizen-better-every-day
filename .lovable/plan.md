
Goal: stabilize Track → Leaderboard → Reports so live activity is both saved and visible, and remove “looks synced but missing” failure modes.

What I found from the current backend + code
1) Live leaderboard is mostly reflecting backend reality, not stale UI:
- Today’s `daily_entries` rows currently have doors/transitions activity, but sales are mostly `sales_log=[]`, `fp_plus=0`, `prmr=0`.
- The screenshot leaderboard row for Ammon (Transitions = 1) matches current backend values.

2) The Track green dot can be a false sense of safety:
- `SyncIndicator` is driven by local mutation state (`setSyncStatus('synced')`) after mutation success.
- It does not verify that the server row now contains expected sale/counter payload.

3) Reports loading is brittle when team access/data calls fail or partially resolve:
- `useTeamAccess` can throw on timeout/error.
- `ReportsV2` depends on multiple async hooks and doesn’t surface all failure states cleanly.
- `useTeamLiveData` reads a stale cache key format (`team-access-cache`) while `useTeamAccess` writes `team-access-cache:v4:{userId}`.

4) Access/RLS baseline looks acceptable for visibility:
- `daily_entries` has “recent live leaderboard” and own-row policies.
- `reps` has broad authenticated read.
- So this looks more like sync/persistence flow integrity than permissions denial.

Implementation plan
1) Make Track sync status server-verified (not optimistic-only)
- Files: `src/hooks/useDailyEntry.ts`, `src/components/TrackWithLayout.tsx`, `src/components/SyncIndicator.tsx`.
- After successful write, do a lightweight read-back of today row (`closes`, `sales_log`, counters, `updated_at`).
- Only set green when server values match or exceed local expected values.
- If mismatch, keep pending/error and auto-retry (with visible message “saved locally, server confirmation pending”).

2) Route sale writes through server-merge-first path
- Files: `src/components/TrackWithLayout.tsx`, `src/hooks/useAddSaleToEntry.ts`.
- For new sales from Track/LogSale flow, use `addSaleAsync` (safe merge RPC path) as primary write.
- Then refresh the daily-entry cache from server before marking synced.
- Keep offline queue fallback, but status must remain non-green until confirmed.

3) Harden Reports page against partial failures
- Files: `src/hooks/useTeamAccess.ts`, `src/pages/ReportsV2.tsx`, `src/hooks/useTeamLiveData.ts`.
- `useTeamAccess`: return safe fallback object on timeout/failure (plus error flag), not hard throw.
- `ReportsV2`: add explicit error+retry UI for team access/presets/insights failure (instead of indefinite loading feel).
- Fix cache key mismatch in `useTeamLiveData` so team mapping/hierarchy is consistently available.

4) Remove risky single-row assumptions
- Files: `src/pages/Leaderboard.tsx`, `supabase/functions/fetch-team-access/index.ts` (if needed).
- Replace `.single()` with `.maybeSingle()` where “no row” is valid.
- Ensure initialization always resolves (`finally`) so pages do not get stuck behind loading gates.

5) Strengthen leaderboard invalidation after sales operations
- Files: `src/hooks/useAddSaleToEntry.ts`, `src/hooks/useSaleUpdate.ts`, `src/hooks/useDailyEntry.ts`.
- Ensure exact key invalidation/refetch for:
  - `today-leaderboard`
  - `expanded-leaderboard`
  - `team-live-data`
  - `team-insights`
- Keep this centralized via the existing sales invalidation utility.

Technical details (for reliability and diagnosis)
- Add a compact “sync proof” state model:
  - `pending_local` → `pending_server_confirm` → `synced_verified` / `sync_error`.
- Persist a tiny `lastServerConfirmedAt` + `lastServerConfirmedEntryVersion` marker in local backup metadata.
- Add structured console logs around sale save lifecycle:
  - sale queued, RPC success, read-back mismatch, verified sync.
- Avoid any weakening of RLS or public exposure of sensitive tables.

Validation checklist after implementation
1) Track online happy path:
- Add doors + sale; confirm backend row updates immediately (`sales_log` count, closes, fp/prmr).
- Confirm leaderboard updates within the expected polling/realtime window.

2) Poor network path:
- Toggle offline/online mid-session.
- Confirm status transitions: offline/pending, then verified green after reconnect.

3) Two-device same-user conflict path:
- Device A logs sale while Device B increments activity.
- Confirm no sales_log loss and counters merge correctly.

4) Reports resilience:
- Simulate edge-function timeout/failure.
- Confirm page shows actionable retry/error state (not indefinite loading).

Expected outcome
- If Track shows green, data is actually confirmed on backend.
- Leaderboard “missing live updates” aligns with true backend state (or shows explicit pending-sync state).
- Reports never feels frozen; failures are visible and recoverable.
