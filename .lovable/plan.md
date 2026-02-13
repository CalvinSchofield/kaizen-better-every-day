

## Navigation & Access Audit: Full Findings and Fix Plan

### Issue 1: Leaderboard Unreachable in Preseason Mode

The Leaderboard page (`/leaderboard`) is only placed in the bottom nav when knocking mode is ON. When knocking mode is OFF (preseason), there is **no link to it anywhere** — not in the bottom nav, not in the hamburger drawer. Since this is a native app (no URL bar), the page is completely inaccessible in preseason.

**Fix**: Add a Leaderboard link to the AppDrawer for all non-pre-blitz users when knocking mode is OFF. Place it alongside the Compete link (both are competitive features). It should also appear for users in knocking mode who don't have it in their bottom nav (leaders in knocking mode already have it in nav, non-leaders also have it — so this is mainly for preseason).

### Issue 2: Pre-Blitz Rookie Access Audit

Pre-blitz rookies currently have access to these pages from the drawer that they arguably shouldn't:
- **Compete** (Challenges & Incentives) — visible to all, no lock
- **Customers** — visible to all, no lock  
- **My Group** — visible, no lock

Per the memory on rookie access: Track, Insights, Calendar, Home, Challenges, Incentives, Customers should all be **locked** for pre-blitz rookies.

**Fix**: Lock Compete and Customers for pre-blitz rookies in the drawer (show them with a lock icon and "Unlocks on first blitz" text, same pattern as Track/Calendar/Insights). My Group "suggest recruits" can stay since recruiting is a preseason activity.

### Issue 3: Pages Reachable Only via Drawer (Discoverability Check)

These pages have no bottom nav presence and rely solely on the drawer:
- **Insights** — drawer only (both modes). OK, secondary feature.
- **Compete** — drawer only. OK, but consider if it should be more prominent.
- **Customers** — drawer only. OK for now.
- **Profile** — via avatar in drawer header. OK.
- **Settings/Personalize** — drawer only. Standard pattern.

All other pages are either in the bottom nav, linked from a parent page (tools sub-routes, log-sale from track, etc.), or admin-only. This is fine.

### Issue 4: Current Bottom Nav + Drawer Layout Summary

For reference, here's the current mapping:

```text
PRESEASON (Knocking OFF)
  Bottom Nav:  Home | Tools | Calendar | Goals
  Action:      Leaders -> My Group | Non-leaders -> Training
  Drawer:      Track, Calendar, Insights, Reports (leaders), Training (leaders)
               Compete, My Group*, Customers, AI Assistant
               Settings, Refresh, Logout
  MISSING:     Leaderboard (nowhere)

KNOCKING MODE ON
  Bottom Nav:  
    Leaders:    Home | Tools | Reports | Leaderboard (action: Track)
    Non-leaders: Home | Leaderboard | Tools | Calendar (action: Track)
  Drawer:      Calendar*, Insights, Goals, Training
               Compete, My Group, Customers, AI Assistant
               Settings, Refresh, Logout
  (* = in drawer when not in nav)
```

### Implementation Plan

**File: `src/components/AppDrawer.tsx`**

1. Add Leaderboard link in the preseason (knocking OFF) section, after the existing nav links and before the Compete separator. Show it for all non-pre-blitz users with the Trophy icon:
   ```
   Leaderboard — "See top performers"
   ```

2. Also add Leaderboard in the knocking ON section for leaders (since non-leaders already have it in nav, but leaders with it in nav don't need it — actually leaders DO have it in nav in knocking mode, so only add it for preseason).

3. Lock Compete for pre-blitz rookies: wrap the Compete link with the same lock icon pattern used for Track/Calendar/Insights. Show "Unlocks on first blitz".

4. Lock Customers for pre-blitz rookies: same lock pattern.

### Technical Details

All changes are in `src/components/AppDrawer.tsx` only:

- Use existing `isCalendarLocked` / `isPreBlitzRookie` boolean to gate Compete and Customers
- Add a new `<Link to="/leaderboard">` block in the `!isKnockingMode` section (lines ~286-365), after Insights and before the leader-only Reports link
- For Compete (line ~438): wrap in conditional — if `isPreBlitzRookie`, show locked version; else show normal
- For Customers (line ~479): same conditional lock pattern

No changes to bottom nav layout (`Layout.tsx`), routing (`App.tsx`), or any other files.

