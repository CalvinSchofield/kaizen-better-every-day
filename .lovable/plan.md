

# Reports Dashboard Redesign: World-Class Leadership Intelligence

## What's Wrong Today

The current dashboard is functional but reads like a spreadsheet: an Executive Snapshot card, a collapsible Effort section, and a Skill Gap card. It lacks visual storytelling, color, comparative baselines, and the layered drill-down experience you described. The reference dashboards (Geckoboard, HubSpot, Dear Lucy) use large numbers, colorful charts, visual funnels, and comparative indicators that tell a story at a glance.

## Design Vision

A mobile-first, dark-mode-friendly dashboard with 7 distinct layers, each answering a specific leadership question. Large typography, color-coded cards, baseline comparisons everywhere, and tap-to-drill-down interactions.

---

## Layer 1: Pulse Hero (Top of Page)

**Answers: "Are we producing? Are we on pace?"**

- Full-width gradient card with the team's primary metrics in large display text
- Grid of stat tiles (2x3 on mobile): Doors, DMs, Pitches, Presentations, Closes, FP+
- Each tile shows the number AND a colored delta badge vs baseline (e.g., "+12%" green or "-18%" red)
- Below the grid: PRMR total, Avg Start Time, Avg End Time, Active Hours
- A single-line "pulse sentence" auto-generated: *"Team is 18% behind normal pace for this time of day"* or *"Production is tracking 12% above baseline"*
- Baseline comes from the existing 14-day rolling average already computed in `useReportsV2Data`

## Layer 2: Effort vs Skill Diagnosis Cards

**Answers: "Is the problem work ethic or training?"**

- Two side-by-side cards (stacked on narrow mobile)
- **Effort Card**: Shows avg start time, end time, hours worked, doors knocked, DMs -- each with a colored indicator vs baseline. Overall "Effort Score" as a gauge/ring visual
- **Skill Card**: Shows conversion rates (Pitch→Pres %, Pres→Close %, Close→FP+ %, Rev/Pres) with colored indicators vs baseline
- Tapping either card expands to show per-rep breakdown (reusing existing rep data)

## Layer 3: Visual Sales Funnel

**Answers: "Where are we losing deals?"**

- Horizontal funnel visualization: Doors → DMs → Pitches → Transitions → Presentations → Closes → FP+
- Each stage shows count + conversion % to next stage
- Drop-off stages highlighted in red/orange with the biggest gap called out
- Tap a stage to see which reps are weakest at that conversion
- Replaces the current `MiniWorkflow` and `FunnelProgressIndicator` with a proper visual funnel

## Layer 4: Auto Insights

**Answers: "Why is performance up or down?"**

- AI-generated insight cards (already have `generate-leader-coaching` edge function)
- Presented as a compact card with icon + 1-2 sentence explanation
- Examples: "Sales are down because average start time is 45min later than normal" or "Pitch→Presentation conversion dropped 22%, suggesting transition issues"
- Uses existing constraint analysis + baseline data to generate without AI call when possible, falls back to AI for nuanced insights

## Layer 5: Leaderboards & Recognition

**Answers: "Who's winning?"**

- Horizontal scrollable cards showing top performers:
  - Most FP+ (trophy icon)
  - Highest PRMR (money icon)
  - Most Doors (hustle icon)
  - Best Conversion Rate (target icon)
- Each card shows name, value, and a small spark indicator
- Tap to drill into that rep's detail drawer (existing `RepDrillDownDrawer`)

## Layer 6: Alerts & Highlights

**Answers: "Who needs attention right now?"**

- Dynamic alert cards with colored borders:
  - Hot streak reps (green glow)
  - On pace for personal record (gold)
  - High doors, zero results (red - "stuck")
  - Haven't started yet (gray)
- Reuses existing `StuckRepsAlert` logic and extends it
- Each alert is tappable to drill into the rep

## Layer 7: Rep Archetypes Grid

**Answers: "Who needs coaching vs motivation?"**

- 2x2 grid visualization:
  - **Superstar** (high effort + high skill) - green
  - **Grinder** (high effort + low skill) - blue "needs training"
  - **Assassin** (low effort + high skill) - orange "needs motivation"
  - **At Risk** (low effort + low skill) - red
- Each quadrant shows rep names/avatars
- Tap a quadrant to see the full list with drill-down

---

## Technical Approach

### Data Layer
- **No new database tables needed** -- all data comes from existing `daily_entries`, `reps`, `rep_goals`, and the existing hooks
- `useReportsV2Data` already computes effort scores, funnel data, baselines, and constraint analysis
- Extend it to also compute: per-rep conversion rates, archetype classification, and leaderboard rankings
- Add a `classifyArchetype(effort, skill)` utility function

### New Components (in `src/components/reports/v2/`)
1. `PulseHero.tsx` - Layer 1 stat tiles with baseline comparison
2. `EffortSkillDiagnosis.tsx` - Layer 2 side-by-side cards
3. `SalesFunnel.tsx` - Layer 3 visual funnel
4. `AutoInsights.tsx` - Layer 4 AI insight cards
5. `TopPerformers.tsx` - Layer 5 horizontal leaderboard cards
6. `AlertsHighlights.tsx` - Layer 6 dynamic alerts
7. `RepArchetypes.tsx` - Layer 7 quadrant grid

### Modified Files
- `src/pages/ReportsV2.tsx` - Restructure to render 7 layers instead of 3 sections
- `src/hooks/useReportsV2Data.ts` - Extend return data with leaderboard rankings, archetype classifications
- `src/utils/constraintAnalysis.ts` - Add archetype classification logic

### Date Filtering
- Keep the existing horizontal date preset bar (Today/Yesterday/Week/Month/etc.) -- it's already familiar and matches other pages
- All layers respond to the selected date filter

### Visual Design Principles
- Dark card backgrounds with colored accent borders/gradients
- Large display numbers (text-3xl to text-5xl)
- Color-coded deltas: green for above baseline, red for below, yellow for neutral
- Smooth animations via framer-motion for transitions
- Rounded cards with subtle shadows
- Mobile-first: single column, horizontal scroll for leaderboard cards

---

## Implementation Order

1. **PulseHero** + baseline comparison badges (biggest visual impact)
2. **SalesFunnel** visual (replaces current mini workflow)
3. **EffortSkillDiagnosis** cards (replaces current Effort/Skill sections)
4. **TopPerformers** horizontal leaderboard
5. **AlertsHighlights** dynamic cards
6. **RepArchetypes** quadrant grid
7. **AutoInsights** AI-powered explanations
8. Wire up page layout in `ReportsV2.tsx`

This is a significant rebuild of ~8 new components. I recommend implementing it in 2-3 rounds to keep changes reviewable.

