

# Drag-and-Drop Recruiter Tree Reassignment

## Overview
Add long-press-to-drag functionality to the visual recruiter tree, allowing leaders to drag a node (person) and drop it onto another node to reassign the recruiter-recruit relationship. The dragged person and their entire downline move together. Includes haptic feedback, permission enforcement, and on-brand confirmation dialogs.

## User Experience Flow

1. **Long press** (400ms) on a person node triggers haptic feedback and enters drag mode
2. The node lifts with a scale/shadow animation; its subtree visually detaches
3. As the user drags, eligible drop targets pulse/highlight; ineligible ones dim
4. **Dropping** onto a valid target shows a confirmation drawer (matching existing brand style from `ReassignRecruiterDrawer`)
5. If the dragged node has children, show the "Branch Move" warning (already exists)
6. On confirm, calls `update-rep-assignment` edge function (already exists)
7. On cancel or drop on invalid target, the node animates back to its original position

## Permission Rules (enforced client-side + server-side)

- **Cannot drag**: label nodes, office nodes, ghost reps without IDs, yourself, your upline
- **Cannot drop onto**: yourself, someone in the dragged node's own subtree (circular), anyone outside your management scope
- **Scope check**: A team lead can only rearrange within their downline. A MGMT group lead within their MGMT group. etc.
- Server-side validation already exists in `update-rep-assignment` (checks `is_team_lead`, `is_mgmt_group_lead`, `has_min_role`)

## Technical Approach

### 1. Create `useDragReassign` hook
New hook in `src/hooks/useDragReassign.ts` that manages:
- Long-press detection (reuses patterns from `useLongPress`)
- Drag state: `isDragging`, `draggedNode`, `dragPosition`, `dropTargetId`
- Hit-testing against positioned nodes to determine hover target
- Permission checks (is target in user's scope? is it a valid parent?)
- Uses `hapticMedium()` on drag start, `hapticSelection()` on valid hover

### 2. Update `VisualRecruiterTree` component
- Accept new props: `onDragReassign?(sourceId, targetId)`, `currentUserAccessLevel`, `currentUserId`, `accessibleNodeIds`
- Wrap each person node with touch/mouse handlers from `useDragReassign`
- Render a floating "ghost" node during drag (the dragged avatar following the finger)
- Highlight valid drop targets with a pulsing ring animation
- Dim invalid targets
- Disable `TransformWrapper` panning while dragging (prevent conflict)

### 3. Wire up in `OrgChart.tsx`
- Pass `onDragReassign` callback that opens confirmation and calls the existing `update-rep-assignment` edge function
- Build a set of "manageable node IDs" from the user's downline for permission scoping
- Reuse the confirmation dialog pattern from `ReassignRecruiterDrawer`
- Invalidate queries on success (same pattern as existing reassignment)

### 4. Confirmation UI
- Reuse existing `AlertDialog` pattern with branch-move warning
- Show: "Move [Name] under [Target Name]?" with downline count if applicable
- On-brand styling matching existing confirmation dialogs

## Key Technical Details

- **Drag conflicts with zoom/pan**: Disable `TransformWrapper` panning when `isDragging` is true (use `disabled` prop or `panning.disabled`)
- **Touch coordinate transform**: Must account for the current zoom scale and pan offset from `TransformWrapper` to correctly hit-test nodes
- **Performance**: Hit-testing uses the existing `PositionedNode[]` array with simple distance calculation, no need for spatial indexing given tree sizes (< 5000 nodes)
- **Mobile-first**: All interactions use touch events primarily, mouse as fallback (same pattern as `useLongPress`)

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/hooks/useDragReassign.ts` | **Create** - drag state management hook |
| `src/components/mygroup/org/VisualRecruiterTree.tsx` | **Modify** - add drag handlers, ghost node, drop highlights |
| `src/pages/OrgChart.tsx` | **Modify** - wire up drag callback, confirmation dialog, permission scoping |

