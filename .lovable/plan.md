## Plan: Add Role Assignment Safety + Edit/Undo Capability

### Problem

1. Bootstrap approval lets the inviter assign ANY role with zero confirmation — easy to fat-finger Sr. Regional vs Sr. MGMT
2. No way for a leader to fix a wrong role assignment after approval (only Admin page can do it)

### Changes

#### 1. Add confirmation step for role assignment during approval

**File**: `src/components/mygroup/recruit-detail/EditRecruitDrawer.tsx`

Before the approval mutation fires, if a role is selected, show a confirmation dialog:

> "You're about to assign **[Name]** the role of **Sr. Regional**. This will give them management access at that level. Are you sure?"

This catches fat-finger mistakes before they're committed.

#### 2. Allow leaders to edit/remove roles they assigned

**File**: `src/components/mygroup/recruit-detail/EditRecruitDrawer.tsx` (or recruit detail drawer)

When viewing a recruit's detail who has a role in `user_roles`:

- Show their current assigned role
- If the current user has bootstrap authority (they were the inviter) OR has a higher access level, show an "Edit Role" option
- Allow changing or removing the role with the same confirmation dialog

This would be accessible from the recruit detail drawer for any approved recruit that has a role.

#### 3. Scope bootstrap more tightly (optional safety layer)

**File**: `src/utils/roleHierarchy.ts`

Add a utility that warns when assigning a role 2+ levels above the approver's own level — flag it as "unusual" with an extra confirmation. This doesn't block the action but adds friction for large jumps (e.g., a Team Lead assigning Corporate).

### Technical Details

- Confirmation uses existing `AlertDialog` or `Drawer` pattern already in the codebase
- Role editing reuses the same `user_roles` insert/update logic already in `EditRecruitDrawer`
- No database changes needed — `user_roles` table already supports updates and deletes
- The `assigned_by` column on `user_roles` can be used to determine who assigned the role and whether they should be allowed to edit it