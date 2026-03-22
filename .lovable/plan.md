## Plan: Lateral/Upline Invite Flow

### Status: ✅ Implemented

### Summary

MGMT Group Leads and above can generate "Invite a Leader" (lateral) invite links that bypass the standard auto-recruiter/team/group assignment. This prevents incorrect nesting when inviting peers or upline leaders.

### What was built

1. **Database**: Added `invite_type` (default `'downline'`), `target_mgmt_group_id`, and `target_team_id` columns to `invite_codes` table.

2. **AddRecruitActionSheet**: New "Invite a Leader" option (restricted to MGMT Group Lead+) that generates a `lateral` invite code. Shows a warning that manual placement is required.

3. **process-invite-signup**: For lateral invites, skips auto-assignment of `recruiter_user_id`, `team_id`, and `mgmt_group_id`. Push notifications clarify that manual placement is needed.

4. **EditRecruitDrawer**: Detects lateral invites during approval and shows a warning banner. Validates that Recruiter and Team are manually set before saving.

### Design Decisions

- **Recruiter assignment**: Approver picks during approval
- **Approval authority**: Inviter approves (even if invitee outranks)
- **Visibility**: Both inviter's chain and target branch notified
- **Cross-branch claiming**: Restricted to inviter's chain only
