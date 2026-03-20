

# Smart Activity Targets — Wrap-Around Progress Ring

## Summary

Expand the existing `useSmartActivityGoals` hook to calculate all funnel metrics (doors, DMs, pitches, transitions, presentations) with proper season-aware logic, then add a subtle SVG border-progress ring around each counter card that fills as the rep taps toward their smart goal.

## Season-Aware Data Source Logic

The conversion rate data source depends on season and knocking day count:

```text
PRESEASON:
  Current preseason knocking days >= threshold (18 vets, 24 rookies)?
    YES → use current preseason averages
    NO  → feature hidden (no targets shown)

SUMMER:
  Current summer knocking days >= threshold?
    YES → use current 2026 summer averages
    NO  → has 2025 historical_entries with season_type='summer'?
      YES → use 2025 summer averages as fallback
      NO  → feature hidden
```

Determining "is summer": compare today against user's `personal_summer_start` from `season_config` table. Filter `daily_entries` by `entry_date` before/after that date accordingly.

## Changes

### 1. `src/hooks/useSmartActivityGoals.ts` — Expand to all metrics + season awareness

- Add `doors_knocked`, `decision_makers`, `pitches` to the query select and totals calculation
- Return `suggestedDoors`, `suggestedDMs`, `suggestedPitches` (+ existing transitions/presentations) using `Math.ceil`
- Fetch `season_config.personal_summer_start` to determine current season
- Split query: filter `entry_date < personal_summer_start` for preseason, `>= personal_summer_start` for summer
- Add fallback query to `historical_entries` where `season_type = 'summer'` and `season_year = 2025` when in summer but below threshold
- EFP awareness already exists via `efpModeEnabled` — just apply to all new metrics
- Return a `smartGoalsMap: Record<string, number>` mapping field names (`doors_knocked`, `decision_makers`, etc.) to suggested targets for easy consumption

### 2. `src/components/track/CounterCard.tsx` — Add wrap-around SVG border ring

- New optional `goal?: number` prop
- When `goal > 0`, render an absolutely-positioned SVG overlay with a rounded `<rect>` using `stroke-dasharray`/`stroke-dashoffset` to create a border that fills clockwise
- Use `useRef` + `ResizeObserver` to measure card dimensions for accurate perimeter calculation
- Progress = `Math.min(1, value / goal)`
- Styling: very subtle — `stroke` uses `primary/30` opacity when in progress, transitions to `emerald-500/50` when complete (100%)
- Add a small "3/8" label below the counter label, only when goal exists, using `text-[10px] text-muted-foreground/50`
- `pointer-events: none` on the SVG so it doesn't interfere with taps
- No ring or label shown when no smart goal exists — card looks identical to today

### 3. `src/components/QTallyGrid.tsx` — Pass smart goals through

- Accept new optional `smartGoals?: Record<string, number>` prop
- Pass matching goal to each `CounterCard` via field name lookup
- `closes` field gets no smart goal (it IS the output metric)

### 4. `src/pages/Track.tsx` — Wire up the hook

- Call `useSmartActivityGoals` with `dailyFpGoal` and `isRookie`
- Pass `smartGoals.smartGoalsMap` to `QTallyGrid`

### 5. `src/components/track/SmartTargetsCard.tsx` (new) — Summary on PreWorkingState

- Compact card shown below DailyMissionCard when `hasEnoughData` is true
- Shows a row: "42 doors · 8 DMs · 6 pitches · 3 transitions · 3 presentations"
- Subtitle: "Based on your averages to hit {dailyGoal} {EFP/FP+} today"

