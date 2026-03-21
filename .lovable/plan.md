## Invite System Overhaul — Step-by-Step Plan

You've identified several interconnected problems. Here's my recommended approach, broken into phases we can tackle one at a time.

---

### Problem 1: Reps Can't Share Invite Links

Currently, the "Invite Rep" button only appears on the My Group page, which requires leadership access. A rookie who wants to invite a friend has no way to do it.

**Fix:** Move the invite link capability to the Add Recruit page (which all reps can access). When a non-leader rep generates an invite, the link auto-sets them as the recruiter. The existing Share button on My Group stays for leaders.

- Add a "Share Invite Link" option on the Add Recruit page for all reps
- The invite code stores the rep's `user_id` as `inviter_user_id` so the recruiter relationship is automatic

---

### Problem 2: Approval Workflow for Invite Signups

Right now, when someone signs up via invite link, they're immediately created as a recruit/rep with no review. Leaders should be able to verify that the new signup entered correct information (year, recruiter, name, etc.).

**Database changes:**

- Add `approval_status` column to `recruits` table (`pending`, `approved`, `rejected`, default `pending` for invite signups, `approved` for manual leader-created recruits)
- Add `approved_by_user_id` and `approved_at` columns

**Edge function changes (`process-invite-signup`):**

- Set `approval_status = 'pending'` on invite-created recruits instead of making them immediately active
- Send push notifications to the inviter and their upline (up to MGMT group lead) that a new signup needs review

**Frontend changes:**

- New "Pending Approvals" section on My Group page (badge count on tab or category)
- Each pending signup shows the info they entered (name, phone, year) with Approve / Edit / Reject actions
- Approve: sets `approval_status = 'approved'`, activates the recruit in the pipeline
- Edit: opens the recruit detail drawer so the leader can correct info before approving
- Reject: sets `approval_status = 'rejected'`, user sees an "Access Pending" screen

**Access control:**

- Pending recruits are blocked from app access (similar to inactive reps) until approved. The only thing I want them to be able to access is the team info page if they are in MY group directly (Calvin Schofield MGMT or Quinn Gleed MGMT). Otherwise let's show them This website: [https://www.smarthomepros.com](https://www.smarthomepros.com/?inviteId=fdb85236-b069-46ec-9db6-797d24dfbe10)
- The `ProtectedRoute` / setup flow checks approval status and shows a "Waiting for approval" screen
- Approvers: the inviter + anyone in their upline up to MGMT group lead

---

### Problem 3: Onboarding a Leader Without Making Them a Recruit

Currently there's no way to create an account for an Area Director, Regional, etc. without them flowing through the recruit pipeline. They need to exist as a rep with a role assignment, not as someone's recruit.

**This is a separate workflow — "Admin Onboard Leader":**

- New section in the Admin panel (which you already have access to) for creating leader accounts
- You enter their