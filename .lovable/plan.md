## Plan: Data-Driven Coaching Tips from User's Sales Data

### Problem

The CoachingCard currently has limited tips (start time, end time, breaks, bulk entry). It needs more insights derived from the user's actual tracked data, and fixes for two specific issues:

1. When late-hour data doesn't show a lift, still encourage working late (just don't claim false stats)
2. When hourly earnings are < $25/hr, don't highlight the low hourly wage; instead frame it as "one sale in that time could earn you $X" based on their pay tier

### New Data-Driven Tips to Add

**Pass today's counters + salesLog into CoachingCard** so it can generate insights from actual daily data:

1. **Funnel bottleneck detection** — Compare today's conversion rates against the user's own season averages:
  - "You pitched X times but got 0 transitions — your season avg is Y%. Focus on building curiosity tomorrow."
  - "X presentations, 0 closes — your season close rate is Y%. Review your closing approach."
  - Fetch season averages from `daily_entries` (doors, pitches, transitions, presentations, closes aggregated).
2. **Doors-per-hour pace** — Using doors knocked and hours worked today vs their season average doors/hr:
  - "You averaged X doors/hr today vs your season avg of Y. Picking up the pace = more at-bats."
  - Or positive: "Great pace today! X doors/hr, above your Y avg."
3. **Best sales hour insight** — Analyze `sales_log` timestamps across historical entries to find the user's personal best-performing hour:
  - "Your sales tend to happen between 5-7 PM. Make sure you're in your rhythm by then tomorrow!"
4. **Avg PRMR per sale insight** — If today's avg PRMR/sale is notably different from season avg:
  - "Your avg deal today was $X PRMR vs your season avg of $Y. Nice upselling!" or suggest focusing on bigger packages.
5. **Decision maker ratio** — If DMs/doors is low compared to season avg:
  - "Only X% DM rate today (season avg: Y%). Try to qualify better and make sure to spend time with the right people."

### Fixes

**Late-hour tip when data doesn't support FP lift**: Currently the code skips the tip entirely if neither FP nor presentation lift is positive. Change to always show a motivational tip — just use generic encouragement ("More time on doors = more chances. Push to 7 PM tomorrow") instead of making a false data claim.

**Break tip hourly earnings < $25**: Add a branch: if `hourlyEarnings < 25`, calculate what one sale would earn at their pay tier (`avgPrmrPerSale * tier.rate`) and show "One sale could earn you ~$X — that's worth an extra 30 mins knocking!" instead of showing the low hourly rate.

### Implementation

**File: `src/pages/Track.tsx**`

- Pass additional props to CoachingCard: `doors`, `pitches`, `transitions`, `presentations`, `closes`, `salesLog`, `fp`, `prmr`

**File: `src/components/activity-ring/CoachingCard.tsx**`

- Accept new props in interface
- Add a new query `season-funnel-averages` fetching aggregated season data (doors, pitches, transitions, presentations, closes, fp_plus, prmr, sales_log counts) from `daily_entries`
- Add a new query `best-sales-hour` analyzing `sales_log` timestamps across season entries
- Generate ~5 new tip types from the data, prioritized so only the most relevant 3-4 show
- Fix late-hour fallback to always encourage working late
- Fix break tip to check `hourlyEarnings < 25` and use per-sale value instead