

## Custom Date Range Drawer Redesign

### Overview
Redesign the date preset bar and custom date picker for both **Leaderboard** and **Reports** pages. The preset pills scroll horizontally except "Custom" which stays pinned to the right. The custom drawer becomes a world-class experience with quick-select shortcuts (seasons, weeks, months) and a Google Flights-style inline range calendar.

### Layout Change: Pinned Custom Button

Both pages currently render all presets + Custom in one scrollable row. Change to:

```text
┌─────────────────────────────────────────────┐
│ [Live] [Yesterday] [This Week] ... ←scroll→ │ [📅 Custom] │
│         scrollable area                      │   pinned    │
└─────────────────────────────────────────────┘
```

- Wrap the scrollable presets in a `flex` container with `overflow-x-auto` and `flex-1`
- Custom button sits outside the scroll container with `flex-shrink-0`, separated by a subtle left-border/shadow fade

### New Custom Date Range Drawer

Replace the current clunky two-popover sheet with a single beautiful drawer containing:

**1. Quick Select Section** - Horizontally scrollable chips organized in labeled rows:

- **Seasons**: `Preseason` · `Summer` · `Extension` (computed from `seasonWeekUtils.ts` SEASON_DEFINITIONS for 2026)
- **Weeks**: `Pre W1` · `Pre W2` · ... · `Sum W1` · `Sum W2` · ... · `Ext W1` · ... (scrollable, auto-scrolls to current week). Each chip sets the date range to that Sun-Sat week.
- **Months**: `Oct '25` · `Nov '25` · ... · `Sep '26` (within the 2026 season)

Tapping a chip immediately fills in the start/end dates and highlights on the calendar.

**2. Date Range Header** - Shows selected `Mon, Apr 20` — `Thu, Apr 23` with left/right nudge arrows (like Google Flights). Tapping either date scrolls calendar to that month.

**3. Inline Range Calendar** - Uses `react-day-picker` v8 `mode="range"` with `numberOfMonths={2}` on larger screens, `numberOfMonths={1}` on mobile. Shows range highlighting between selected dates. Disabled dates after today.

**4. Action Bar** - `Reset` link + `Done` button (primary, disabled until valid range selected).

### Season Definition Update

Update `seasonWeekUtils.ts` SEASON_DEFINITIONS to properly define **extension** as a distinct season:
- Summer 2026: Apr 12 — Aug 29 (day before extension start)  
- Extension 2026: Aug 30 — summer end date (Sep 27, 2026)

This is already defined in the file (`extension: new Date(2026, 7, 30)` = Aug 30). The seasons are already correctly structured. Just need to use them for the quick-select chips.

### Files to Modify

| File | Change |
|---|---|
| `src/components/reports/v2/CustomDateRangeDrawer.tsx` | **Create** — new world-class drawer with quick selects + range calendar |
| `src/components/reports/v2/ReportsDateRangeSheet.tsx` | **Delete** or replace with import of new drawer |
| `src/components/leaderboard/LeaderboardFilters.tsx` | Split layout: scrollable presets + pinned Custom. Replace inline Sheet with new shared drawer |
| `src/pages/ReportsV2.tsx` | Split layout: scrollable presets + pinned Custom. Use new drawer component |
| `src/utils/seasonWeekUtils.ts` | Add helper functions: `getSeasonDateRange()`, `getSeasonWeeks()`, `getSeasonMonths()` to generate quick-select options |

### Shared Drawer Component Props

```typescript
interface CustomDateRangeDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  startDate?: Date;
  endDate?: Date;
  onApply: (start: Date, end: Date) => void;
}
```

Both Leaderboard and Reports import and use the same drawer.

### UX Details
- Quick-select chips use warm amber/orange tint when selected (matches app theme)
- Current week/month chip gets a subtle "now" dot indicator
- Calendar range uses the app's primary color for the selected range fill
- Smooth scroll-into-view for the current period in the weeks row
- Drawer height: ~75% of viewport, scrollable content area

