# Car Wars — Multi-Team Competition

## What It Is

A new competition type alongside 1v1 and Team, where **multiple teams (up to 25)** compete against each other on a metric. One team wins. Think of it as an office-wide battle royale between car groups.

## Database Changes

**1. Expand `challenges.type` constraint**

- Add `'car_wars'` to the allowed values: `CHECK (type IN ('1v1', 'group', 'car_wars'))`

**2. Expand `challenge_participants.team` constraint**

- Currently only `'a'` or `'b'`. Change to allow any single-character or short identifier (e.g., `team_1` through `team_25`)
- Drop the existing CHECK and replace with a more flexible one, or switch to a text field with no constraint (validation in code)

**3. New table: `challenge_teams**`

- Stores team metadata for car_wars challenges (team name, color/number)
- Schema: `id uuid PK`, `challenge_id uuid FK`, `team_label text` (e.g., "Car 1", "Blue Team"), `team_key text` (e.g., "1", "2"... up to "15"), `created_at timestamptz`
- The `challenge_participants.team` column references team_key for car_wars challenges
- RLS: viewable by anyone who can view the challenge, insertable by creator

**4. Expand `challenge_participants.role**`

- Add `'car_captain'` or reuse existing roles. Each car_wars team has one captain (first assigned). Alternatively, keep `captain_a` for the creator's team and use `member` for everyone else, with a separate `car_wars_captain` flag or just track via the `challenge_teams` table.
- Simpler approach: for car_wars, the challenge creator is overall organizer. Each team's first member is that team's captain. Role stays as `member` for all non-creator participants.

## Creation UX (New Wizard Flow)

**Step 1 — Competition Type** (existing screen + new option)

- Add a third card: 🏎️ **Car Wars** / "Multi-team battle"
- Selecting it sets `type = 'car_wars'` and proceeds to Step 2

**Step 2 — Set Up Teams**

- Top section: horizontal scrollable row of team "cards" (Car 1, Car 2, Car 3...)
- **Add Team** button at the end of the row (up to 15)
- Tapping a team card selects it as the "active" team to assign members to
- Below: the participant pool (same search/filter UI already built) with a simple tap-to-assign flow
- Each rep shows which team they're on (colored dot or badge), or "Unassigned"
- Tap an unassigned rep → they join the active team. Tap an assigned rep → remove them
- Each team card shows member count and a mini avatar stack
- Team names are editable (tap the name to rename, defaults to "Car 1", "Car 2", etc.)
- **Minimum**: 2 teams with at least 1 member each

**Step 3 — Metric** (reuse existing)

**Step 4 — Duration, Stakes, Privacy** (reuse existing)

**Step 5 — Review & Send**

- Summary showing all teams with their members
- One-tap send
- Let's use the same logic for down line stuff as before. If I'm creating the car wars and everyone who is participating in the multi team competition is in my down line, then there are no approvals needed to start the car war

## Scoring & Winner Logic

- Each team's score = sum of all team members' metric values over the date range (same as existing group challenge scoring)
- Winner = team with highest aggregate score
- The existing `complete-challenges` edge function will be extended to handle car_wars: iterate all teams, sum per team, determine winner
- `winner_user_id` could store the team captain's user_id, or we add a `winner_team_key` column to challenges for car_wars

## Display / Active View

- Active car_wars challenges show a **leaderboard-style card** with teams ranked by current score
- Each team row: rank, team name, member count, aggregate score
- Tapping expands to show individual member contributions
- Reuses the existing `ActiveChallengesCard` and `CompeteDrawer` patterns

## Files to Create/Edit


| File                                                   | Change                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| `supabase/migrations/new.sql`                          | Add `challenge_teams` table, expand type/team constraints           |
| `src/utils/competitionTypeConfig.ts`                   | Add `'car_wars'` type config                                        |
| `src/hooks/useChallenges.ts`                           | Expand types, creation input, fetch logic for car_wars teams        |
| `src/components/leaderboard/CreateChallengeDrawer.tsx` | Add car_wars option in step 1, new step 2 for multi-team assignment |
| `src/components/compete/CarWarsTeamBuilder.tsx`        | **New** — the multi-team assignment UI component                    |
| `src/components/compete/CarWarsActiveCard.tsx`         | **New** — active car_wars display with team leaderboard             |
| `src/components/CompeteDrawer.tsx`                     | Handle car_wars in the competition list                             |
| `src/components/ActiveChallengesCard.tsx`              | Handle car_wars display                                             |
| `supabase/functions/complete-challenges/index.ts`      | Extend winner logic for multi-team scoring                          |
