

# Fix Summer Pace Transition — "Launch Pad" Logic

## Problem
When a rep transitions from preseason to summer, the pacing logic should treat summer as a **fresh start**. The summer goal (Must/Will/Could Do) is a standalone target — preseason production served as a "launch pad" and should NOT be measured against the summer goal.

## Current State (Good News)
After investigation, **most of the app already handles this correctly**:

- **GoalsTabView (Team Goals tab)**: Already scopes `currentProgress`, `knockingDays`, and entries to summer-only when a rep is in summer mode (line 298: `seasonStart = personalSummerStart`)
- **`useGoalPaceCalculatorForUser` (Profile/Reports)**: Passes all entries to `calculateGoalPace`, which internally re-scopes knocking days and progress to the active season (lines 183-197 of the unified calculator)
- **`useGoalPaceCalculator` (Track page)**: Same unified calculator, same correct scoping

## The One Bug
**`useDownlineGoalPace.ts`** (used by `GoalPaceCard` on Profile pages) computes `ytdFP` and `knockingDays` from ALL entries since Sept 28 without scoping to the active season. When summer starts, it would pass total preseason+summer knocking days and total progress to `calculateSalesPace`, causing incorrect daily targets and pace status.

## Fix

### File: `src/hooks/useDownlineGoalPace.ts`
- After determining `isPreseason` vs summer, filter entries to only the active season before computing `ytdFP` and `knockingDays`
- When in summer: only count entries from `summerStart` onward
- When in preseason: count entries from `SEASON_START` to `PRESEASON_END`
- This ensures `calculateSalesPace` receives season-scoped inputs, matching how all other calculators work

### Specific change (lines ~60-70):
```typescript
// Scope entries to active season
const activeSeasonStart = isPreseason ? SEASON_START : (summerStart || '2026-04-12');
const seasonEntries = entries.filter(e => e.entry_date >= activeSeasonStart);

// Then compute ytdFP and knockingDays from seasonEntries only
```

This is a ~5-line change in one file. No other files need modification.

