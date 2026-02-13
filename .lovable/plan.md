

## Unified Leaderboard Redesign: Make Every Timeframe Feel Like Live

### The Problem

The Live Race view is polished and interactive: ranked list with avatars, profile photos, working indicators, framer-motion animations, metric toggle pills, gap-to-leader indicators, and tappable profile navigation. When you switch to Yesterday, This Week, This Month, or any other timeframe, the experience drops to static "winner-only" cards (SalesLeadersSection, ActivityLeadersSection) with emoji icons and no ranked list, no avatars, no profile links, and no animations. It feels like a completely different app.

### The Vision

Every timeframe should use the same ranked-list format as Live Race, just with the "Live" badge and working-indicator removed for historical views. The same metric toggle pills, the same avatars, the same profile navigation, the same gap indicators. One unified component that adapts its data source based on the selected timeframe.

Additionally, the Grit Awards section needs a "Most Hours Worked" upgrade to use **real work time** (from activity ring logic: total duration minus breaks minus idle gaps > 15 min) rather than simple clock-in-to-clock-out minus breaks.

### Architecture

```text
CURRENT FLOW (two separate UIs):
  Live -> LiveRaceSection (useTodayLeaderboard) -> ranked list with avatars
  Other -> SalesLeadersSection + ActivityLeadersSection (useExpandedLeaderboard) -> winner-only cards

NEW FLOW (one unified UI):
  All timeframes -> UnifiedRaceSection -> ranked list with avatars
    Live data source:  useTodayLeaderboard (realtime, working indicators)
    Other data source:  useExpandedLeaderboard (aggregated, returns ranked arrays instead of single winners)
```

### Implementation Plan

**Phase 1: Extend useExpandedLeaderboard to return ranked arrays**

File: `src/hooks/useExpandedLeaderboard.ts`

Currently this hook computes single winners (`mostDoors`, `mostFP`, etc.). We need it to also return the full ranked arrays (like useTodayLeaderboard does) so the unified component can display everyone, not just #1.

- Add a `rankings` field to `ExpandedLeaderboard` interface matching `TodayLeaderboard.rankings` structure (arrays of `{ userId, name, value, profilePhotoUrl, year }`)
- During the existing aggregation loop, collect all user totals into arrays
- Sort each array using the existing `tiebreakerCompare`
- Filter out zero-value entries
- Include `profilePhotoUrl` from reps data (add `profile_photo_url` to the reps select query, which it currently omits)

**Phase 2: Create UnifiedRaceSection component**

File: `src/components/leaderboard/UnifiedRaceSection.tsx` (new)

A single component that renders the ranked list for ANY timeframe. It accepts:
- `rankings`: the metric-keyed ranking arrays
- `currentUserId`: for highlighting
- `isLive`: boolean to show/hide working indicators and live badge
- `filterByYear`: for scope filtering

This component reuses the exact visual patterns from `LiveRaceSection`:
- Metric toggle pills (FP+, PRMR, Presentations, Transitions, Pitches, DMs, Doors)
- Framer-motion AnimatePresence for layout animations
- Avatar with profile photo (tappable to navigate to `/profile/:userId`)
- Rank badges (gold/silver/bronze/numbered)
- Gap-to-leader and gap-behind indicators for the current user
- "You" highlighting with border accent
- Rank change animations (only for live mode)
- Camera icon for current user without photo (only for live mode)
- Working indicator dot (only for live mode)

The key difference from LiveRaceSection: no real-time rank-change tracking for historical views (no polling, no haptics on rank change). Everything else is identical visually.

**Phase 3: Update Leaderboard page to use unified component**

File: `src/pages/Leaderboard.tsx`

- Remove the conditional split between `LiveRaceSection` and `SalesLeadersSection + ActivityLeadersSection`
- For Live: render `UnifiedRaceSection` with `isLive={true}` using `useTodayLeaderboard` data (keeps the Live Race tab + Challenges + Incentives tabs)
- For all other timeframes: render `UnifiedRaceSection` with `isLive={false}` using the new ranked arrays from `useExpandedLeaderboard`
- Keep Grit Awards and Timing Breakdown sections below the unified race for all timeframes
- Remove the separate SalesLeadersSection and ActivityLeadersSection components from the page (they become unused for this page, but keep the files in case they're used elsewhere)

**Phase 4: Real Work Time for "Workhorse" award**

File: `src/hooks/useExpandedLeaderboard.ts`

The current "Workhorse" (Most Hours Worked) calculation uses:
```
totalMinutes = (endTime - startTime) - breaks
```

This doesn't account for idle gaps (> 15 min between activities). The activity ring already classifies gaps > 15 min as idle "Gaps" (gray). We should use similar logic:

- When `counter_timestamps` is available, calculate work time as: sum of all inter-activity intervals where the gap is less than or equal to 15 minutes, plus a small buffer per activity (e.g., 3 min per door knock event representing the actual doorstep time)
- If `counter_timestamps` is empty/missing, fall back to the existing clock-in minus breaks calculation
- This rewards reps who are consistently active throughout their shift rather than those who clock in early, take long idle breaks, and clock out late

### File Changes Summary

| File | Change |
|---|---|
| `src/hooks/useExpandedLeaderboard.ts` | Add `profile_photo_url` to reps query; build ranked arrays for all metrics; add real-work-time calculation for Workhorse |
| `src/components/leaderboard/UnifiedRaceSection.tsx` | **New file** - unified ranked list component adapted from LiveRaceSection |
| `src/pages/Leaderboard.tsx` | Replace conditional Live/Non-live rendering with UnifiedRaceSection for all timeframes |

### What Stays the Same
- Grit Awards section (Early Bird, Night Owl, Ironman, Workhorse) - appears below the race for all timeframes
- Timing Breakdown collapsible - stays below Grit Awards
- Records section collapsible - stays at bottom
- Live Race tab structure (Live Race / Challenges / Incentives tabs) - only for live timeframe
- Filter pills and scope toggle - unchanged
- Hero banner - unchanged

### What Drives Production and Adoption

1. **Visible ranked lists create competition**: Seeing your name at #7 with a gap indicator saying "2.3 FP+ to catch Jackson" is far more motivating than seeing "Jackson: 14.2 FP+" in a winner card
2. **Profile photos and avatars create identity**: When reps see their face on the leaderboard, they take ownership of their rank
3. **Consistent UX builds habit**: The same interaction pattern (tap metric pill, see ranked list, tap name to view profile) across all timeframes means users learn it once and use it everywhere
4. **Real work time rewards hustle, not clock gaming**: The Workhorse award using actual active time (not clock-in to clock-out) incentivizes continuous productive activity and accurate tracking
5. **Gap indicators create urgency**: "0.5 FP+ to catch" is actionable; a static winner card is not

