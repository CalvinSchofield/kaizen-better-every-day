

## Problem Summary

From the screenshots:
1. **Reports page has a double title** — Layout header shows "Reports" AND there's an inline `<h1>Reports</h1>` with a filter button below it
2. **Leaderboard** has no filter icon in the header bar — the scope filter (All/Rookies/Watchlist) is inline in the content area, nothing in top-right
3. Both pages need a **unified filter icon** in the top-right of the header bar that opens a **world-class filter drawer**
4. The filter drawer needs to be built as a **scalable foundation** for hundreds/thousands of reps — with saved filters, watchlist toggle, team hierarchy, etc.

## Plan

### 1. Remove duplicate Reports title & move filter to header bar

**`src/pages/ReportsV2.tsx`**:
- Remove the inline `<h1>Reports</h1>` and the `<ReportsTeamFilter>` from the content area (lines 305-316)
- Use `useHeader()` to inject a filter icon button into `customRightContent` that opens the new unified filter drawer
- The Layout header already shows "Reports" via `getPageTitle()`, so removing the inline h1 eliminates the double

### 2. Add filter icon to Leaderboard header bar

**`src/pages/Leaderboard.tsx`**:
- Use `useHeader()` to inject the same filter icon into `customRightContent`
- Opens the same unified filter drawer pattern
- Move the scope filter (All/Rookies/Watchlist) into the drawer instead of inline

### 3. Create a unified `SmartFilterDrawer` component

**`src/components/filters/SmartFilterDrawer.tsx`** — A world-class mobile filter drawer with these sections:

```text
┌─────────────────────────────┐
│  ─── (drag handle)          │
│                             │
│  Filters              Reset │
│                             │
│  ┌─ Saved Filters ────────┐ │
│  │ 🔖 My Rookies          │ │
│  │ 🔖 West Coast Team     │ │
│  │ + Save Current Filter   │ │
│  └─────────────────────────┘ │
│                             │
│  ┌─ Quick Filters ────────┐ │
│  │ 👀 Watchlist Only       │ │
│  │ 🟢 Rookies  ⚪ Sophs   │ │
│  │ ⚪ Vets                 │ │
│  └─────────────────────────┘ │
│                             │
│  ┌─ Teams ─────────────────┐ │
│  │ ▸ All Teams (42)        │ │
│  │ ▸ MGMT Group A (12)    │ │
│  │ ▸ MGMT Group B (15)    │ │
│  │   ▸ Team Alpha (6)     │ │
│  │   ▸ Team Beta (9)      │ │
│  └─────────────────────────┘ │
│                             │
│  [ Apply Filters ]          │
└─────────────────────────────┘
```

Key features:
- **Saved Filters**: Persist named filter combos to localStorage. Users can save/delete/rename. Each saved filter stores: selected team/group, year filter, watchlist toggle
- **Quick Filters**: Watchlist toggle (uses existing `useWatchlist` hook), year-based pills (Rookie/Sophomore/Vet)
- **Team Hierarchy**: Reuse the collapsible MGMT Group → Team → Individual pattern from `TeamFilterSheet.tsx`, with checkboxes for multi-select
- **Active filter indicator**: The filter icon in the header shows a small dot/badge when filters are active (not "all")
- **Search**: Text input at top to search reps by name when the list grows to hundreds

### 4. Wire filter state

- **Leaderboard**: The drawer controls `scopeFilter` (all/rookies/watchlist) + potentially team filtering in the future. For now, map drawer selections back to existing filter state
- **Reports**: The drawer replaces both `ReportsTeamFilter` and the year filter toggle, controlling `teamFilter` and adding year/watchlist filtering

### 5. Files to create/modify

| File | Action |
|------|--------|
| `src/components/filters/SmartFilterDrawer.tsx` | **Create** — unified filter drawer |
| `src/components/filters/SavedFilters.tsx` | **Create** — saved filter management (localStorage) |
| `src/pages/ReportsV2.tsx` | **Edit** — remove double title, use `useHeader()` for filter icon |
| `src/pages/Leaderboard.tsx` | **Edit** — use `useHeader()` for filter icon, wire drawer |
| `src/components/leaderboard/LeaderboardFilters.tsx` | **Edit** — remove inline scope toggle (All/Rookies/Watchlist), keep time pills only |

