

## Problem

There are two related issues:

1. **No way to move reps between teams/MGMT groups from the Structure tab.** Currently, tapping a rep opens the RecruitDetailDrawer, which has an Edit flow (EditRecruitDrawer) where you can change Team and Recruiter — but this is buried and not obvious for bulk org setup.

2. **New leaders (like Gunnar) won't know how to build their org.** The Structure tab has create/delete actions but lacks a guided onboarding flow and the ability to reassign reps to different teams/MGMT groups in bulk.

## Plan

### 1. Add "Move to Team" action to long-press menu on rep nodes

Currently, long-press only works on team/mgmt_group nodes. Extend it so long-pressing a **rep** node in the Structure tab opens an action sheet with:
- **"Edit Details"** — opens the existing RecruitDetailDrawer
- **"Move to Team..."** — opens a picker to select a new team (updates `team_id` and auto-resolves `mgmt_group_id` from `team_mgmt_groups`)

This gives leaders a fast way to reassign individual reps without navigating into edit forms.

**File:** `src/components/org/OrgStructureTree.tsx`

### 2. Add "Move to MGMT Group" on long-press for teams

When long-pressing a **team** node, add a "Move to MGMT Group..." option alongside the existing "Create Team" and "Delete" actions. This opens a picker showing available MGMT groups and moves the team (updates `team_mgmt_groups`).

**File:** `src/components/org/OrgStructureTree.tsx`

### 3. Add bulk "Assign Reps" action on team nodes

When long-pressing a team node, add an **"Assign Reps"** option that opens a multi-select drawer showing all signed+ reps that are either unassigned or in a different team. Leaders can check multiple reps and assign them all to that team at once. This uses the existing `update-rep-assignment` edge function.

**Files:** `src/components/org/OrgStructureTree.tsx`, new `src/components/org/BulkAssignRepsDrawer.tsx`

### 4. Add empty-state guidance for new leaders

When a leader opens the Structure tab and their org is mostly empty (no teams under their MGMT group, or no MGMT groups under their office), show a step-by-step callout:
1. "Create MGMT Groups under your office" (if AD)
2. "Create Teams under your MGMT Group" (if MGL)
3. "Long-press a team to assign reps"

**File:** `src/components/org/OrgStructureTree.tsx`

### Technical Details

- **Move to Team picker:** A simple Drawer with a searchable list of teams the current user has access to. On selection, calls `supabase.functions.invoke('update-rep-assignment', { body: { repId, teamId } })` and also updates `mgmt_group_id` based on the `team_mgmt_groups` mapping.
- **Move Team to MGMT Group:** Updates `team_mgmt_groups` junction table — deletes old row, inserts new row.
- **Bulk Assign:** Loops through selected rep IDs calling the same `update-rep-assignment` function, then invalidates queries.
- **Long-press on reps:** Extend `isLongPressable` to include `rep` type, and add rep-specific actions in the action sheet Drawer.

