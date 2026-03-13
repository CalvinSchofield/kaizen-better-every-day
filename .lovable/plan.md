

## Problem Summary

Goal progress is shown across **7 different components**, each with its own calculation logic, visual style, and data model:

1. **GoalProgressCard** (Calendar page) — 755 lines, complex catch-up pace, period-based
2. **GoalProgressSection** (Reports drill-down) — D/W/M/Y toggle with segmented bars
3. **RepGoalPaceCard** (Reports overview) — Tier rows with baseline comparisons
4. **RepDailyGoalProgress** (Reports alt) — Simple today + season bars
5. **GoalResultCard** (Track page) — Daily-only, different daily goal calculation
6. **RingGoalProgress** (Activity Ring) — Today/Week/Season bars, different pace calc
7. **SeasonGoalsPreview** (Track page) — Tier pills with simple progress
8. **FocusCard** (My Group recruit view) — Inline progress with avg/need display

These components use different formulas for daily goals, different progress bar styles, different pace terminology, and different color schemes. A leader seeing a recruit's goals in My Group gets a completely different experience than what the recruit sees on their own Goals page.

## Plan: Unified Goal Progress Component

### 1. Create a shared `UnifiedGoalProgress` component

A single, beautiful component that renders goal progress consistently everywhere. It supports two layouts:

- **Compact**: Single-bar inline view for cards, lists, and summaries
- **Full**: D/W/M/Season toggle view for detail drawers and dedicated sections

```text
┌─────────────────────────────────────┐
│  🎯 Goal Progress        Preseason  │
│                                      │
│  Today         2.0 FP+ (+1 live) / 2.4 │
│  ████████████░░░░░░░░░|░░░░░░░░░    │
│  ● Logged  ● Live  --- Expected      │
│                                      │
│  [ Day ] [ Week ] [ Month ] [ Season ]│
└─────────────────────────────────────┘
```

### 2. Create a shared calculation hook: `useGoalPaceCalculator`

Centralizes ALL pace math into one place:
- **Input**: userId, goals, plannedDays, entries, seasonConfig, efpMode
- **Output**: For each timeframe (day/week/month/season):
  - `actual` — production so far
  - `expected` — where they should be (catch-up pace × elapsed planned days)
  - `goal` — total for that timeframe
  - `remaining` — what's left
  - `dailyNeeded` — catch-up pace (remaining / remaining planned days)
  - `weeklyNeeded` — dailyNeeded × 6
  - `status` — ahead / on-track / behind / at-risk
  - `liveFP` — unfinalized today
  - `plannedDaysElapsed` / `plannedDaysTotal`

This hook replaces the duplicated calculation logic across all 7+ components.

### 3. Personalized severity coloring (consistent with What-If)

Uses the same data-driven approach already built for the What-If drawer:
- **Green**: pace ≤ user's actual daily average
- **Amber**: pace up to 50% above average (stretch)
- **Red**: pace > 50% above average (out of reach)
- Falls back to conservative thresholds if no data

### 4. Replace existing components one-by-one

| Current Component | Replaced With | Layout |
|---|---|---|
| GoalProgressCard (Calendar) | `UnifiedGoalProgress` full mode | D/W/M/Season toggle |
| GoalProgressSection (Reports drill-down) | `UnifiedGoalProgress` full mode | Same D/W/M/Season toggle |
| GoalResultCard (Track) | `UnifiedGoalProgress` compact | Day focus |
| RingGoalProgress (Activity Ring) | `UnifiedGoalProgress` compact | Day + Season |
| SeasonGoalsPreview (Track) | `UnifiedGoalProgress` compact | Season focus |
| RepGoalPaceCard (Reports) | `UnifiedGoalProgress` compact | Season with tiers |
| FocusCard goal section (My Group) | `UnifiedGoalProgress` compact | Avg/Need display |
| RepDailyGoalProgress | Deleted (replaced) | — |

### 5. Visual design

The unified component features:
- **Segmented progress bar**: Logged (amber) + Live (rose) segments with a dashed "expected" marker
- **Animated pill toggle** for D/W/M/Season (framer-motion `layoutId`)
- **Tier selector** (summer mode): Must/Will/Could pills in the header
- **Pace context line**: `"Avg 1.8/day | Need 2.4/day"` — consistent everywhere
- **Behind/Ahead badge**: Color-coded using personalized severity
- **Compact mode**: Collapses to a single bar with key stats inline — used in lists and cards

### Technical approach

1. Build `src/hooks/useGoalPaceCalculator.ts` — shared math
2. Build `src/components/goals/UnifiedGoalProgress.tsx` — shared UI
3. Integrate into each surface, replacing old components
4. Delete orphaned components after migration

This is a large refactor touching ~8 files. I'll implement it incrementally, starting with the shared hook and component, then replacing each usage.

