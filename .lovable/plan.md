# Houston 2026 Office Onboarding Analysis

## Issue 1: Office shows 0 reps

Gunnar is assigned as Area Director via `office_staff`, but the Office Detail Drawer counts reps by looking at MGMT groups and teams with `office_id` matching the Houston office. Since no MGMT groups or teams have been assigned to that office yet, it shows 0 reps -- and Gunnar himself isn't counted because the drawer only counts recruits in those groups/teams, not the AD staff entry.

**Fix**: The drawer should include Area Directors in the rep count, and Gunnar should show as "1 rep" at minimum.

---

## Issue 2: No office_id inheritance from invite flow

Looking at `process-invite-signup`, the function sets `team_id`, `mgmt_group_id`, and `recruiter_user_id` on the new recruit, but **never sets `office_id**`. Office assignment is resolved at read-time via the cascading logic (Rep > Team > MGMT Group > Sr MGMT Group), but since Gunnar has no teams or MGMT groups yet, new signups won't be associated with Houston 2026 at all.

**This is a gap.** There is no mechanism to auto-inherit the office from an Area Director's invite.  
  
**most of the time, the office will be inherited based on where the recruiter is going. like if one of my sophomores recruits some rookie, theyre going to go wherever the sophomore is going (my office). It's only when higher ups recruit other high ups (ex. Josh gruwell a sr regional who doesn't have an app account yet onboards christopher mevs a regional in his downline who also doesnt have an app accoutn yet. josh isn't even deploying for summers so he doesnt have an office assigned to him but regardless -- office assignments should be inherit based on the recruiter and then reasseed with cascading logic if a change is made after the fact (aka christopher mevs doesn't have an office hes going to, and half of his MGMT group is coming with yosemite and the other half is going with houstin office)

---

## Detailed Walkthrough: Scenario A -- Gunnar blasts downline invite to all 30 reps

### What happens technically:

1. Gunnar shares a **downline** invite link from "My Group > Add Recruit > Share Kaizen"
2. Each person who signs up triggers `process-invite-signup`:
  - `recruiter_user_id` = Gunnar's user_id (for ALL 30 signups)
  - `team_id` = null (Gunnar doesn't lead a team)
  - `mgmt_group_id` = null (Gunnar doesn't lead a MGMT group)
  - `approval_status` = "pending"
3. All 30 show up in Gunnar's **Pending Approvals** section on My Group

### What Gunnar sees:

- 30 pending approval cards, each showing name, year, email, "Invited by Gunnar Bramwell"
- He can approve individually or "Approve All"
- He can tap the pencil icon to edit each recruit (assign role, change team/recruiter)
- After approving all, a prompt says: "Go to the Recruiter Tree to reassign anyone who has a different direct recruiter than you"

### The problem:

- **All 30 reps have `recruiter_user_id = Gunnar**`. In reality, most of them were recruited by their team leads or MGMT group leaders, not Gunnar directly.
- The recruiter tree would show Gunnar with 30 direct reports -- completely flat, no hierarchy.
- Gunnar would need to manually reassign each rep's recruiter in the Recruiter Tree (drag/drop or node menu), which is extremely tedious for 30 people. ****drag an ddrop is not currently supported on the recruiter tree to reassign recruit/recruiter relationships or team/mgmt/sr mgmt relationships....*****
- No teams or MGMT groups exist yet, so there's no structure to place them in. ******(this can be done in the strcuture tab -- he should be able to create both mgmt group sand teams since he is a sr mgmt group leader right?)
- None of the reps are associated with Houston 2026 office.

### What each rep sees during onboarding:

1. **Sign up** via invite link (web) -- enters name, phone, year (Rookie/Vet/etc)
2. **"Welcome to Kaizen!"** toast, then **Pending Approval Screen** blocks all access -- ******w**hat does the pending approval screen even look like? gunnar sent me a screenshot of what he saw after i onbaorded him before i approved him, and it looked like he had full app access already lol**
3. The screen says "Your signup is being reviewed by your team leader"
4. They're stuck here until Gunnar approves them
5. Once approved, they hit `SetupFlow` → `IntroWizard` → `BiweeklySyncGate` (Initial Sync) → `GoalSetupWizard`
6. **Onboarding segment**: Since Houston 2026 has no teams/MGMT groups with `office_id` set, `useOnboardingSegment` classifies ALL of them as **"outside-org"** -- they skip team-sell intro slides and bypass why/expenses/preseason commitment steps. *****The hsould be outside the org because they are not in MY org (Calvin schofield MGMT).  But more importantly -- why doe we skip the why/expenses? i see why we skip the preseason commitment steps but why skip the why/expenses part of the goalsSetupWizard?******
7. Leaders (MGMT leads, TLs) who were assigned roles: if Gunnar assigned them roles during approval, they get the auto-approved toast instead and can access Org tab to build structure

---

## Detailed Walkthrough: Scenario B -- Gunnar invites leaders first, then they invite their downline (RECOMMENDED)

### Step 1: Gunnar sends lateral invites to his ~5 leaders

Gunnar creates **lateral** invite links with pre-assigned roles from the invite creation flow:

- Leader A → `pre_assigned_role: mgmt_group_lead`
- Leader B → `pre_assigned_role: mgmt_group_lead`
- Leader C → `pre_assigned_role: team_lead`
- etc.

### What happens technically:

- `shouldAutoApprove = true` (lateral + pre_assigned_role)
- `recruiter_user_id = null` (lateral auto-approve skips recruiter assignment)
- `team_id = null`, `mgmt_group_id = null`
- Role is auto-assigned via `user_roles` table
- No pending approval needed

### What leaders see:

1. Sign up → toast: "You're set up as mgmt group lead. Head to Organization to build your structure."
2. They bypass pending approval entirely
3. They hit onboarding: classified as **"outside-org"** (no office teams exist yet)
4. After onboarding, they go to **Organization tab** and can:
  - Create teams (if MGMT group lead)
  - See the "Create" button based on their role
  - **BUT**: they don't have a MGMT group to lead yet -- Gunnar or they need to create it

### Step 2: Gunnar sets up the org structure

After leaders are approved/onboarded:

1. Gunnar goes to Organization tab
2. Creates MGMT groups, assigns leaders
3. Creates teams under MGMT groups, assigns team leads
4. Uses "Assign to Office" to link MGMT groups to Houston 2026
5. Now the office shows reps

### Step 3: Leaders send downline invites to their reps

Each leader shares their own invite link:

- `recruiter_user_id` = the leader who sent it
- `team_id` = auto-resolved from the leader's team
- `mgmt_group_id` = auto-resolved from the leader's MGMT group
- Recruiter relationships are **correct by construction**

### What Gunnar sees:

- Leaders' pending approvals show up (if he used downline not lateral)
- After leaders are set up, their recruits show up under the correct team/MGMT group
- The recruiter tree is properly hierarchical
- Houston 2026 shows actual rep counts once MGMT groups are assigned to the office

### What reps see:

- Same onboarding flow as Scenario A
- But now with proper team assignment, they may be classified as **"in-org"** if office_id is set on their team/MGMT group ****they shouldnt be "in-org" because they aren't in Calvin Schofield MGMT Group******
- They see the full in-org onboarding experience (team-sell intro, preseason commitments, etc.)

---

## Gaps and Recommended Fixes

### 1. Office rep count should include Area Directors

The `OfficeDetailDrawer` should count the AD as a rep in the office.

### 2. No office_id inheritance from AD invite

When an AD sends an invite, the `process-invite-signup` function should check if the inviter is an Area Director and, if so, set `office_id` on the new rep's record. This would at minimum associate the rep with the office for counting purposes.

### 3. Onboarding segment misclassification

Since Houston 2026 has no teams yet, all signups are classified as "outside-org" and get a stripped-down onboarding. Fix: `useOnboardingSegment` should also check if the user's recruiter is an AD in an office, not just match team_leader names.

### 4. Batch recruiter reassignment is manual and tedious

After Scenario A (blast to all 30), Gunnar gets a text prompt to "go to the recruiter tree" but no bulk reassignment tool. This is a UX gap for large batches.

### 5. Recommended approach for Gunnar

**Scenario B is strongly recommended**: invite leaders first with lateral+role, let them build their structure, then have them invite their own downline. This produces correct recruiter chains, proper team/MGMT placement, and accurate office association automatically.

---

## Implementation Plan

1. **Fix Office Detail Drawer rep count** -- include ADs in the count
2. **Add office_id resolution to `process-invite-signup**` -- if inviter is an AD, set the new rep's `office_id` to the AD's office
3. **Fix `useOnboardingSegment**` -- check recruiter chain for office association, not just team_leader name matching
4. **Consider bulk recruiter reassignment UI** for Scenario A (future enhancement)