

# Watchlist Feature Plan

## Concept
A personal, private watchlist that lets you track specific people's performance throughout the app. Think Nike Run Club's friend activity feed meets a stock market watchlist -- you pick who matters to you and their progress is woven into your daily experience.

## Database

**New table: `watchlist`**
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL) -- the watcher
- `watched_user_id` (uuid, NOT NULL) -- person being watched
- `created_at` (timestamptz)
- UNIQUE constraint on `(user_id, watched_user_id)`
- RLS: users can only CRUD their own rows (`auth.uid() = user_id`)
- No visibility to the watched person (private by design)

## Where It Lives in the App

### 1. Profile Page -- Add/Remove from Watchlist
On someone else's profile (`/profile/:userId`), add an **eye icon button** next to the existing contact bar. Tap to toggle watchlist membership. Filled eye = watching, outline = not watching. Simple, no confirmation needed.

### 2. Pre-Working State (before starting day)
New card: **"Watchlist Pulse"** -- a compact card slotted between LeaderboardMiniRow and CompetitionsPreview showing:
- Avatars of 3-5 watched people who worked yesterday with their FP+ for the day
- "Jake sold 2.1 FP+ yesterday" style one-liner for the top performer
- Tappable to open a Watchlist drawer with full details

### 3. During Tracking (CompetitorNudgeBanner)
Enhance `useCompetitorNudge` to **prioritize watched users** when surfacing "someone is ahead" nudges. If a watched person is close to you on FP+ or PRMR today, they get priority over random competitors. The existing banner already handles display -- just change the data source priority.

### 4. Leaderboard Page
Add a **filter pill** alongside "All" and "Rookies" in the scope filter: **"Watchlist"**. When active, the UnifiedRaceSection only shows people on your watchlist + you. Same ranked list, same metric toggles -- just filtered to people you care about.

### 5. Post-Save Summary (PostSaveSuccessSheet)
After saving your day, add a **"Watchlist Check-in"** section at the bottom showing:
- How you compare to watched users today (ahead/behind on FP+)
- "You beat 3/5 of your watchlist today" or "Jake outpaced you by 1.2 FP+"
- Motivational and competitive without being a full leaderboard

### 6. Sale Notifications
New notification type: **`watchlist_sale`**. When someone on your watchlist logs a sale, you get notified:
- Title: "👀 Jake just sold!"
- Body: "$285 PRMR -- he's now at 2.1 FP+ today (you: 1.5 FP+)"
- Deep link to their profile or leaderboard
- Triggered in the existing sale-logging flow via an edge function

## Implementation Steps

### Step 1: Database migration
Create `watchlist` table with RLS policies (user can only manage their own rows, SELECT requires `auth.uid() = user_id`).

### Step 2: Hook + Profile integration
- `useWatchlist` hook: fetch, add, remove, check if watching
- Add watch/unwatch button on Profile page for non-self profiles

### Step 3: Pre-Working State card
- `WatchlistPulseCard` component showing yesterday's activity of watched users
- Query `daily_entries` for watched user IDs, filter to yesterday, show top performers

### Step 4: Leaderboard filter
- Add `'watchlist'` to `ScopeFilter` type
- Filter leaderboard rankings to only include watched user IDs + current user

### Step 5: Competitor nudge priority
- In `useCompetitorNudge`, fetch watchlist IDs and boost their priority when they appear in today's leaderboard data

### Step 6: Post-save comparison
- In `PostSaveSuccessSheet`, fetch today's entries for watched users and show a comparison row

### Step 7: Sale notification trigger
- New edge function `notify-watchlist-sale` invoked when a sale is logged
- Queries `watchlist` table to find all watchers, sends push notification with sale details and relative standing

## Technical Notes
- Watchlist data is lightweight (just user ID pairs), cached via React Query
- No limit on watchlist size per the spec
- Watched users never see they're being watched (no reverse queries)
- The `daily_entries` RLS already allows viewing finalized entries and recent entries for leaderboards, so watchlist queries work without new policies

