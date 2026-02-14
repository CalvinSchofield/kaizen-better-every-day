

# Leaderboard Page Redesign: Clean, Focused, World-Class Mobile UX

## The Problem
The current leaderboard page stacks too many sections vertically -- hero banner, filters, live race list, grit awards (Ironman/Early Bird/Night Owl/Workhorse), timing breakdown table, records collapsible, plus challenges and incentives tabs. It's information overload on a single scroll.

## Design Philosophy
World-class mobile apps (Strava, Nike Run Club, Duolingo) solve this by **progressive disclosure** -- show the most important thing prominently, and let users drill into secondary content on demand. The leaderboard should feel like opening a sports app: you immediately see the race, and everything else is one tap away.

## Proposed Layout

```text
+------------------------------------------+
|  [Hero Banner - Your Highlight]          |
+------------------------------------------+
|  [Live] [Yesterday] [Week] [Month] ...  |  <-- time pills (unchanged)
|                          [All | Rookies] |
+------------------------------------------+
|                                          |
|  RANKED LIST (FP+, PRMR, Doors, etc.)   |
|  - Avatars, gap indicators, animations  |
|  - This is the star of the show         |
|                                          |
+------------------------------------------+
|                                          |
|  HORIZONTAL SCROLL CARDS:               |
|  [Grit Awards] [Active Competitions] [Records] |
|                                          |
|  Each card is a compact preview that     |
|  taps open into a detail sheet/drawer    |
|                                          |
+------------------------------------------+
```

## What Changes

### 1. Rankings stay front and center (no change)
The `UnifiedRaceSection` with metric pills, avatars, gap-to-leader, and animations is the hero content. It stays exactly where it is and gets full attention.

### 2. Collapse Grit Awards, Competitions, and Records into a horizontal "Spotlight" carousel
Instead of stacking Grit Awards, Timing Breakdown, Challenges, Incentives, and Records vertically, present them as **compact preview cards in a horizontal scroll row** below the rankings.

Each card is a small, visually distinct tile (~160px wide) that shows:

- **Grit Awards card**: Shows the top award winner (e.g., "Ironman: Jackson, 8:30am - 9:15pm") with a flame icon. Tapping opens a bottom sheet with the full Grit Awards + Timing Breakdown detail.
- **Active Competitions card**: Shows count of active challenges/incentives (e.g., "3 Active" with crossed swords icon). Tapping navigates to `/compete`.
- **Records card**: Shows a teaser like "You hold 2 records" or "Class record: 14.2 FP+ in a day". Tapping opens the existing Records collapsible content in a bottom sheet.

### 3. Remove the 3-tab layout in Live mode
Currently Live mode has tabs for "Live Race", "Challenges", "Incentives". This fragments the experience. Instead:
- Rankings always show (no tab needed).
- Challenges and Incentives get their preview in the horizontal spotlight row, linking to `/compete` for full management.
- This means the leaderboard page is always about the **leaderboard**, and `/compete` handles the competition hub.

### 4. Keep the hero banner as-is
The personal highlight callout at the top is great motivation. Keep it.

### 5. Non-live timeframes
For non-live views (Yesterday, Week, Month, etc.), the same pattern applies:
- Rankings card with metric pills
- Spotlight row below with Grit Awards + Records (no competitions card since those are live-focused)

## Technical Plan

### Files to modify:

**`src/pages/Leaderboard.tsx`**
- Remove the `Tabs`/`TabsList`/`TabsContent` wrapping for live mode
- Always render `UnifiedRaceSection` directly (no tab container)
- Replace the vertically stacked `GritAwardsSection`, `TimingBreakdownSection`, and `RecordsSection` with a new `LeaderboardSpotlightRow` component
- Remove imports for `ChallengesTab`, `IncentivesTab`, `Tabs` components

**New file: `src/components/leaderboard/LeaderboardSpotlightRow.tsx`**
- Horizontally scrolling row of compact preview cards
- `GritSpotlightCard`: Compact grit award summary, opens `GritAwardsSheet` on tap
- `CompetitionsSpotlightCard`: Shows active challenge/incentive count, navigates to `/compete`
- `RecordsSpotlightCard`: Teaser of personal bests, opens `RecordsSheet` on tap

**New file: `src/components/leaderboard/GritAwardsSheet.tsx`**
- Bottom sheet (using `vaul` Drawer) containing the existing `GritAwardsSection` and `TimingBreakdownSection` content

**New file: `src/components/leaderboard/RecordsSheet.tsx`**
- Bottom sheet containing the existing `PersonalBestsSection` and `ClassRecordsSection` content

**`src/components/leaderboard/RecordsSection.tsx`**
- Keep as-is internally but it will now be rendered inside the sheet instead of inline

**`src/components/leaderboard/GritAwardsSection.tsx`** and **`TimingBreakdownSection.tsx`**
- No changes needed -- they'll just be rendered inside the sheet

### Files removed from leaderboard page (but kept for `/compete`):
- `ChallengesTab` and `IncentivesTab` stay in the codebase for the `/compete` route, just no longer imported in `Leaderboard.tsx`

### Hooks:
- New hook `useActiveCompetitionCount` -- lightweight query that returns count of active challenges + incentives for the current user (for the spotlight card badge)

## Summary of User-Facing Changes
- The ranked list is always visible without tabs -- no more switching between "Live Race" and "Challenges"
- Grit awards, competitions, and records become compact cards you scroll horizontally and tap to expand
- Total vertical scroll reduced significantly
- Competitions link to the dedicated `/compete` page instead of being embedded
- Everything the user loves (avatars, gap indicators, metric pills, grit awards, records) is preserved -- just organized more cleanly
