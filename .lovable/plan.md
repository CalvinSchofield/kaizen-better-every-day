

# Navigation Deduplication Plan

## Current Duplications by Mode

Here's exactly what's duplicated today:

```text
KNOCKING MODE — Leader
  Nav Bar:   Leaderboard | Tools | [Track] | Reports | Compete
  Drawer:    Calendar, Insights, Goals, Training, ── Compete ──, Customers, AI, Settings
  DUPES:     Compete ✗

KNOCKING MODE — Non-Leader (Rookie/Vet/Soph)
  Nav Bar:   Leaderboard | Tools | [Track] | Compete | Goals
  Drawer:    Calendar, Insights, Goals, Training, ── Compete ──, My Group, Customers, AI, Settings
  DUPES:     Compete ✗, Goals ✗

PRESEASON — Leader
  Nav Bar:   Home | Tools | [My Group] | Calendar | Goals
  Drawer:    Track, Calendar, Insights, Leaderboard, Reports, Training, ── Compete ──, Customers, AI, Settings
  DUPES:     Calendar ✗

PRESEASON — Non-Leader
  Nav Bar:   Home | Tools | [Training] | Calendar | Goals
  Drawer:    Track, Calendar, Insights, Leaderboard, ── Compete ──, My Group, Customers, AI, Settings
  DUPES:     Calendar ✗
```

## Proposed Clean State

**Rule: If it's in the nav bar, remove it from the drawer. The drawer only has items NOT in the nav bar.**

```text
KNOCKING MODE — Leader
  Nav Bar:   Leaderboard | Tools | [Track] | Reports | Compete
  Drawer:    Calendar, Insights, Goals, Training, My Group, Customers, AI, Settings

KNOCKING MODE — Non-Leader
  Nav Bar:   Leaderboard | Tools | [Track] | Compete | Goals
  Drawer:    Calendar, Insights, Training, My Group, Customers, AI, Settings

PRESEASON — Leader
  Nav Bar:   Home | Tools | [My Group] | Calendar | Goals
  Drawer:    Track, Insights, Leaderboard, Reports, Training, Compete, Customers, AI, Settings

PRESEASON — Non-Leader
  Nav Bar:   Home | Tools | [Training] | Calendar | Goals
  Drawer:    Track, Insights, Leaderboard, Compete, My Group, Customers, AI, Settings
```

## What Changes

| Item | Change |
|------|--------|
| **Compete** | Remove from drawer when in knocking mode (it's already in the nav bar) |
| **Goals** | Remove from drawer when non-leader in knocking mode (it's already in the nav bar) |
| **Calendar** | Remove from drawer when in preseason (it's already in the nav bar) |

## Implementation

One file changed: `src/components/AppDrawer.tsx`

1. **Compete section** (lines ~453-490): Wrap in a condition to hide when knocking mode is on (since it's in the nav bar for both leaders and non-leaders in knocking mode)
2. **Goals link** (lines ~416-428, inside knocking mode block): Only show for leaders (non-leaders already have it in the nav bar)
3. **Calendar link** (lines ~303-315, inside preseason block): Remove it (it's in the nav bar for all preseason users)

These are three surgical conditional changes. No nav bar changes needed.

