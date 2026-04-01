

# Streamline Leader Assignment for Pre-Built Org Structure

## Current State

**What works today:**
- Leaders CAN create groups first (teams, MGMT groups, etc.) with `lead_user_id = null` (no leader assigned yet)
- The `auto_assign_ghost_leader` DB trigger auto-assigns leadership when a user signs up IF their name matches the group name exactly (e.g., user "Quinn Gleed" signs up → auto-assigned to "Quinn Gleed" MGMT group)
- Ghost reps (no app account) appear in the leader picker during creation

**The gap:**
1. If the group name doesn't match the person's name exactly (e.g., "West Coast MGMT" led by Quinn), auto-assignment won't fire
2. When approving a pending invite, the approver can't assign the invitee as group leader — they can only approve/reject
3. After approval, the leader has to navigate back to Org tab and manually edit the group to assign the new user as leader — this is clunky and easy to forget

## Recommended Flow: Structure First, Then Invite & Assign

The ideal UX is: **Create structure first → Invite leaders → During invite approval, assign them as group leader in one step.**

### Changes

#### 1. Enhance Invite Approval Flow with Leader Assignment
**File:** `src/components/mygroup/recruit-detail/RecruitDetailDrawer.tsx` (or approval component)

When approving a pending invite for someone who has a leadership role pre-assigned or who could lead an unleaded group:
- Show a new optional step: "Assign as leader of..." with a dropdown of unled groups the approver manages
- If the group was pre-named after the person (e.g., "Quinn Gleed MGMT"), auto-suggest it
- On approval + assignment, call the existing `manage-mgmt-group` (or equivalent) endpoint to set `lead_user_id`

#### 2. Improve CreateEntityDrawer to Accept Pending/Ghost Leaders
**File:** `src/components/mygroup/org/CreateEntityDrawer.tsx`

Currently the leader picker only works well with users who have accounts. Enhance it to:
- Show pending invitees (recruits with email but no `user_id` yet) as selectable leaders with a "Pending" badge
- Store the recruit name/ID as a placeholder — when they sign up and get approved, auto-link via the existing ghost leader trigger
- Add a note: "This person will be assigned as leader once they join"

#### 3. Strengthen `auto_assign_ghost_leader` Trigger
**File:** Database migration

Currently matches on exact name only. Enhance to also check:
- If there's a recruit record with matching email whose name matches a group name
- Store a `pending_lead_recruit_id` on teams/mgmt_groups tables so assignment is deterministic (not name-heuristic)

#### 4. Post-Approval Auto-Assignment Hook
**File:** `supabase/functions/process-invite-signup/index.ts` or `manage-org-request/index.ts`

After a pending invite is approved and the user gets a `user_id`:
- Check if any group has `pending_lead_recruit_id` matching this recruit
- If so, set `lead_user_id` to the new user's ID and clear `pending_lead_recruit_id`

### Summary of UX Flow

```text
Gunnar (Sr MGMT Lead) workflow:
1. Goes to Org tab → Creates "Quinn Gleed MGMT" (no leader yet) ✓ (works today)
2. Creates teams under it (no leaders yet) ✓ (works today)  
3. Sends invite to Quinn → Quinn signs up → Pending approval
4. Gunnar approves Quinn → NEW: prompted "Assign as leader of Quinn Gleed MGMT?" → Yes
5. Quinn is now leader of that MGMT group immediately upon approval
```

### Files to Modify

| File | Change |
|------|--------|
| DB migration | Add `pending_lead_recruit_id` column to `teams`, `mgmt_groups`, `sr_mgmt_groups` |
| `CreateEntityDrawer.tsx` | Allow selecting pending recruits as placeholder leaders, store `pending_lead_recruit_id` |
| `manage-org-request/index.ts` | Handle `pending_lead_recruit_id` in create actions |
| `process-invite-signup/index.ts` | Auto-assign leadership on approval if `pending_lead_recruit_id` matches |
| Recruit approval UI | Add optional "Assign as leader of..." step during approval |

