# Unified Smart Filter System — Leaderboard & Reports

## Overview

Replace the current fragmented filter system with a single, world-class `UnifiedFilterDrawer` component shared by both Leaderboard and Reports pages. The drawer displays a nested organizational hierarchy, supports multi-select, saved filters, defaults, and respects scope boundaries per page context.

## Key Differences Between Pages


| Aspect                      | Leaderboard                           | Reports                         |
| --------------------------- | ------------------------------------- | ------------------------------- |
| Default scope               | User's office (Yosemite 2026)         | User's highest downline scope   |
| Can expand beyond downline? | Yes — entire org/company              | No — limited to accessible reps |
| AD summer override          | Default = office                      | Default = office                |
| Multi-select                | Yes (multiple offices, teams, groups) | Yes (within downline only)      |


## Architecture

### 1. Backend: Enrich `fetch-team-access` Response

The edge function currently returns flat `mgmtGroups`, `teams`, `accessibleReps`. We need to add:

- `**hierarchy**` — nested tree structure:
  - `offices` (with nested mgmt groups → teams)
  - `srMgmtGroups` (with nested mgmt groups → teams)
  - `regions` / `srRegions` (for regional+ users)
- `**userOfficeIds**` — which offices the user is assigned to (already computed, just not returned)
- `**isAreaDirector**` — boolean flag (already computed, not returned)
- `**srMgmtGroups**` — list of Sr MGMT groups with child mgmt group IDs

This gives the frontend the full tree to render nested filters without additional queries.

### 2. New `UnifiedFilterDrawer` Component

Replaces `SmartFilterDrawer`. Single component used on both pages with a `mode` prop (`'leaderboard' | 'reports'`).

**Filter State Shape:**

```typescript
interface UnifiedFilterState {
  scope: 'all' | 'watchlist';
  yearFilters: string[];           // ['Rookie', 'Sophomore', 'Vet']
  selectedNodes: FilterNode[];      // multi-select hierarchy nodes
  isOrgWide: boolean;              // leaderboard only — view entire company
}

interface FilterNode {
  type: 'office' | 'sr_mgmt_group' | 'mgmt_group' | 'team' | 'region';
  id: string;
  name: string;
}
```

**UI Sections (top to bottom):**

1. **Saved Filters** — chips at top, tap to load, long-press to delete. Persisted to localStorage per page.
2. **Set as Default** toggle — save current filter as the default for this page.
3. **Quick Filters** — Watchlist toggle + Rookie/Sophomore/Vet pills (same as current).
4. **Scope Section** (Leaderboard only) — "My Office" / "Entire Organization" toggle. When "Entire Organization" selected, show all offices/groups from a separate full-org endpoint or the existing `useAllOfficeReps` data.
5. **Hierarchy Tree** — searchable, collapsible, multi-select:
  - **Office** nodes (if user has office access)
    - Nested MGMT Groups
      - Nested Teams
  - **Sr MGMT Groups** (if user is sr_manager+)
    - Nested MGMT Groups
      - Nested Teams
  - **Standalone Teams** (if any aren't nested)
   Each node has a checkbox. Selecting a parent auto-selects children. Deselecting a child removes parent selection and keeps siblings.
6. **Apply Button** — sticky at bottom with count badge showing "Apply (23 reps)".

**Mobile UX Details:**

- Bottom drawer (max 85vh), smooth spring animation
- Collapsible sections with chevron rotate animation
- Search input at top of hierarchy section (only if 5+ nodes)
- Rep count badge on each node
- Indentation via left border + padding (not margin) for clean nesting
- Selected nodes get a subtle primary tint + checkmark

### 3. Reports Page Integration

- Default filter = user's highest scope (all accessible reps). No `teamFilter` state needed — `selectedNodes` replaces it.
- `filteredUserIds` memo: if `selectedNodes` is empty → use `allUserIds`. Otherwise, intersect `accessibleReps` with selected nodes' team/mgmt/office membership.
- AD summer override: detect if user `isAreaDirector` and summer has started → default to office node selected.
- Leader inclusion logic stays the same (only include self if they belong to selected nodes).
- Year filters applied as final intersection (same as current).

### 4. Leaderboard Page Integration

- Default filter = user's office. If no office, fall back to "All".
- For "Entire Organization" mode: the leaderboard hooks (`useExpandedLeaderboard`, `useTodayLeaderboard`) already return all reps — filtering happens client-side by filtering rankings arrays.
- When nodes are selected, filter leaderboard rankings to only include reps whose userId matches the selected teams/groups/offices.
- Watchlist + year filters applied as additional client-side intersections on rankings.

### 5. Default Persistence

- Store default filter per page in localStorage: `filter-default:leaderboard`, `filter-default:reports`.
- On mount, load saved default → use as initial state.
- AD summer override: if `isAreaDirector && isSummerStarted`, force default to office node regardless of saved default (for reports and leaderboard).

## Files to Create/Modify


| File                                              | Action                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `supabase/functions/fetch-team-access/index.ts`   | Add hierarchy tree, officeIds, isAreaDirector, srMgmtGroups to response             |
| `src/hooks/useTeamAccess.ts`                      | Update TypeScript interface for new response fields                                 |
| `src/components/filters/UnifiedFilterDrawer.tsx`  | **New** — replaces SmartFilterDrawer                                                |
| `src/components/filters/HierarchyNode.tsx`        | **New** — recursive tree node component                                             |
| `src/components/filters/SmartFilterDrawer.tsx`    | **Delete**                                                                          |
| `src/pages/Leaderboard.tsx`                       | Use new UnifiedFilterDrawer, update filter state, add client-side ranking filtering |
| `src/pages/ReportsV2.tsx`                         | Use new UnifiedFilterDrawer, replace teamFilter+smartFilter with unified state      |
| `src/components/reports/v2/ReportsTeamFilter.tsx` | **Delete** (no longer needed)                                                       |
| `src/components/mygroup/TeamFilterSheet.tsx`      | Keep as-is (separate use case)                                                      |


## Technical Considerations

- The `fetch-team-access` response already contains `accessibleReps` with `teamId` and `mgmtGroupId` — we can derive which reps belong to which nodes client-side without extra queries.
- For leaderboard org-wide mode, the existing hooks query all finalized daily entries (no user filtering server-side). We just need to pass the full rankings through a client-side filter.
- Summer detection: use global summer start date
- Multi-select filtering: a rep is included if their `teamId` matches ANY selected team node OR their `mgmtGroupId` matches ANY selected mgmt group node OR their team/mgmt is within a selected office.