

## Two Issues to Address

### 1. Weather Not Showing

**Root cause**: The edge function `get-blitz-weather` is invoked via `supabase.functions.invoke()`, but the preview iframe likely blocks `navigator.geolocation` (cross-origin), and when no coordinates are sent, the IP fallback (`ipapi.co`) resolves the *edge function server's* IP (a Deno Deploy server), not the user's IP. This means the function either returns an error or data for the wrong location.

**Fix**:
- In `WeatherStrip.tsx`, when geolocation fails, pass the user's approximate location from their `repData` (if available, e.g. a city field) as a fallback `location` string parameter.
- If no repData location exists, still call the function without coords, but also add better error handling/logging so we can see what's happening.
- The real fix for production (Capacitor/native app) is that `navigator.geolocation` works fine there. For the web preview, we need a client-side IP geolocation fallback *before* calling the edge function, since the edge function only sees its own server IP. We'll add a client-side IP lookup (e.g., `ipapi.co/json/`) as a secondary fallback when browser geolocation fails, then pass those coords to the edge function.

### 2. Activity Card (Week-Over-Week Self-Competition)

**What the user wants**: A card below the daily mission that helps them compete with *themselves* using **current season data** -- comparing this week vs. last week, highlighting streaks, personal bests, and week-over-week trends. This is distinct from "Me vs Me" (which compares this year vs. last year's historical data).

**What exists now**: The `MeVsMeMotivationCard` only compares current season vs. last year's historical data and returns `null` when no historical data exists. There's no week-over-week current-season card.

**Plan**: Create a new `WeeklyActivityCard` component that:
- Queries `daily_entries` for the current week (Sun-Sat) and the previous week
- Compares key metrics: FP+ (or EFP), doors, pitches, presentations, closes, hours worked
- Shows a motivational message like: "Up 2 doors vs last week" or "3-day streak -- keep it going"
- Falls back gracefully if it's the user's first week (shows current week stats only)
- Styled consistently with the other cards (same `bg-card border-border/50 rounded-xl` pattern)
- Placed in `PreWorkingState` between `DailyMissionCard` and `SeasonGoalsPreview`

**Technical approach**:
1. Create `src/hooks/useWeeklyComparison.ts` -- queries `daily_entries` for current + previous week, computes deltas
2. Create `src/components/track/WeeklyActivityCard.tsx` -- renders the comparison with appropriate icons/colors
3. Update `PreWorkingState.tsx` to include the new card
4. Keep `MeVsMeMotivationCard` as-is (it handles historical year-over-year when data exists)

