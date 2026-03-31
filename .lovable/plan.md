## Bug: Participant Picker Shows No One + Competition Flow Audit

### Root Cause

The `fetch-team-access` edge function was broken in the last refactor. The variable `accessLevel` is **used** at line 314 but **never defined**. The code that computes it from `highestExplicitRole`, `isAreaDirector`, `isCorporate`, team lead checks, and MGMT group lead checks was deleted during the org-chart refactor. This causes the edge function to crash with a `ReferenceError`, so `useTeamAccess` returns an error, and `useParticipantPool` gets no data — hence "No eligible participants found."

Additionally, `useAllOfficeReps` has a separate bug: it only assigns `teamId`/`teamName` to **team leads** (via `teamByLeadUserId`), not to regular team members. This means even when `allOfficeReps` loads, non-lead reps have no team info, breaking scope filters and grouping.

### Fix 1: Restore `accessLevel` computation in `fetch-team-access`

Add the missing block between the role detection section (lines ~82-89) and the data scoping section (line 311). It needs to:

1. Start with `highestExplicitRole`
2. Override to `'area_director'` if `isAreaDirector` is true (and explicit role < AD)
3. Override to `'corporate'` if `isCorporate` is true
4. Check if user is a team lead (`teamsData.find(t => t.lead_user_id === user.id)`) → `'team_lead'`
5. Check if user is a MGMT group lead (`mgmtGroupsData.find(g => g.lead_user_id === user.id)`) → `'mgmt_group_lead'`
6. Combine: highest of explicit role, structural role, and AD/corporate flags
7. If user has recruits but no other role → `'recruiter'`

This must be placed after fetching teams/mgmt_groups/reps (line ~120) but before the data scoping block (line 311).

### Fix 2: Fix `useAllOfficeReps` team assignment for non-leads

Currently `findTeamForRep` only checks `teamByLeadUserId` (team leads). Need to also look up team membership via the `recruits` table (`recruit.team_id`), matching `rep.id` to `recruit.id` — same pattern used in `fetch-team-access`'s `getRepTeamInfo`.

Add a parallel fetch of `recruits` (just `id, team_id, mgmt_group_id`) and use it as a fallback when the rep isn't a team lead.

### Competition Flow Audit — Answers to User Questions

**Non-leaders (no recruits):**

- Can create challenges (1v1 or group) — button always visible
- Cannot create incentives — button is gated by `isLeader` check (`teamAccess.accessLevel !== 'none'`)
- Available scopes default to `['all_office']` only
- Can accept/decline challenges via pending cards with Accept/Decline buttons

**Recruiters (have recruits but no team):**

- Same as above but see `['my_recruits', 'all_office']` scopes
- Can create challenges against anyone in scope

**Team Leads:**

- See `['my_recruits', 'my_team', 'all_office']` scopes
- CAN create incentives (button visible)

**MGMT Group Leads / Area Directors:**

- Full scope access: `['my_recruits', 'my_team', 'my_mgmt', 'all_office']`
- CAN create incentives

*****what I envision is a leader can create incentives for their own downline which may very well include themselves, and they don't need everyone to accept if they are the leader. So a recruiter should be able to make a group incentive for the recruiter and his recruit for a certain amount of transitions that day without having the recruit have to accept the recruiters incentive. Same with the competition logic, the recruiter can create a competition within his down line that is auto automatic. In other words, a lot of this should be managed more by the recruiter/recruit tree relationship then just the defined team leads, management group leaders, etc.

But I do want any defined leader to be able to do that with their group because that is also who should be in their down line. And this should consider more than just recruiter, team lead, and management group leader. It should include also senior management group leader, regional, senior regional, partner, divisional, and corporate just to have that back bone built out.

&nbsp;

**Invitations:**

- When a challenge is created, all non-creator participants get `accepted: null`
- Push notifications ARE sent via `send-challenge-notification` (both web push and APNs)
- The "Action Required" section on the Compete page shows pending invitations with Accept/Decline buttons
- On acceptance, if all participants have accepted, status flips to `'active'`
- Notification flow is already wired: creation → notification → accept/decline → status update → progress tracking

**The invitation and acceptance logic is sound** — the only blocker is the crashed edge function preventing anyone from appearing in the picker.

### Files to modify

1. `**supabase/functions/fetch-team-access/index.ts**` — Add ~25 lines computing `accessLevel` from role detection results + structural checks
2. `**src/hooks/useAllOfficeReps.ts**` — Add recruits fetch and use `recruit.team_id` for non-lead team assignment (~15 lines)

### Technical detail

The `accessLevel` computation block should look approximately like:

```text
// Determine structural roles from table relationships
const isTeamLeadStructural = teamsData.some(t => t.lead_user_id === user.id);
const isMgmtGroupLeadStructural = mgmtGroupsData.some(g => g.lead_user_id === user.id);

// Compute effective access level (highest wins)
let accessLevel = highestExplicitRole;

if (isCorporate && ROLE_WEIGHT['corporate'] > ROLE_WEIGHT[accessLevel]) {
  accessLevel = 'corporate';
}
if (isAreaDirector && ROLE_WEIGHT['area_director'] > ROLE_WEIGHT[accessLevel]) {
  accessLevel = 'area_director';
}
if (isMgmtGroupLeadStructural && ROLE_WEIGHT['mgmt_group_lead'] > ROLE_WEIGHT[accessLevel]) {
  accessLevel = 'mgmt_group_lead';
}
if (isTeamLeadStructural && ROLE_WEIGHT['team_lead'] > ROLE_WEIGHT[accessLevel]) {
  accessLevel = 'team_lead';
}

// If still 'none' but has recruits, they're a recruiter
if (accessLevel === 'none') {
  const hasRecruits = recruitsData.some(r => r.recruiter_user_id === user.id);
  if (hasRecruits) accessLevel = 'recruiter';
}
```