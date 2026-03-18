

## Incentive Race Recap — Strava-style Story for Completed Incentives

### Current State
The completed incentive view shows a static winner spotlight + final standings leaderboard. No narrative, no story of how it played out. For single-day incentives, there's zero intra-day context.

### Plan

#### 1. New hook: `useIncentiveRecap.ts`
Adapts the challenge recap pattern for incentives. Fetches `daily_entries` for all eligible reps across the incentive date range.

**Multi-day logic:**
- Day-by-day values per participant for the incentive metric
- Running totals (cumulative)
- Narrative moments: first to score, lead changes (for `first_to`/`most_by_end`), group milestone crossings (for `group_total`), qualification moments (for `anyone_who`)
- Stats: duration, margin, lead changes, best day performer

**Single-day detection:** If `start_date === end_date`, fetches `counter_timestamps` and `sales_log` (same as `useSingleDayRecap`) to build intra-day moments with the same waterfall logic (sales > closes > transitions > door batches).

#### 2. New component: `IncentiveRaceTimeline.tsx`
For multi-day incentives:
- Sparkline chart showing cumulative progress (top 3-4 participants to avoid clutter, or group total line for `group_total`)
- Vertical timeline of key moments with narrative text
- Adapts to incentive type:
  - `first_to` / `most_by_end`: Shows lead changes like challenge recap
  - `group_total`: Shows group cumulative progress toward target with milestone markers (25%, 50%, 75%, 100%)
  - `anyone_who`: Shows qualification moments ("Calvin qualified!")

#### 3. New component: `IncentiveRecapStats.tsx`
2x2 grid adapted for incentives:
- **Duration**: "5 days"
- **Winner/Result**: "Calvin won" or "3 qualified" or "Goal reached!"
- **Best Day**: "Calvin — 0.8 FP+"
- **Margin** (first_to/most_by_end) or **Group Total** (group_total) or **Qualified** (anyone_who)

#### 4. Reuse `SingleDayRaceTimeline` for single-day incentives
The existing component works generically — it just needs participant IDs and recap data. We'll adapt `useSingleDayRecap` to accept an incentive shape (or extract a shared fetcher).

#### 5. Update `IncentiveDetailSheet.tsx` completed section
Replace the static completed state (lines 358-509) with:
1. Result banner (keep)
2. Winner spotlight (keep, polish)
3. Race timeline — multi-day or intra-day depending on duration (new)
4. Recap stats (new)
5. Final standings leaderboard (keep)
6. Duration metadata (keep)

### Files

| File | Action |
|---|---|
| `src/hooks/useIncentiveRecap.ts` | **Create** — fetch daily entries + intra-day data, compute timeline + stats for incentives |
| `src/components/competitions/IncentiveRaceTimeline.tsx` | **Create** — multi-day timeline with sparkline, adapted for all incentive types |
| `src/components/competitions/IncentiveRecapStats.tsx` | **Create** — 2x2 stat grid for incentives |
| `src/hooks/useSingleDayRecap.ts` | **Modify** — extract shared intra-day fetcher that works for both challenges and incentives (accepts user IDs, date, metric) |
| `src/components/leaderboard/IncentiveDetailSheet.tsx` | **Modify** — integrate recap components into completed state |

### Data Flow
- Multi-day: queries `daily_entries` filtered by eligible rep user IDs and date range (same pattern as challenge recap)
- Single-day: queries `counter_timestamps` + `sales_log` from `daily_entries` (same pattern as single-day challenge recap)
- For `group_total`: aggregates all participants into a single cumulative line toward the target
- For `anyone_who`: tracks each participant's progress toward the qualification threshold

