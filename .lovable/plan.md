

# Rep Profile Page -- Gamified, Premium Mobile Experience

## Overview
Create a dedicated `/profile/:userId` route that serves as a "player card" for any rep. It draws heavy inspiration from the gaming profile references you shared -- a large hero avatar at the top, stats row, tabbed content (Stats, Records, Badges), and a settings gear icon for your own profile. This becomes the central identity hub, reachable from leaderboards, live race rows, challenges, My Group, and the hamburger menu.

## Design Vision

The profile will feel like opening a player card in a competitive mobile game:

- **Hero section**: Large circular avatar with a subtle gradient ring, name, year badge (Rookie/Sophomore/Vet), team name below
- **Stats bar**: 3-4 key numbers in a horizontal row (YTD FP+, PRMR, FP, Upgrade FP+) -- bold values with small labels, similar to the "24 Games | 180 Achievements | 32 Friends" pattern in the reference
- **Tabbed content** below the stats:
  - **Stats tab** (default): Best Day, Best Week, Best Month FP+ records, plus total doors, presentations, transitions YTD
  - **Badges tab** (placeholder): "Coming Soon" with a teaser -- future badges and selling streaks will live here
- **Settings gear** (top-right): Only visible on your own profile, navigates to `/settings`
- **Edit photo** (top-left): Only visible on your own profile, opens the existing `ProfilePhotoDrawer`
- Dark card styling with rounded corners, premium shadows, smooth `framer-motion` entrance animations

## Entry Points

| Location | Trigger | Behavior |
|----------|---------|----------|
| **Hamburger menu avatar** | Tap avatar/name area | Navigate to `/profile/:myUserId` (own profile) |
| **Live Race rows** | Tap a rep's name/avatar | Navigate to `/profile/:theirUserId` |
| **Leaderboard leader cards** | Tap a leader card | Navigate to `/profile/:theirUserId` |
| **Challenge/Incentive avatars** | Tap participant avatar | Navigate to `/profile/:theirUserId` |
| **My Group recruit rows** | Already has detail drawer, add a profile link inside it | Navigate to `/profile/:recruitUserId` |

For the initial implementation, we will wire up:
1. Hamburger menu (own profile)
2. Live Race rows (tap to view)

The rest can be wired incrementally.

## Technical Plan

### 1. New Page: `src/pages/Profile.tsx`

A full-screen page component that:
- Reads `userId` from route params (`/profile/:userId`)
- Fetches rep data for that user: `reps` table (name, year, profile_photo_url, team_leader, recruiter)
- Fetches their team name via `recruits` table join or direct lookup
- Fetches YTD stats via a new lightweight query to `daily_entries` (summing FP+, PRMR from sales_log for the season)
- Fetches personal bests (best day/week/month FP+) reusing the existing `usePersonalRecords` pattern
- Detects if viewing own profile (`currentUserId === params.userId`) to show edit controls

**Layout:**
```
+------------------------------------------+
| [Edit Photo]         [Settings Gear]     |  <- only on own profile
|                                          |
|            (Large Avatar)                |
|           Rep Name                       |
|        [Rookie] badge  |  Team Name      |
|                                          |
|   YTD FP+   |   PRMR   |  Upgrade FP+   |
|    12.5      |  $1,065  |     3.2        |
|                                          |
|  [Stats]  [Records]  [Badges]            |
|  ----------------------------------------|
|  Best Day:  3.5 FP+   Jun 14            |
|  Best Week: 8.2 FP+   Jun 9-14          |
|  Best Month: 12.5 FP+ June              |
|                                          |
|  Season Activity                         |
|  Doors: 1,240  Trans: 89  Pres: 142     |
+------------------------------------------+
```

### 2. New Hook: `src/hooks/useRepProfile.ts`

A focused hook that fetches everything needed for a profile card given a `userId`:
- Rep basic info (name, year, profile_photo_url, team_leader, recruiter)
- Team name (via `teams` table lookup if the user has a team association)
- YTD aggregated stats from `daily_entries` (total FP+, PRMR, upgrade FP+ from sales_log)
- Personal best records (best day/week/month) reusing `usePersonalRecords` logic

### 3. Route: Add `/profile/:userId` to `App.tsx`

- Replace the existing redirect (`/profile` -> `/settings`) with the new profile page
- Keep backward compat: `/profile` without a userId auto-redirects to own profile

### 4. Update `AppDrawer.tsx`

- Make the avatar + name area at the top tappable
- On tap, navigate to `/profile/:myUserId` and close the drawer
- Keep the "Personalize" settings link as-is (it stays in the drawer for direct access)

### 5. Update `LiveRaceSection.tsx`

- Make each rep row tappable (wrap in a link or onClick handler)
- On tap, navigate to `/profile/:userId`
- Exclude navigation for the existing "photo upload" tap target on own row

### 6. Badges Tab (Placeholder)

- Render a "Coming Soon" state with a lock icon and teaser text
- Scaffolded to accept badge data in the future (array of `{ id, name, icon, rarity, earnedDate }`)

## Files Changed

| File | Change |
|------|--------|
| `src/pages/Profile.tsx` | **New** -- Full profile page |
| `src/hooks/useRepProfile.ts` | **New** -- Data fetching hook for profile |
| `src/App.tsx` | Add `/profile/:userId` route, update redirect |
| `src/components/AppDrawer.tsx` | Make avatar tappable to navigate to own profile |
| `src/components/leaderboard/LiveRaceSection.tsx` | Make rep rows tappable to navigate to profile |

## No Database Changes

All data needed (reps, daily_entries, teams) already exists with appropriate RLS policies. The profile page only reads data the user can already access via leaderboards.

