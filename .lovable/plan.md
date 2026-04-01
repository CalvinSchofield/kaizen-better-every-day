

# Fix Global Badge Rarity + Elevate Sales Streak

## Issue 1: Global badge rarity not showing

**Root cause**: In `BadgeGrid.tsx` line 71, `selectedBadge.id` is used to look up global counts. But when the selected badge is an earned `UserBadge`, its `.id` is the `user_badges` row UUID — not the `badge_definitions` UUID. The `globalCounts` map is keyed by `badge_id` (definition ID).

**Fix**: Use `selectedBadge.badgeId` when the badge is a `UserBadge` (has `badgeId` field), fall back to `.id` for `BadgeDefinition`.

```
File: src/components/badges/BadgeGrid.tsx
Line 70-72: Change to check 'badgeId' in selectedBadge
```

## Issue 2: Move sales streak to a prominent pill at top of profile

Currently the streak lives inside the Badges tab content (lines 384-400 of Profile.tsx). Move it to right below the stats bar (after line 328), rendered as a compact pill/banner that's always visible regardless of which tab is active.

Design: A slim rounded pill below the stats card:
`🔥 46-Day Sales Streak · Only 3 reps have ever gotten this far`

When streak is 0, nothing renders.

## Issue 3: Show sales streak on watchlist cards

Add sales streak data to `useWatchlistDetails` hook and display it as a small fire pill on `WatchedPlayerCard` when the watched user has an active streak > 0.

This requires the watchlist details hook to also fetch each watched user's current streak. To avoid N+1 queries, we'll batch-fetch the most recent daily entries for all watched users and calculate streaks client-side, or more simply add a small `🔥 X` pill next to the user's name if they have any streak badge recently earned.

**Simpler approach**: Fetch each watched user's recent daily_entries in the existing `useWatchlistDetails` query and compute streak client-side. Since watchlists are small (typically < 10 users), this is fine.

## Files to change

1. **`src/components/badges/BadgeGrid.tsx`** — Fix `selectedGlobalCount` to use `badgeId` for earned badges
2. **`src/pages/Profile.tsx`** — Move streak display from badges tab to above the swiper/tabs area as a pill
3. **`src/hooks/useWatchlistDetails.ts`** — Add streak calculation for each watched user
4. **`src/components/leaderboard/WatchlistDrawer.tsx`** — Show `🔥 X` streak pill on cards

