

# Reports Page — World-Class Sales Dashboard Upgrade

## What We're Building
Transform the Reports page from an informational display into an actionable coaching dashboard. Three pillars: **smarter hero with drill-down**, **visual team comparison charts**, and **intelligent coaching alerts**.

---

## 1. Smarter Hero Card with Drill-Down

**Replace `ReportsHeroCard` with an enhanced version:**

- **Tappable FP+ stat** → opens a breakdown drawer showing FP by MGMT Group / Team (bar chart) and a daily sparkline for the period
- **Period-over-period delta** → show "↑12% vs last week" or "↓3% vs last month" with a mini sparkline behind the number (using existing `useTeamInsightsData` comparison logic)
- **Tappable PRMR** → shows avg PRMR per sale, upgrade vs FP breakdown
- **Live view**: Keep working count + ping dot, add "X on pace to beat last week" sentence
- **Aggregated view**: Show per-rep average and total, with the comparison delta always visible

**Files:** Modify `ReportsHeroCard.tsx`, create `HeroDrillDownDrawer.tsx`

---

## 2. Team/Group Comparison Charts (Performance Tab)

**Add three new visual sections to `ReportsPerformanceTab`:**

### a) Group Comparison Bar Chart
- Horizontal bar chart comparing MGMT Groups (for Sr Manager+) or Teams (for MGMT Lead) on FP+
- Each bar shows the group name, FP total, and rep count
- Tappable bars drill into that group's breakdown
- Sorted by FP desc, color-coded (primary for top, muted for rest)
- Falls back to rep-level bars for Team Leads

### b) Period-over-Period Trend
- Side-by-side comparison cards: "This Week vs Last Week" or "This Month vs Last Month"
- Key metrics (FP+, PRMR, Doors, Presentations) with trend arrows and percent change
- A small area chart showing the daily production curve for current vs previous period overlaid
- Uses existing `useTeamInsightsData` — just needs to fetch the comparison period

### c) Goal Pace Tracker (elevated)
- Currently `GoalPaceSection` is a tiny tappable pill — elevate it into a proper card
- Show a stacked horizontal bar: green (on pace), amber (at risk), red (behind), gray (no goals)
- Below the bar: the 3 most urgent "at risk" or "behind" reps with their gap-to-goal
- Tappable to open the existing `GoalPaceDrawer`

**Files:** Create `GroupComparisonChart.tsx`, `PeriodComparisonCard.tsx`, modify `ReportsPerformanceTab.tsx`

---

## 3. Actionable Coaching Alerts

**Upgrade `AlertsHighlights` and surface it prominently on the People tab:**

Currently this component exists but isn't wired into the main Reports page. We'll:

- **Surface it at the top of the People tab** (above the org-grouped list) as dismissible coaching cards
- **Add new alert types:**
  - "Rep X has Y doors but 0 transitions — pitch training needed" (effort without skill)
  - "Team Quinn is Z% ahead of Team Calvin" (competitive comparison)
  - "Rep hasn't started yet today — averaged N FP+ last week" (late start, live view only)
  - "Rep X hit a new personal best this period" (celebration)
- **Each alert is tappable** → opens the RepDrillDownDrawer for that person
- **Smart filtering**: Only show top 3 most actionable alerts to avoid noise

**Files:** Modify `AlertsHighlights.tsx`, wire into `ReportsPeopleTab.tsx`

---

## 4. Wire Everything Together in TeamReports.tsx

- Compute comparison period data (previous week/month) and pass to hero + performance tab
- Pass `groupedByTeam` and `groupedByMgmt` data (already computed in `useTeamInsightsData`) to the new comparison charts
- Pass coaching alert data to People tab
- Add `onRepClick` drill-down handler that opens `RepDrillDownDrawer` from any tappable element

---

## Technical Details

**Data sources — no new queries needed:**
- `useTeamInsightsData` already returns `groupedByTeam`, `groupedByMgmt`, `repBreakdown`, `dailyTrendByTeam`, `dailyTrendByMgmt`
- `useTeamAggregatedRankings` has per-rep stats with team/mgmt group IDs
- `useTeamCumulativeFP` has daily cumulative data
- Goal pace data available via existing `useGoalPaceCalculator` hooks

**New comparison period query:**
- Add a `comparisonDateRange` param to `TeamReports.tsx` that fetches the prior equivalent period
- Use a second `useTeamInsightsData` call with the comparison range (conditionally enabled)

**Files to create:**
- `src/components/reports/v2/HeroDrillDownDrawer.tsx` — FP breakdown by group/team
- `src/components/reports/v2/GroupComparisonChart.tsx` — Horizontal bar chart comparing groups
- `src/components/reports/v2/PeriodComparisonCard.tsx` — This vs last period cards with overlay chart

**Files to modify:**
- `src/components/reports/ReportsHeroCard.tsx` — Add sparkline, deltas, tappable stats
- `src/components/reports/ReportsPerformanceTab.tsx` — Add comparison charts, elevate goal pace
- `src/components/reports/ReportsPeopleTab.tsx` — Surface coaching alerts at top
- `src/components/reports/v2/AlertsHighlights.tsx` — Add new alert types, smart filtering
- `src/components/reports/v2/GoalPaceSection.tsx` — Upgrade from pill to visual card
- `src/pages/TeamReports.tsx` — Wire comparison data, drill-down handlers

