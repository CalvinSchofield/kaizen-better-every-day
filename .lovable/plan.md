

# Remove Preseason Competition + Redesign Goal Wizard with WHY/WHAT/HOW Flow

## What's Changing

### Part 1: Remove Preseason Prep Leaderboards and Competition

Remove all preseason prep leaderboard components and their supporting hooks from both the rookie and leader experiences. This includes:

**Components to remove:**
- `PreseasonPrepLeaderboard.tsx` (rookie home page)
- `LeaderPreseasonPrepLeaderboard.tsx` (vet/leader home page)
- `PreseasonStandardsCard.tsx` (both rookie and vet home pages)
- `WeeklyProgressPromptCard.tsx` (weekly progress check-in prompt on both home pages)
- `CommitmentsTracker.tsx` (stepper-based progress tracking for books, training, role plays, MNL)
- `TrainingTimer.tsx` (training time tracker used inside CommitmentsTracker)
- `BooksSelectionDrawer.tsx` (book selection UI used inside CommitmentsTracker)

**Hooks to remove:**
- `usePreseasonPrepLeaderboard.ts` (rookie leaderboard data)
- `useLeaderPreseasonPrepLeaderboard.ts` (leader leaderboard data)

**Pages/components to update (remove imports and usage):**
- `Home.tsx` - remove `PreseasonPrepLeaderboard` import and rendering
- `PostBlitzRookieHome.tsx` - remove `PreseasonStandardsCard`, `WeeklyProgressPromptCard`
- `VetHome.tsx` - remove `PreseasonStandardsCard`, `LeaderPreseasonPrepLeaderboard`, `WeeklyProgressPromptCard`

**Cache invalidation cleanup** - remove `preseason-prep-leaderboard` and `leader-preseason-prep-leaderboard-weekly` query invalidations from:
- `useRepGoals.ts`
- `useSyncedBooks.ts`
- `useUpdateRookieStatus.ts`
- `useRecruitActivitiesRealtime.ts`
- `Settings.tsx`

---

### Part 2: Add WHY/WHAT/HOW Steps to Goal Setup Wizard

Restructure the rookie goal wizard from its current flow into a 3-phase journey:

**Current rookie flow (pre-summer):**
1. Monthly Expenses
2. Summer Dates
3. Summer Goals
4. Preseason Goal
5. Commit to Blitzes
6. Review

**New rookie flow (pre-summer):**
1. **YOUR WHY** - Inspirational framing about why goals matter, with a single free-text field: "What's YOUR why?" Short motivational copy to set the tone.
2. **Monthly Expenses** - Same as current (the WHAT begins here)
3. **Summer Dates** - Same as current
4. **Summer Goals (Must/Will/Could Do)** - Same as current, with copy tying back to the WHY
5. **Preseason Goal** - Same as current
6. **Preseason Commitments** - NEW step combining books, training hours/week, role plays, and MNL goals into one clean card-based selection (no granular tracking, just setting the commitment numbers)
7. **Commit to Blitzes** - Same as current
8. **Review** - Updated to show WHY statement + preseason commitments summary

**Key design decisions:**
- The WHY statement gets saved to `rep_goals.purpose_statement` (field already exists)
- Preseason commitments (books goal, training hours goal, role plays goal, MNL goal) are saved during wizard completion alongside financial goals
- No in-app progress tracking for these commitments -- the app will remind them periodically instead
- The commitments step uses simple number selectors (stepper-style +/- buttons) for each category
- Vet flow remains unchanged (Dates, Goals, Preseason, Review) -- no WHY step for vets

**Wizard `onComplete` updates:**
- Add `purposeStatement: string` to output
- Add `booksGoal`, `trainingHoursGoal`, `rolePlaysGoal`, `mnlGoal` to output
- Goals.tsx handler saves these to `rep_goals` on completion

---

### Part 3: Preseason Reminders (Lightweight)

Instead of granular tracking UI, the app will remind rookies of their commitments through the existing notification infrastructure. The commitments remain visible on the Goals page as a simple read-only summary card showing what they committed to (no progress bars, no steppers). During summer, this card hides automatically.

---

## Technical Details

### Files to create:
- None required (wizard changes are in-place)

### Files to delete:
- `src/components/PreseasonPrepLeaderboard.tsx`
- `src/components/LeaderPreseasonPrepLeaderboard.tsx`
- `src/components/PreseasonStandardsCard.tsx`
- `src/components/WeeklyProgressPromptCard.tsx`
- `src/components/goals/CommitmentsTracker.tsx`
- `src/hooks/usePreseasonPrepLeaderboard.ts`
- `src/hooks/useLeaderPreseasonPrepLeaderboard.ts`

### Files to modify:
- `src/components/goals/GoalSetupWizard.tsx` - Add WHY step, add preseason commitments step, update step numbering and `onComplete` payload
- `src/pages/Goals.tsx` - Update wizard completion handler to save new fields; replace CommitmentsTracker with a simple read-only commitments summary card
- `src/pages/Home.tsx` - Remove PreseasonPrepLeaderboard
- `src/components/PostBlitzRookieHome.tsx` - Remove PreseasonStandardsCard and WeeklyProgressPromptCard
- `src/components/VetHome.tsx` - Remove PreseasonStandardsCard, LeaderPreseasonPrepLeaderboard, WeeklyProgressPromptCard
- `src/hooks/useRepGoals.ts` - Remove leaderboard cache invalidation
- `src/hooks/useSyncedBooks.ts` - Remove leaderboard cache invalidation
- `src/hooks/useUpdateRookieStatus.ts` - Remove leaderboard cache invalidation
- `src/hooks/useRecruitActivitiesRealtime.ts` - Remove leaderboard cache invalidation
- `src/pages/Settings.tsx` - Remove leaderboard cache invalidation
