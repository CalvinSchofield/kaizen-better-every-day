

## Merge Home into Track Pre-Working State + Nav Redesign

### Overview
Consolidate the knocking-mode Home into the Track page's pre-working state, making Track the app's root in knocking mode. Enhance the pre-working state with weather details, leaderboard context, MeVsMe comparison, and an expandable season chart. Reconfigure the nav bar.

### Nav Bar Changes (`src/components/Layout.tsx`)

**Leaders knocking mode:** Leaderboard, Tools, Reports, Competitions (action: Track)
**Rookies/non-leaders knocking mode:** Leaderboard, Tools, Competitions, Goals (action: Track)

Home tab removed for both. Track becomes the `/` route during knocking mode.

### Route Change (`src/pages/Home.tsx` or routing logic)
When knocking mode is on, `/` renders the Track page instead of `KnockingModeHome`. The simplest approach: in `Layout.tsx` or the router, redirect `/` to `/track` in knocking mode, OR render `TrackPage` at `/` conditionally.

### Weather Enhancement

**Edge function update (`supabase/functions/get-blitz-weather/index.ts`):**
- Add `sunset` to the Open-Meteo API request (`daily=...sunset`)
- Add `hourly=precipitation` for rain timing detection
- Return `sunset` time and `rainAt` (first hour with precipitation > 0) in the response

**New component: `src/components/track/WeatherStrip.tsx`**
- Compact horizontal strip (not a full card) shown in PreWorkingState
- Displays: weather emoji, high/low, condition text, sunset time, rain alert if applicable
- Example: `☀️ 72° / 58° · Sunset 6:34pm · 🌧 Rain at 3pm`
- Reuses the existing weather cache logic from `KnockingModeWeatherCard`
- Always visible in pre-work state (no time-of-day gating since this IS the home now)

### Daily Mission Card Enhancement (`src/components/track/DailyMissionCard.tsx`)
- Add a single-line MeVsMe comparison below the "This Week" section
- Format: `"vs Last Friday: +1.2 EFP ahead"` or `"vs Last Week: -2.3 EFP behind"`
- Logic: compare apples-to-apples (blitz week vs last blitz week, regular day vs same weekday, this week vs last week)
- Uses existing `useHistoricalComparison` hook data
- Subtle styling — just a line of text with a trend icon, not a separate card

### Season Goals → Expandable with Chart (`src/components/track/SeasonGoalsPreview.tsx`)
- Make the card tappable to expand/collapse
- When expanded, render `FPCumulativeChart` inline below the progress bar
- Add a subtle chevron indicator and "Tap for details" hint
- Collapsed by default — keeps the pre-work view clean

### Leaderboard Context (inline in PreWorkingState)
- Add a compact leaderboard row between SeasonGoals and Competitions
- Reuse `LeaderboardCTA` logic but render as a simple tappable row
- On tap, navigate to `/leaderboard` with the relevant time filter
- No new component needed — import `LeaderboardCTA` directly into PreWorkingState or create a thin `LeaderboardMiniRow` wrapper

### Competitions Preview (`src/components/track/CompetitionsPreview.tsx`)
- Update to always render (currently returns `null` when no active competitions)
- Empty state: show card with "No active competitions" + "Create a Challenge" CTA button
- This encourages usage even when nothing is live

### PreWorkingState Composition (`src/components/track/PreWorkingState.tsx`)
New card order:
1. Greeting header (existing)
2. **WeatherStrip** (new — compact, not a card)
3. **DailyMissionCard** (existing + MeVsMe line added)
4. **SeasonGoalsPreview** (existing, now expandable with chart)
5. **LeaderboardCTA** (moved from Home, compact row)
6. **CompetitionsPreview** (existing, with empty state)
7. **Start My Day** button (existing, sticky bottom)

Props: PreWorkingState will need `repData` passed in (for weather, leaderboard) — update `TrackPage` to pass it.

### Files to Change
1. **`supabase/functions/get-blitz-weather/index.ts`** — Add sunset + hourly precipitation to API call and response
2. **`src/components/track/WeatherStrip.tsx`** — New compact weather display
3. **`src/components/track/DailyMissionCard.tsx`** — Add MeVsMe comparison line
4. **`src/components/track/SeasonGoalsPreview.tsx`** — Make expandable with FPCumulativeChart
5. **`src/components/track/CompetitionsPreview.tsx`** — Add empty state with CTA
6. **`src/components/track/PreWorkingState.tsx`** — Compose all new sections, accept repData prop
7. **`src/components/Layout.tsx`** — Update nav items for knocking mode (remove Home, add Competitions/Goals)
8. **`src/pages/Track.tsx`** — Pass repData to PreWorkingState
9. **Route config** — Make `/` render Track in knocking mode (redirect or conditional render)

