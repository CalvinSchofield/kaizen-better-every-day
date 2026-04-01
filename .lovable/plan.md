# Streak Awareness Touchpoints — UX Audit & Design Plan

## Philosophy

The streak system should feel like Duolingo's: **ambient awareness** throughout the day with **escalating urgency** only when the streak is at risk. The rep should never need to go looking for streak info — it should find them at the right moment, in the right tone.

## The 5 Touchpoints

### 1. PreWorkingState (Morning Briefing) — "Set the tone"

Add a **StreakContextCard** in the card stack (after DailyMissionCard, before SeasonGoalsPreview). This card adapts based on state:

- **Healthy streak**: "🔥 Day 47 — keep it going today" (minimal, confidence-building)
- **Shield used yesterday**: "🔥🛡️ Day 47 — your effort yesterday saved your streak. Let's sell today." (gentle nudge)
- **Recovery window active**: Amber/urgent card — "Your streak is on the line. 2 days to earn it back." No specifics on targets, just urgency + encouragement. ******HEre i think it should show waht is required (show both FP+ requirement and PRMR requireement and how much is remaining) *******
- **No active streak**: Nothing shown (don't remind them of failure every morning)

This is a small, static card — no interaction needed. Just awareness before they start.

**File**: New `src/components/track/StreakContextCard.tsx`, inserted into `PreWorkingState.tsx`

---

### 2. Active Tracking (Counter Grid) — "Real-time effort signal"

During active knocking, when the rep has **0 sales but is approaching protection thresholds**, show a subtle contextual message inside the existing `CompetitorNudgeBanner` slot or as a new slim banner below the time bar:

- When there is only about ~2 hours of knocking left before the typical local end time with 0 sales but strong door count: "No sales yet, but your effort is being noticed 💪" (deliberately vague — they don't know the exact threshold)
- If they've already earned protection mid-day: Nothing changes in the UI. The protection is awarded at finalization, not during tracking. This prevents gaming.

**Key decision**: Do NOT show real-time protection progress. The rep should focus on selling, not on hitting a protection floor. The only signal during tracking is a vague encouragement if effort is high but sales are 0.  
  
****IDEA: maybe this could live inside of the doors knocked counter on the track page instead of yet another thing to add to take up vertical space? wht are the tradeoffs of doing that? instead of showing the last timestamp when the door was knocked in this case when this happens.********

**File**: Update `Track.tsx` to conditionally show a slim effort encouragement banner. Logic lives in a lightweight check (doors > season avg and closes === 0).

---

### 3. Finalized Day (End-of-Day Cards) — "The reveal"

After the day is finalized, this is where streak outcomes are communicated clearly. Add a **StreakOutcomeCard** in the finalized card stack (before GoalResultCard):

- **Sale made, streak continues**: "🔥 48-Day Streak — another one in the books" (celebratory, brief)
- **No sale, protection earned**: "🛡️ Streak Protected — Your effort today earned you a shield. Day 48 continues." (positive framing of a tough day)
- **No sale, no protection, streak broken**: "Your 47-day streak has ended. Put in exceptional work over the next 2 days to earn it back." (no doom, just a path forward) *****HERE Lets define waht would be rquired FP+ OR PRMR to save the streak over the next 2 days
- **Recovery achieved**: "🔥 Streak Restored! Incredible effort." (celebration moment)

This card is the single source of truth for "what happened to my streak today." It replaces the need for a separate notification in most cases.

**File**: New `src/components/track/StreakOutcomeCard.tsx`, inserted into finalized view in `Track.tsx`

---

### 4. Notifications (Push + In-App) — "Timely nudges only"

Notifications should be **sparse and high-signal**. Not every streak event needs a push. Here's the matrix:


| Event                           | In-App Banner        | Native Push                           |
| ------------------------------- | -------------------- | ------------------------------------- |
| Shield earned (at finalization) | Yes                  | No (they'll see the card)             |
| Streak broken                   | Yes                  | Yes (if app is backgrounded)          |
| Recovery window opening         | No (card handles it) | Yes (next morning, before they start) |
| Recovery achieved               | Yes                  | Yes (celebratory)                     |
| Milestone (every 10 days)       | Yes                  | No                                    |


Push notifications use the existing `InAppNotificationBanner` system for foreground and native APNs for background. The notification types would be: `streak_shield_earned`, `streak_broken`, `streak_recovery_open`, `streak_recovery_achieved`, `streak_milestone`.

**File**: Add notification firing logic to `useBadgeDetection.ts` (streak protection detection) and the edge function that sends pushes. Register new notification types.

---

### 5. Profile + Watchlist — "Social proof" (already implemented)

The streak pill on Profile and the fire indicator on Watchlist cards are already in place. One addition:

- On the **Profile streak pill**, if a recovery window is active for the viewed user, show a subtle "recovering" state: "🔥 Streak paused — earning it back" (only visible on your own profile, not others').

**File**: Minor update to `Profile.tsx` streak pill section.

---

## What NOT to Do

- **No streak info on the Leaderboard page**. The leaderboard is about production ranking, not streaks. Mixing the two dilutes both. Streaks live on Profile (personal) and Watchlist (social).
- **No real-time "you're X doors away from protection"** counter. This directly enables gaming. The rep should knock hard because they want to sell, not because they're watching a protection meter fill up.
- **No notification for "streak continues" on a normal sale day**. That's noise. The finalized card handles it.
- **No streak info in the counter grid UI**. The grid is for tapping, not reading. Keep it clean.

## Summary of New/Changed Files

1. `**src/components/track/StreakContextCard.tsx**` (new) — Morning briefing card showing streak state
2. `**src/components/track/StreakOutcomeCard.tsx**` (new) — Finalized day card showing what happened to the streak
3. `**src/components/track/PreWorkingState.tsx**` — Insert StreakContextCard
4. `**src/pages/Track.tsx**` — Insert StreakOutcomeCard in finalized view; add subtle effort encouragement banner in active view
5. `**src/hooks/useStreakProtection.ts**` — Add helper for checking current streak status (healthy/shielded/broken/recovering)
6. `**src/pages/Profile.tsx**` — Add "recovering" state to streak pill
7. `**src/hooks/useBadgeDetection.ts**` — Fire notifications on streak break/recovery events

No database changes needed — all data already exists in `streak_protections`, `streak_recovery_windows`, and `daily_entries`.