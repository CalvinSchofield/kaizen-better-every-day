
# Pre-Working State for Track Page

## Overview

When a rep opens the Track page before starting their day, they'll see a motivating "mission briefing" view that sets them up for success. This view transforms once they tap "Start My Day" into the familiar counter grid.

---

## Visual Design (Mobile-First)

```text
┌─────────────────────────────────────────┐
│                                         │
│   ☀️ Good morning, Quinn                │
│   February 7, 2026                      │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  🎯 TODAY'S MISSION             │   │
│   │                                 │   │
│   │     Hit 0.8 FP+                 │   │
│   │     (preseason pace)            │   │
│   │                                 │   │
│   │  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │   │
│   │                                 │   │
│   │  📊 THIS WEEK                   │   │
│   │  Need 4.2 FP+ to stay on pace   │   │
│   │  (You have 1.1 so far)          │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  🏆 SEASON GOALS                │   │
│   │                                 │   │
│   │  Preseason: 42 FP+              │   │  ← Shows only during preseason
│   │  ━━━━━━━━░░░░░ 28.4 / 42        │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   OR (after summer starts):             │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  🏆 SUMMER GOALS                │   │
│   │                                 │   │
│   │  Must Do    Will Do   Could Do  │   │  ← Tier pills
│   │    [60]       [80]      [100]   │   │
│   │                                 │   │
│   │  Your focus: Will Do (80 FP+)   │   │
│   │  ━━━━━━━━░░░░░ 12.4 / 80        │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │  ⚔️ ACTIVE COMPETITIONS         │   │
│   │                                 │   │
│   │  Quinn vs Ammon — 3.2 to 2.8    │   │
│   │  🎯 Loser buys lunch            │   │
│   │                                 │   │
│   │  🎁 First to 5 FP+ gets $50     │   │
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
│   ┌─────────────────────────────────┐   │
│   │                                 │   │
│   │   [ 🚀 START MY DAY ]           │   │  ← Big CTA button
│   │                                 │   │
│   └─────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Component Architecture

### New Component: `PreWorkingState.tsx`

Located at: `src/components/track/PreWorkingState.tsx`

This component renders when:
- `entry.work_start_time === null` (day not started)
- `entry.is_finalized === false` (not already complete)

#### Props:
```typescript
interface PreWorkingStateProps {
  repData: any;
  onStartDay: () => void;
  isStarting?: boolean;
}
```

### Sub-Components (inside PreWorkingState):

1. **DailyMissionCard**: Shows today's FP+ goal and weekly pace
2. **SeasonGoalsCard**: Preseason or summer tier goals (season-aware)
3. **ActiveCompetitionsPreview**: Compact view of challenges/incentives
4. **StartDayButton**: Large, prominent CTA

---

## Technical Implementation

### 1. Season-Aware Goal Logic (Reuse `useFocusTier`)

The existing `useFocusTier` hook already provides:
- `isUserSummerStarted`: Boolean for preseason vs summer
- `focusTier`: Current focus tier (mustDo/willDo/couldDo)
- `focusTierGoal`: The goal value for the focused tier
- `allTiers`: All three tier values for display

This hook will be used directly in PreWorkingState.

### 2. Daily/Weekly Goal Calculation (Reuse `calculateSalesPace`)

From `src/utils/salesPaceCalculator.ts`, we can get:
- `dailyGoal`: FP+ needed per day to hit the focused goal
- `weeklyGoal`: FP+ needed this week (dailyGoal × remaining days this week)

### 3. Challenges/Incentives (Reuse existing hooks)

From existing hooks:
- `useMyActiveChallenges()`: Active challenges
- `useMyActiveIncentives()`: Active incentives

These will be displayed in a compact format.

### 4. Track.tsx Changes

Update the rendering logic:

```typescript
// Current flow:
// 1. isInitializing → Skeleton
// 2. isPreBlitzRookie → Locked state
// 3. entry.is_finalized → Activity Ring view
// 4. Default → Counter grid

// New flow:
// 1. isInitializing → Skeleton
// 2. isPreBlitzRookie → Locked state  
// 3. entry.is_finalized → Activity Ring view
// 4. !entry.work_start_time → PreWorkingState (NEW)
// 5. Default → Counter grid
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/components/track/PreWorkingState.tsx` | CREATE | Main pre-working view |
| `src/components/track/DailyMissionCard.tsx` | CREATE | Today's mission with daily/weekly goals |
| `src/components/track/SeasonGoalsPreview.tsx` | CREATE | Season-aware goal display |
| `src/components/track/CompetitionsPreview.tsx` | CREATE | Compact challenges/incentives |
| `src/components/track/index.ts` | CREATE | Export barrel file |
| `src/pages/Track.tsx` | MODIFY | Add pre-working state check |

---

## Data Flow

```text
PreWorkingState
    │
    ├── useFocusTier() ─────────────────┐
    │   └── isUserSummerStarted         │
    │   └── focusTier                   │
    │   └── allTiers                    │
    │                                   │
    ├── useRepGoals() ──────────────────┤
    │   └── preseason_fp_goal           │
    │   └── setup_complete              ├──→ DailyMissionCard
    │                                   │    SeasonGoalsPreview
    ├── usePlannedDays() ───────────────┤
    │   └── plannedDays                 │
    │                                   │
    ├── usePreseasonFP() ───────────────┤
    │   └── totalFP                     │
    │   └── knockingDays                │
    │                                   │
    ├── calculateSalesPace() ───────────┘
    │   └── dailyGoal
    │   └── remainingDailyNeeded
    │
    ├── useMyActiveChallenges() ────────┐
    │   └── challenges[]                ├──→ CompetitionsPreview
    ├── useMyActiveIncentives() ────────┤
    │   └── incentives[]                │
    │                                   │
    └── onStartDay() ───────────────────────→ StartDayButton
```

---

## UX Considerations

### Preseason Mode (today < personal_summer_start)
- Show ONLY preseason goal
- Daily need = preseason_goal / planned_preseason_days
- Weekly need = daily_need × days_remaining_this_week

### Summer Mode (today >= personal_summer_start)
- Show all three tier goals with pills
- Highlight the focused tier
- Allow tapping to switch focus tier
- Daily/weekly calculations use the focused tier goal

### No Goals Set Up
- Show a CTA to set up goals (similar to DailyFocusCard behavior)
- Still show challenges/incentives if any exist
- Start Day button still works

### Empty Competitions State
- Don't show the competitions section if no active challenges/incentives
- Keeps the view clean

### Haptic Feedback
- `hapticMedium` on "Start My Day" tap
- Button shows loading state while processing

---

## Motion & Polish

- Subtle fade-in animation on mount (framer-motion)
- Staggered card entrance for premium feel
- Progress bars use existing Progress component
- Tier pills use existing chip styling from DailyFocusCard
- Start button uses `active:scale-[0.97]` for tactile press

---

## Implementation Order

1. Create `src/components/track/` directory structure
2. Build `DailyMissionCard` with pace calculation
3. Build `SeasonGoalsPreview` with tier display
4. Build `CompetitionsPreview` with challenge/incentive summary
5. Compose `PreWorkingState` from sub-components
6. Update `Track.tsx` to conditionally render PreWorkingState
7. Test across preseason/summer reps, with/without goals, with/without competitions
