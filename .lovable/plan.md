
# ESPN-Style Competition Hub Overhaul

## Problem
The current Compete page feels sparse compared to world-class sports apps like ESPN. Key gaps:
- **Active challenge cards** show only a tiny score slider with no avatars, no stat comparison, no rich context
- **Active incentive cards** show no participant avatars or progress leaderboard
- **History detail sheets** for completed challenges show **nothing** because `useChallengeProgress` is disabled for completed status -- this is the biggest broken experience
- **History list items** are plain text rows with no avatars or final scores

## ESPN Design Principles to Apply
Drawing from the ESPN screenshots (matchup header, stat comparison bars, season leaders with avatars):
1. **Matchup Hero Header** -- Two avatars facing off with scores prominently displayed (like ESPN's team logo + record layout)
2. **Stat Comparison Bars** -- Side-by-side metric bars showing who dominated each category (like ESPN's Points, Rebounds, etc.)
3. **Participant Avatars Everywhere** -- Faces visible in list items, not just detail views
4. **Clear Result States** -- Win/Loss/Tie badges with color-coded backgrounds
5. **Rich Detail on Tap** -- Completed challenges must show full final scores and participants

---

## Plan

### 1. Fix Completed Challenge Detail (Critical Bug)

The `ChallengeDetailSheet` uses `useChallengeProgress` which is only `enabled` for active/pending challenges. When you tap a completed challenge from history, the progress data is `null` so the sheet shows almost nothing.

**Fix:** For completed challenges, use the `final_value` already stored on `challenge_participants` (fetched by the history hook) instead of trying to compute live progress. Add a dedicated "Completed Matchup" section to `ChallengeDetailSheet` that renders final scores from participant data when `challenge.status === 'completed'`.

### 2. ESPN-Style Active Challenge Cards

Replace the current minimal active challenge card on the Compete page with an ESPN-inspired matchup card:

- **Header row**: Avatar + Name on left, "VS" divider, Avatar + Name on right (like ESPN's team header)
- **Score display**: Large bold numbers beneath each avatar
- **Tug-of-war slider** stays but gets bigger
- **Metric badge** (e.g., "FP+" with icon) prominently shown
- **Time remaining** displayed as a subtle chip
- **Stakes** shown as a callout if present

### 3. ESPN-Style Active Incentive Cards

Upgrade the incentive cards on the active tab:

- Show top 3 participant avatars in a row (with "+N more" overflow)
- Display the leader's current score prominently
- Show a mini progress bar toward the target
- Metric badge with icon
- Prize callout with reward text

### 4. ESPN-Style History List Items

Replace the plain text buttons in `CompetitionItem` with richer cards:

- **Challenge items**: Show both participant avatars face-to-face with final scores between them (e.g., "Adam 12.5 vs Calder 8.3")
- **Incentive items**: Show winner avatar with trophy, prize text
- **Date subtitle** showing when it ended
- **Type badge** stays (1v1, Team, Race, etc.)

### 5. ESPN-Style Completed Challenge Detail Sheet

When tapping a completed challenge from history, show:

- **Hero matchup header**: Two large avatars with final scores, winner gets a crown/trophy overlay
- **Stat comparison section** (ESPN-style bars): If available, show the per-day breakdown or at minimum the final metric values side-by-side with comparison bars
- **Duration info**: "Jan 15 - Jan 17" formatted date range
- **Stakes result**: Who owes what
- **Result banner**: "You Won!" or "You Lost" with appropriate styling

### 6. ESPN-Style Completed Incentive Detail Sheet

When tapping a completed incentive from history, show:

- **Winner spotlight**: Large avatar of winner(s) with trophy animation
- **Final leaderboard**: All participants ranked by final score with avatars
- **Prize claimed** callout
- **Duration and metric info**

---

## Technical Details

### Files to modify:

1. **`src/hooks/useChallengeProgress.ts`** -- Add support for completed challenges by reading `final_value` from participants instead of computing from daily_entries. Change the `enabled` condition to also allow completed status, but use a different data path.

2. **`src/components/leaderboard/ChallengeDetailSheet.tsx`** -- Add a dedicated completed state section that renders final scores from `challenge.participants` data (which already has `final_value`). Build the ESPN-style hero header with avatars and scores. Add stat comparison bars.

3. **`src/components/leaderboard/IncentiveDetailSheet.tsx`** -- Add a completed leaderboard section showing all participants' final rankings with avatars.

4. **`src/pages/Compete.tsx`** -- Redesign the active challenge cards (lines ~287-328) into ESPN-style matchup cards with avatars and prominent scores. Redesign the active incentive cards (lines ~366-399) with participant avatars and progress.

5. **`src/components/competitions/CompetitionHistorySection.tsx`** -- Upgrade `CompetitionItem` component (lines ~183-292) to show avatars, final scores, and richer card layouts instead of plain text buttons.

### Data flow for completed challenges:
- History hook already fetches `challenge_participants` with `final_value` 
- The `Challenge` type's `participants` array already contains `final_value` per participant
- No new database queries needed -- just need to render this existing data properly in the detail sheets

### No database changes required
All the data needed (participant names, avatars, final_value, winner_user_id, etc.) is already fetched by existing hooks. This is purely a UI/UX overhaul.
