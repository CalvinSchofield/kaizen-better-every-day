

## Multi-Device Sync: Prevent Stale Backup from Overriding Reset

### The Problem

When you reset on Device A (preview), it zeroes the server and clears Device A's localStorage backup. But Device B (TestFlight) still has its old backup. When Device B opens, it sees backup (old values) > server (0) and auto-pushes the old values back — undoing the reset.

The same issue applies if a rep is actively using both iPad and phone: whichever device opens second could push stale backup data.

### Solution: Server-Side Reset Timestamp

Add a `last_reset_at` column to `daily_entries`. When a reset happens, it gets timestamped. When any device loads and considers auto-pushing its backup, it checks: **is my backup older than `last_reset_at`?** If yes, discard it.

This is the only reliable cross-device solution since localStorage is device-local.

### Changes

**1. Database Migration**
- Add `last_reset_at timestamptz` column to `daily_entries` (nullable, default null)

**2. Reset Mutation (`useDailyEntry.ts`)**
- Set `last_reset_at: new Date().toISOString()` when resetting
- Also clear the `backup-push-{date}` sessionStorage flag so the push guard doesn't block future legitimate pushes

**3. Auto-Push Recovery Guard (`useDailyEntry.ts`)**
- In the query function where backup > server triggers auto-push: check `serverEntry.last_reset_at`
- If backup timestamp < `last_reset_at`, discard the backup instead of auto-pushing
- Clear the stale backup from localStorage on that device

**4. `upsert_daily_entry_safe` Update (optional but recommended)**
- Preserve `last_reset_at` during normal upserts (don't overwrite it)
- Only the reset flow sets it

### Files

| File | Action |
|---|---|
| Database migration | Add `last_reset_at` column |
| `src/hooks/useDailyEntry.ts` | Reset sets timestamp; auto-push checks it before restoring |
| `src/hooks/useTrackBackup.ts` | No changes needed — backup timestamp comparison happens in useDailyEntry |

### What This Fixes
- Reset on any device is respected by all other devices
- Normal multi-device use (iPad + phone both tracking) continues to work via GREATEST() — counters only go up
- Stale backups from inactive devices can't resurrect old data after a reset

