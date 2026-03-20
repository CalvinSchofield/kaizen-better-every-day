

# Badges & Achievements System

## Summary

Build a gamified badge/achievement system that awards badges based on daily entries, streaks, and milestones. Badges appear as small icons overlaid on avatars throughout the leaderboard, and are showcased on profile pages. We'll start with placeholder emoji icons and titles — you can upload custom SVGs later.

## Badge Categories

### Milestone Badges (auto-awarded from daily_entries data)
- **Daily FP+ clubs**: 2, 3, 4, 5, 6, 7, 8, 9, 10 FP+ in a single day
- **Weekly FP+ clubs**: 10, 15, 20, 30, 40 FP+ in a week
- **Weekly PRMR clubs**: $1700, $2550, $3400 PRMR in a week
- **Season clubs** (payscale tiers): 20, 40, 60, 80, 100, 120, 140, 160, 200, 220, 240, 260, 300, 350, 400, 450, 500, 550, 600 FP+

### Streak Badges
- **Transition streak** (rookies): consecutive days with ≥1 transition (3, 5, 7, 10, 14, 21, 30 days)
- **Presentation streak** (rookies): consecutive days with ≥1 presentation
- **Sales streak**: consecutive days with ≥1 close (3, 5, 7, 10, 14, 21 days) — no freeze allowed
- **Multi-sale streaks**: consecutive days with 2+, 3+, 4+ closes

### Special / Hidden Badges (revealed only when earned)
- **First Door Magic** 🪄: selling after knocking exactly 1 door
- **Night Owl** 🦉: making a sale with a door knocked after 9 PM
- **First Blood** 🩸: first sale on your team for a summer day
- **1-2 Combo** 🥊: FP+ and upgrade sale in the same day
- **Upgrade Assassin** 🗡️: ≥1 FP+ worth of upgrades in a day (upgrade_prmr ≥ 85)

### Competition Badges (manually awarded later)
- Dream Team, The Cup, The Viper, Sevens, Premier League — placeholder definitions, you'll define criteria later

### Streak Freezes
- **Transition streak**: freeze if ≥80 doors knocked that day
- **Presentation streak**: freeze if ≥2 transitions that day
- **Sales streak**: NO freeze — true consecutive selling days only

## Database Schema

### New table: `badge_definitions`
Stores the catalog of all possible badges.

```sql
CREATE TABLE public.badge_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,            -- e.g. 'daily_fp_3', 'streak_sales_7', 'first_door_magic'
  name text NOT NULL,                    -- display name
  description text,                      -- how to earn it
  category text NOT NULL,                -- 'milestone', 'streak', 'special', 'competition', 'club'
  icon_url text,                         -- future SVG URL, null for now
  icon_emoji text DEFAULT '🏅',          -- temporary placeholder
  rarity text DEFAULT 'common',          -- 'common', 'rare', 'epic', 'legendary'
  is_hidden boolean DEFAULT false,       -- hidden until earned
  sort_order integer DEFAULT 0,
  rookie_only boolean DEFAULT false,     -- only awardable to rookies
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.badge_definitions ENABLE ROW LEVEL SECURITY;
-- Everyone can read badge definitions
CREATE POLICY "Anyone can view badge definitions" ON public.badge_definitions FOR SELECT TO authenticated USING (true);
```

### New table: `user_badges`
Tracks which badges each user has earned.

```sql
CREATE TABLE public.user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  badge_id uuid NOT NULL REFERENCES public.badge_definitions(id) ON DELETE CASCADE,
  earned_at timestamptz DEFAULT now(),
  entry_date date,                       -- the day the achievement happened (if applicable)
  metadata jsonb DEFAULT '{}',           -- e.g. { "value": 5, "streak_length": 7 }
  UNIQUE(user_id, badge_id, entry_date)  -- prevent duplicate awards for same day
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all badges" ON public.user_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can manage badges" ON public.user_badges FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Users can insert their own (for client-side detection)
CREATE POLICY "Users can insert own badges" ON public.user_badges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
```

### Seed badge definitions
Insert all badge definitions (~50-60 rows) via migration with the categories above.

## Implementation Plan

### 1. Database migration
- Create `badge_definitions` and `user_badges` tables
- Seed all badge definitions with slugs, names, emojis, rarity, and `is_hidden` flags

### 2. Badge detection hook: `src/hooks/useBadgeDetection.ts`
- Runs on daily entry finalization (or periodically)
- Checks current day's stats against milestone thresholds
- Queries recent `daily_entries` for streak calculations (with freeze logic)
- Queries season totals for club badges
- Inserts new `user_badges` rows for any newly earned badges
- Triggers a celebration toast/confetti on new badge earn

### 3. Badge display hook: `src/hooks/useUserBadges.ts`
- Fetches a user's earned badges joined with `badge_definitions`
- Returns sorted by rarity (legendary > epic > rare > common)
- Returns `topBadges(userId, count)` for the 1-2 most impressive to show on leaderboard avatars

### 4. Leaderboard avatar badges: `src/components/leaderboard/UnifiedRaceSection.tsx`
- Extend `RankedEntry` to optionally include `topBadges: { emoji: string; name: string }[]`
- Render 1-2 small badge icons positioned around the avatar (bottom-left, bottom-right)
- Subtle, not overwhelming — small rounded circles with the emoji

### 5. Profile badges section: `src/pages/Profile.tsx`
- New "Badges" tab or section on the profile page
- Grid of earned badges with name, emoji, earned date
- Hidden badges show as locked/mystery silhouettes until earned
- Tap a badge to see description and when earned

### 6. Bulk leaderboard badge query
- In `useExpandedLeaderboard` or a companion hook, batch-fetch top badges for all users in the current leaderboard view
- Query: for each userId in the rankings, get their top 2 badges by rarity
- Pass through to `UnifiedRaceSection`

## Files to Create/Modify

**New files:**
- `src/hooks/useBadgeDetection.ts` — detection logic, streak calc, freeze rules
- `src/hooks/useUserBadges.ts` — fetch & rank badges for display
- `src/components/badges/BadgeIcon.tsx` — renders emoji (now) or SVG (later)
- `src/components/badges/BadgeGrid.tsx` — profile page badge showcase
- `src/components/badges/BadgeDetailSheet.tsx` — tap-to-view badge details
- `src/utils/badgeDefinitions.ts` — slug constants and threshold configs

**Modified files:**
- `src/hooks/useExpandedLeaderboard.ts` — add `topBadges` to `RankedEntry`
- `src/hooks/useTodayLeaderboard.ts` — same
- `src/components/leaderboard/UnifiedRaceSection.tsx` — render badge icons on avatars
- `src/pages/Profile.tsx` — add badges section/tab

## Visual Design (Leaderboard Avatar)

```text
  ┌──────┐
  │avatar│
  │      │
  └──────┘
  🪄  🔥    ← 1-2 tiny badge icons, positioned at bottom corners
```

Each badge icon: 14x14px circle with emoji, slight shadow, positioned absolutely relative to the avatar container. Rarity determines border glow (legendary = gold shimmer, epic = purple, rare = blue, common = none).

## Rarity Priority for Display
When picking which 1-2 badges to show on the leaderboard avatar:
1. Legendary (competition winners, 600 club, 10 FP day)
2. Epic (season clubs 300+, 40 FP week, 21+ day streaks)
3. Rare (special/hidden badges, moderate streaks)
4. Common (entry-level milestones)

Within same rarity, prefer most recently earned.

