## Analysis

Two distinct issues identified:

### Issue 1: Planning adoption problem

The day-planning feature is buried and disconnected from the core experience. Reps don't realize planning days directly affects their pace calculations. Without planned days, daily pace numbers are meaningless. New reps onboarding soon won't encounter planning as part of their setup.

### Issue 2: App overstepping leadership role

Currently, the app directly tells reps their pace is "aggressive" or "very ambitious" and suggests they reconsider goals or add more days. This happens in:

- `**DailyMissionCard.tsx**` (Track page): "Pace looks aggressive... Consider planning more work days or adjusting your goal" with a tap to self-adjust
- `**learningCurveData.ts**`: Pace context messages like "very-ambitious" shown on Goals page
- `**GoalHeroRing.tsx**`: Shows stretch goal suggestions, "can add more days" prompts
- `**WhatIfScenarioDrawer.tsx**`: Self-service "What If" scenario planning
- `**InsightsSummaryHero.tsx**`: Stretch goal suggestions in insights

The user wants: **when a rep's goals look unrealistic, notify the LEADER, not the rep.** The leader then decides whether to intervene, and can "unlock" a goal recalibration flow for that specific rep.

---

## Plan (Tackle Issue 2 first — most impactful, prevents harm)

### A. Remove/soften direct goal-change suggestions to reps

`**src/components/track/DailyMissionCard.tsx**`:

- Remove the "Pace looks aggressive" warning block entirely (lines 179-199). The rep should see their daily target without the app second-guessing their leader's plan.

`**src/utils/learningCurveData.ts**`:

- Keep paceContext calculations (leaders need them), but remove the `very-ambitious` messaging that implies the rep should lower expectations. Replace with neutral encouragement.

`**src/components/goals/GoalHeroRing.tsx**`:

- Remove `suggestStretchGoal` prompts and "add more days" nudges from the rep-facing UI. Keep the progress ring and pace data clean.

### B. Create leader-facing "Goal Attention" alerts

**New: `src/components/reports/v2/GoalAttentionAlerts.tsx**`

- In the Goal Pace section of Reports V2 (leader view), surface a prominent alert card when reps have goals requiring a daily pace significantly above their historical average (ratio > 1.5x, i.e., what was `very-ambitious`)
- Show: rep name, their daily needed vs their avg, and a "Review" button
- The "Review" button opens the rep's goal card with context. It will show their goals (preseason/must do/will do/could do and show a preview of planned days kind of like what the user has on the goals page for the calendar preview. There it shows the same gradient for good days and slow days and shows remaining planned day count as well as current pace and needed pace with the amount of planned days and highlight the ambitious pace needed

**Extend `GoalPaceDrawer.tsx**`:

- Add a visual indicator on rep cards where pace is unrealistic (e.g., a small flame/warning icon)
- Add an action button: "Suggest Goal Review" — this writes a flag to the rep's `rep_goals` row (new column `goal_review_requested_by` UUID, `goal_review_requested_at` timestamp)

### C. Leader-gated goal recalibration flow for reps

**Database migration**: Add two columns to `rep_goals`:

```sql
ALTER TABLE rep_goals 
  ADD COLUMN goal_review_requested_by uuid,
  ADD COLUMN goal_review_requested_at timestamptz;
```

**Rep-side behavior**:

- When `goal_review_requested_by` is set AND `goal_review_requested_at` is recent, show a gentle banner on the Goals page: "Your leader has suggested reviewing your goals. Tap to update your plan."
- Let's also send a push notification to the rep that takes them to their goals page
- Tapping opens the existing goal setup wizard in edit mode
- Once the rep saves updated goals, clear the `goal_review_requested_by` field

**Leader notification**: Use existing notification infrastructure to alert up to 3 layers of upline when a rep's required daily pace exceeds 1.5x their historical average (checked on goal save or weekly).

### Files to create/modify


| File                                                | Action                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `src/components/track/DailyMissionCard.tsx`         | Remove "Pace looks aggressive" warning block               |
| `src/utils/learningCurveData.ts`                    | Soften `very-ambitious` messaging to neutral encouragement |
| `src/components/goals/GoalHeroRing.tsx`             | Remove stretch goal suggestion UI                          |
| `src/components/reports/v2/GoalAttentionAlerts.tsx` | **Create** — leader-facing alert for unrealistic rep goals |
| `src/components/reports/v2/GoalPaceDrawer.tsx`      | Add "Suggest Goal Review" action on rep cards              |
| `src/pages/Goals.tsx`                               | Show leader-requested review banner when flagged           |
| Database migration                                  | Add `goal_review_requested_by/at` columns to `rep_goals`   |
