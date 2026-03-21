
Goal: make Track counter taps (add and subtract) persist reliably and immediately to the backend, so leaderboard always matches what Calvin logs on phone.

What I found in the current code
1) Counter writes can be dropped on transient failure:
- In `TrackWithLayout.tsx`, `flushCounterSyncQueue` clears `pendingUpdateRef` before `await updateCounter(payload)`.
- If that mutation fails, there is no durable counter queue like sales have; recovery depends on later parity checks/focus events.

2) Counter sync path is mixed/inconsistent:
- Counter cards use serialized path (`handleCounterChange` → queue flush).
- Time/break/reset-adjacent updates still call `updateCounter(...)` directly, bypassing the same reliability guarantees.

3) Backend merge logic currently blocks true “subtract/correction” persistence:
- `upsert_daily_entry_safe` uses `GREATEST(...)` for counters and timestamp union merge.
- This protects against stale overwrites, but also prevents intentional decrements and timestamp removal from persisting exactly.

4) Realtime invalidations can pull older server state mid-session:
- `useSalesRealtime` invalidates broad sales keys including `daily-entry`, which can trigger refetch pressure while local writes are still reconciling.

Implementation plan
1) Add a durable pending counter queue (same resilience level as pending sales)
- Create `usePendingCounterQueue` (localStorage-backed, per-user).
- Each counter interaction writes an item immediately before network attempt.
- Queue processor retries with backoff, online/focus/visibility resume, and app restart recovery.
- Only dequeue after server acknowledgment confirms the change landed.

2) Unify all Track mutations through one reliable write gateway
- In `TrackWithLayout.tsx`, route:
  - counter taps,
  - decrement actions,
  - start/end work,
  - break start/end,
  - manual time edits
  through the same serialized + durable pipeline.
- Remove bypass paths that call raw `updateCounter` directly for Track-session state changes.

3) Add a backend-safe counter-event RPC for atomic add/subtract
- Introduce a dedicated RPC for counter events (increment/decrement by field) so each tap is atomic at the database layer.
- Keep sale writes on existing sale-safe paths.
- Use idempotency token per event (UUID) so retries never double-apply.
- This enables true decrement persistence while staying safe under retries/network flakiness.

4) Preserve anti-data-loss protections while allowing corrections
- Keep server safeguards that prevent stale full-snapshot overwrites.
- Shift counter taps to event-based writes (not full snapshot overwrites for every tap).
- Continue parity checks, but have parity auto-heal re-enqueue missing events instead of one-off blind snapshot push.

5) Tighten sync observability in UI
- Extend Sync indicator states to reflect:
  - local queued events,
  - in-flight send,
  - confirmed synced,
  - auth-expired blocked state.
- Add a small queued-count debug surface (dev-only or hidden behind long-press) for fast field diagnosis.

6) Reduce harmful refetch churn during active Track session
- Scope/adjust invalidation behavior so active local track state is not frequently overwritten by unrelated realtime updates.
- Keep leaderboard/report invalidations aggressive, but make `daily-entry` refresh controlled while unsynced local queue exists.

Validation plan (must pass before shipping)
1) Tap reliability:
- Add 10 doors with normal pacing (seconds/minutes apart) and verify DB row + leaderboard match exactly.
2) Decrement reliability:
- Add 3, subtract 1, confirm DB and leaderboard reflect subtraction correctly.
3) Offline/reconnect:
- Log counters offline, force-close app, reopen online, confirm queued events replay and match.
4) Auth expiry:
- Simulate expired session mid-track; verify explicit blocked state and automatic recovery after re-auth.
5) Multi-device safety:
- Phone + preview both active; ensure no regression/loss with interleaved updates.
6) Timestamp parity:
- `counter_timestamps` counts align with counter values after add/subtract cycles.

Technical details (implementation-focused)
- Frontend files:
  - `src/components/TrackWithLayout.tsx` (single write gateway + queue integration)
  - `src/hooks/useDailyEntry.ts` (counter mutation adapter for new RPC + clearer error codes)
  - new `src/hooks/usePendingCounterQueue.ts`
  - `src/components/SyncIndicator.tsx` (queued/in-flight semantics)
  - `src/hooks/useSalesRealtime.ts` / invalidation scope tuning
- Backend:
  - migration to add atomic counter-event RPC + idempotency support table
  - keep existing `upsert_daily_entry_safe` for full-entry/sales/finalization flows
- Safety:
  - maintain RLS posture and per-user enforcement
  - no client-side admin/auth shortcuts; server-authoritative writes only

Expected outcome
- Every Track tap is captured immediately locally, persisted durably, retried automatically, and confirmed server-side.
- Leaderboard reflects backend truth quickly, and backend truth reliably reflects what user tracked.
- Corrections (subtracts) now persist intentionally instead of being silently blocked by merge semantics.
