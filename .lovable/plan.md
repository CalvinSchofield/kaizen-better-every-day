

# Reports People Tab — Org-Aware Hierarchical Grouping

## Problem
The People tab on Reports shows reps in flat performance-category buckets (Outstanding / Working / Need Attention). There's no organizational grouping — a Regional, Sr Manager, MGMT Lead, and Team Lead all see the same flat list. It doesn't match the Structure tab and becomes unwieldy for leaders with 40+ reps.

## Design
Group reps by their **formal org hierarchy** (MGMT Group > Team > Individual), adapting the nesting depth to the viewer's access level:

```text
Team Lead sees:
┌─────────────────────────────┐
│ ★ Outstanding (3)           │
│   Rep A — 2.0 FP+           │
│   Rep B — 1.0 FP+           │
│ ⚡ Working (5)              │
│   Rep C — 24 doors          │
│ ⚠ Need Attention (1)        │
│   Rep D — Low pitch rate     │
└─────────────────────────────┘
  (Unchanged — no nested groups needed)

MGMT Group Lead sees:
┌─────────────────────────────┐
│ Team Quinn (8)     12.5 FP+ │
│  ├ ★ Rep A — 3.0 FP+       │
│  ├ ⚡ Rep B — 40 doors      │
│  └ ⚠ Rep C — Low pitch     │
│ Team Calvin (6)     8.0 FP+ │
│  ├ ★ Rep D — 2.0 FP+       │
│  └ ⚡ Rep E — 18 doors      │
└─────────────────────────────┘

Sr Manager / AD / Regional sees:
┌─────────────────────────────┐
│ ▼ MGMT Group Gunnar (14) FP│
│   Team Quinn (8)   12.5 FP+ │
│    ├ Rep A — 3.0 FP+        │
│    └ Rep B — 40 doors       │
│   Team Calvin (6)   8.0 FP+ │
│    └ Rep D — 2.0 FP+        │
│ ▼ MGMT Group Joe (10)   FP │
│   Team Sarah (5)    ...      │
│   Team Mike (5)     ...      │
└─────────────────────────────┘
```

Key behaviors:
- **Team Lead**: Keep existing category-based view (Outstanding/Working/Attention) — their scope is small enough
- **MGMT Group Lead**: Group by Teams within their group, sorted by team FP desc
- **Sr Manager+**: Group by MGMT Group > Team, collapsible at both levels
- **Area Director**: Same as above but includes all reps assigned to their office(s)
- Performance badges (Outstanding star, Attention warning) appear inline on each rep row regardless of grouping level
- Aggregate stats (FP+, PRMR, rep count) roll up to each group header
- Search filters across all levels
- Sort dropdown still works, applied within each group

## Plan

### 1. Create `OrgGroupedRepList` component
New component `src/components/reports/OrgGroupedRepList.tsx` that:
- Accepts reps with their `teamId`, `teamName`, `mgmtGroupId`, `mgmtGroupName` (already available from `accessibleReps`)
- Accepts `accessLevel` to determine grouping depth
- Accepts the org `hierarchy` object from `useTeamAccess` to resolve group membership
- Builds a nested tree: MGMT Group > Team > Rep
- Renders collapsible sections with aggregate stats at each level
- Preserves the performance categorization as inline badges/indicators on each rep
- Includes search bar and sort controls

### 2. Enrich rep data with org IDs
In `useTeamLiveData` and `useTeamAggregatedRankings`:
- `useTeamLiveData` already resolves `teamId`, `teamName`, `mgmtGroupName` from the team-access cache — also add `mgmtGroupId`
- `useTeamAggregatedRankings` currently only has `teamName` from `team_leader` field — enrich it to also pull `teamId`, `teamName`, `mgmtGroupId`, `mgmtGroupName` from the team-access cache (same pattern as live data)

### 3. Update `ReportsPeopleTab` to pass org context
- Pass `accessLevel` and `hierarchy` from `TeamReports.tsx` down to `ReportsPeopleTab`
- For `viewType === 'today'`: Use `OrgGroupedRepList` when access level is MGMT lead or higher; keep `LiveLeaderboard` for Team Leads
- For `viewType === 'yesterday'`: Same logic
- For aggregated views: Use `OrgGroupedRepList` for MGMT lead+; keep current for Team Leads

### 4. Update `HierarchicalRepList` (WorkingRepsDrawer)
- Refactor to use the same `OrgGroupedRepList` component, or update it to group by MGMT Group > Team when the viewer has that scope

### 5. Wire up in `TeamReports.tsx`
- Pass `accessData.accessLevel`, `accessData.hierarchy`, and `accessData.accessibleReps` through to `ReportsPeopleTab`
- The data flow: `useTeamAccess` provides org structure → `ReportsPeopleTab` → `OrgGroupedRepList` groups reps using the hierarchy

## Technical Details

**Data already available** (no new DB queries needed):
- `accessData.hierarchy` contains offices > srMgmtGroups > mgmtGroups > teams
- `accessData.accessibleReps` has `teamId`, `teamName`, `mgmtGroupId`, `mgmtGroupName` per rep
- Live/aggregated data hooks already have team info — just need to add `mgmtGroupId`

**Files to create:**
- `src/components/reports/OrgGroupedRepList.tsx` — Main hierarchical grouping component

**Files to modify:**
- `src/hooks/useTeamLiveData.ts` — Add `mgmtGroupId` to live rep data
- `src/hooks/useTeamAggregatedRankings.ts` — Add `teamId`, `mgmtGroupId`, `mgmtGroupName` from cache
- `src/components/reports/ReportsPeopleTab.tsx` — Accept and pass org context, swap in `OrgGroupedRepList`
- `src/pages/TeamReports.tsx` — Pass `accessLevel` and `hierarchy` to people tab
- `src/components/reports/v2/HierarchicalRepList.tsx` — Update to use org-aware grouping

