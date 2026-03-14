

## Pre-Working State Motivation Improvements

### Current Issues

1. **LeaderboardMiniRow fallback is flat** -- When no catchable competitor exists, it shows "Your season: 67 EFP / See where you stand" which is not motivating. It should always surface competitive context.

2. **DailyMissionCard "This Week" is goal-only** -- Shows remaining weekly target but doesn't leverage week-over-week self-competition or historical comparison. It's a missed motivational opportunity.

3. **MeVsMeMotivationCard is isolated** -- Good year-over-year data but sits as a separate card. Could be folded into the DailyMissionCard's weekly section for a tighter motivational loop.

### Plan

#### 1. Fix LeaderboardMiniRow fallback (make it always competitive)

When `useCompetitorNudge` returns no catchable competitor, improve the fallback hierarchy:

- **If user is leading**: Show "You're leading in X today -- stay on top!" 
- **If someone is ahead but not catchable**: Show "X leads with Y doors today -- close the gap!"
- **If no one is working yet**: Show "Be the first one out there today" or weekly rank context like "You're #3 this week in FP+"
- Last resort: current season total (but frame it competitively, e.g., "#3 on the season with 67 EFP")

This means enhancing `useCompetitorNudge` to also return a "leading" state and a broader fallback from the leaderboard data it already fetches.

#### 2. Enhance DailyMissionCard "This Week" with self-competition

Below the existing "X FP+ over Y days" line, add a compact motivational nudge:

- **If historical data exists (MeVsMe enabled)**: "Same week in 2025: X FP+ -- you're ahead/behind by Y"
- **If no historical but has last week data**: "Last week by [today's day]: X FP+ -- you're ahead/behind by Y"  
- **If neither**: Keep as-is (just the remaining goal)

This folds the `MeVsMeMotivationCard` and `useWeeklyComparison` context directly into the mission card as a single compact line, eliminating the need for a separate card.

#### 3. Remove standalone MeVsMeMotivationCard from PreWorkingState

Since its data will now live inside the DailyMissionCard's "This Week" section, remove it from the card stack to reduce clutter.

### Files to Change

| File | Change |
|------|--------|
| `src/hooks/useCompetitorNudge.ts` | Add leading/rank fallback when no catchable competitor |
| `src/components/track/LeaderboardMiniRow.tsx` | Use new fallback data for motivating copy |
| `src/components/track/DailyMissionCard.tsx` | Add week-over-week and historical self-competition line in "This Week" section |
| `src/components/track/PreWorkingState.tsx` | Remove `MeVsMeMotivationCard` import and render |

### Motivational Copy Examples

**LeaderboardMiniRow (new fallbacks):**
- Leading: "You're #1 in presentations today -- keep it up!"
- Behind broadly: "Jake has 42 doors already today"  
- Weekly: "You're #3 this week with 4.2 FP+"
- No data: "Be first on the board today"

**DailyMissionCard "This Week" addition:**
- Historical: "Same week 2025: 3.1 FP+ -- you're +1.2 ahead"
- Week-over-week: "Mon-Wed last week: 2.8 FP+ -- you're at 3.1"
- Both show as a single compact line with green/red indicator

