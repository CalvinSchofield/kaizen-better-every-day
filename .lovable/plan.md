

# Season Heatmap: GitHub-Style Production Calendar

## Overview
Replace the current single-month mini calendar inside the `CalendarPlanningPreview` card with a full-season GitHub-style contribution heatmap. This gives reps an instant visual of their entire season's production -- when they were hot, cold, or resting -- all in one glance.

## How It Works

The heatmap spans from **Season Start (Sept 28, 2025)** to **Season End (Sept 27, 2026)**, laid out as a grid of small squares organized by week (columns) and day-of-week (rows), exactly like the GitHub contribution graph.

### Color Logic
Each day's square color is determined by comparing that day's actual production (FP+ or EFP) against the **pace target for that date's season context**:

- **Preseason dates** (before personal summer start): compared against preseason daily pace
- **Summer dates** (after personal summer start): compared against the focused tier's (Must/Will/Could Do) summer daily pace

Color scale (5 levels):
1. **White/empty** -- future planned work day (no data yet)
2. **Gray** -- off day (not planned, Sunday, or excluded)
3. **Light green** -- worked but below daily target
4. **Medium green** -- hit or slightly exceeded daily target (100-149%)
5. **Dark green** -- crushed it (150%+ of daily target)

### Special States
- **Today**: ring/border indicator
- **Future off days**: subtle gray background
- **Future work days**: white/empty (ready to be filled)

### Month Labels
Month abbreviations run along the top, aligned to the first week column that starts each month.

## Component Architecture

### New Component: `SeasonHeatmap.tsx`
A standalone, reusable component in `src/components/goals/` that:
- Accepts season start/end dates, daily entries, planned days, off days, daily pace targets (preseason + summer per tier), and the focused tier
- Generates a week-column x 7-row grid from season start to season end
- Calculates intensity per cell based on production vs. pace
- Renders compact squares with appropriate colors
- Horizontally scrollable on mobile with month labels fixed at top
- Shows a tooltip or small overlay on tap with that day's stats (FP+ produced, target, date)

### Modified: `CalendarPlanningPreview.tsx`
- Remove the existing single-month mini calendar grid
- Insert the new `SeasonHeatmap` component in its place
- Keep the collapsible card structure, header, hero weekly stat, What-If CTA, and "Plan Days on Calendar" button exactly as they are
- Pass required data: all daily entries for the season range, planned days, season config dates, pace targets, active tier

### Data Requirements
- **Daily entries**: query all entries from season start (2025-09-28) to today (already available via `all-daily-entries` query pattern)
- **Planned work days**: already available via `usePlannedDays` hook
- **Season config**: already fetched (personal_summer_start, personal_summer_end, excluded_summer_days)
- **Pace targets**: calculated from existing goals data (preseason daily goal + summer tier daily goals)

## Technical Details

### Heatmap Grid Generation
```
For each week from season start to season end:
  For each day (Sun-Sat):
    - Calculate the date
    - Look up daily_entries for that date
    - Determine if preseason or summer based on personal_summer_start
    - Compare production to the appropriate daily pace target
    - Assign intensity level (0-4)
```

### Responsive Design
- The grid will be wrapped in a horizontally scrollable container on mobile
- Each square will be approximately 10-12px with 2px gaps
- ~52 weeks across fits well in a scrollable mobile view
- Day-of-week labels (S, M, T, W, T, F, S) fixed on the left side

### Color Palette (following existing design system)
- Level 0 (no work / off): `bg-muted/30` (gray)
- Level 1 (below pace): `bg-emerald-200 dark:bg-emerald-900`
- Level 2 (near pace): `bg-emerald-400 dark:bg-emerald-700`
- Level 3 (at/above pace): `bg-emerald-500 dark:bg-emerald-600`
- Level 4 (crushed it): `bg-emerald-700 dark:bg-emerald-400`
- Future planned: `bg-background` (white/dark surface)
- Future off: `bg-muted/20`

### Legend
A small legend row below the heatmap: "Less" [gradient squares] "More" -- similar to GitHub's.

### Files to Create
- `src/components/goals/SeasonHeatmap.tsx`

### Files to Modify
- `src/components/goals/CalendarPlanningPreview.tsx` -- swap mini calendar for SeasonHeatmap, fetch full-season daily entries instead of current-month-only

