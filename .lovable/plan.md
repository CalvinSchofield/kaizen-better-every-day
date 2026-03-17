

# Use Personal Summer Start for Countdown + Edit Dates from Blitzes Page

## Changes

### 1. Fetch user's `season_config` in `Blitzes.tsx`
Query `season_config` for the current user's `personal_summer_start` and `personal_summer_end`. Use `personal_summer_start` (falling back to global `2026-04-12`) for the countdown. Display the personal end date context too.

### 2. Replace hardcoded `GLOBAL_SUMMER_START` in the "no more blitzes" hero
In the summer countdown section (lines 425-521), replace:
- `const GLOBAL_SUMMER_START = '2026-04-12'` with the user's `personal_summer_start` from `season_config`
- Show "Your Summer Starts" instead of generic "Summer Starts Soon" when they have a personal date set
- Show both start and end dates in the countdown UI

### 3. Add "Edit Dates" button to the summer countdown hero
Add a subtle tap target (pencil icon or "Edit" link) next to the summer dates display. Tapping opens the existing `EditSummerDatesDrawer` component, passing the current user's info (`repData.user_id`, `repData.name`, and current summer dates from `season_config`).

### 4. Wire up `EditSummerDatesDrawer`
- Import and render it in `Blitzes.tsx` with `open` state
- After save, invalidate the `season-config` query key so the countdown updates immediately
- Also invalidate `season-config` in the drawer's success handler (add alongside existing invalidations)

### Technical Detail
- Query: `supabase.from('season_config').select('personal_summer_start, personal_summer_end').eq('user_id', userId).maybeSingle()`
- Wrap in `useQuery` with key `['blitz-page-summer-config', userId]`
- The `EditSummerDatesDrawer` already accepts `{ userId, name, personalSummerStart, personalSummerEnd }` — pass `repData.user_id` as `userId`

