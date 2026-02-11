

# My Group Interaction Logging Audit -- Fixes and Polish

## Audit Summary

After tracing every contact/logging entry point across the My Group page, the overall architecture is excellent. The PostContactDrawer is the single source of truth for logging, and most paths correctly route through it. However, I found **3 flow bugs** where context is lost or behavior is inconsistent.

## Bugs Found

### Bug 1: Direct Call/Text buttons on task cards lose scheduled activity context
When tapping the Phone or Text icon directly on a SwipeableTaskItem that has a scheduled activity, the `onDirectCall`/`onDirectText` callbacks only pass the `recruit` -- not the associated `activity`. This means the PostContactDrawer opens without knowing there's a pending task, so it **cannot offer "Mark task complete"** or auto-fill the follow-up notes.

**Fix**: Update `SwipeableTaskItem` to pass `activity` in `onDirectCall`/`onDirectText`. Update `WeekPlannerSection` handlers to capture the activity and pass it as `scheduledActivity` to the PostContactDrawer.

### Bug 2: WeekPlannerSection's ContactMethodDrawer ignores `wasConnected`
The `onComplete` callback in WeekPlannerSection's ContactMethodDrawer always dismisses the card, even when the user selected "No Answer". It should only dismiss when the user actually connected.

**Fix**: Change the `onComplete` handler to check the `wasConnected` parameter before calling `onDismiss`.

### Bug 3: PostContactDrawer in WeekPlannerSection missing `scheduledActivity`
The PostContactDrawer rendered in WeekPlannerSection (for direct call/text flows) never receives `scheduledActivity`, so it can't display the "Mark task complete" toggle or pre-fill follow-up notes from the existing task.

**Fix**: Track the associated activity alongside `postContactRecruit` and pass it through.

## All Contact Flow Entry Points (Verified)

| Entry Point | Triggers PostContactDrawer? | Has Activity Context? | Status |
|---|---|---|---|
| Hero "Contact Now" button | Yes (via ContactMethodDrawer) | Yes | OK |
| Swipe right on task card | Yes (via ContactMethodDrawer) | Yes | OK |
| Phone icon on task card | Yes (direct) | NO | BUG 1 |
| Text icon on task card | Yes (direct) | NO | BUG 1 |
| Recruit Detail "Call" button | Yes | No (separate context) | OK |
| Recruit Detail "Text" button | Yes | No (separate context) | OK |
| ContactMethodDrawer method selection | Yes | Yes | OK |

## Files to Modify

### `src/components/mygroup/SwipeableTaskItem.tsx`
- Update `onDirectCall` and `onDirectText` callback signatures to include the optional `activity`
- Pass `activity` in the `handleCall` and `handleText` handlers

### `src/components/mygroup/WeekPlannerSection.tsx`
- Update `handleDirectCall` and `handleDirectText` to accept and store the activity
- Add `postContactActivity` state to track the associated scheduled activity
- Pass `scheduledActivity` to the PostContactDrawer
- Fix ContactMethodDrawer's `onComplete` to respect `wasConnected`

## What's NOT Changing
- No visual redesign needed -- the UI is already clean and well-animated
- No changes to PostContactDrawer itself -- it already handles `scheduledActivity` correctly when provided
- No changes to the RecruitDetailDrawer flow -- it has its own independent PostContactDrawer context
- No changes to the Hero card or ContactMethodDrawer components
- All existing animations, swipe gestures, and haptic feedback remain intact

## Implementation Order
1. Update SwipeableTaskItem callback signatures to include activity
2. Update WeekPlannerSection state and handlers
3. Wire scheduledActivity to PostContactDrawer
4. Fix ContactMethodDrawer wasConnected check

