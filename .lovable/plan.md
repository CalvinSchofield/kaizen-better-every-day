## Cascading Onboarding — Each Level Onboards the Next

### The Core Insight

A Regional should NOT send one link to 200 people. A rookie should NOT have to pick their recruiter from a dropdown. Instead, onboarding cascades down the chain naturally:

```text
Regional sends link to 3 Sr Managers
  → Each Sr Manager sends link to 2-3 MGMT Group Leads
    → Each MGMT Lead sends link to 3-4 Team Leads
      → Each Team Lead sends link to 5-10 reps
        → Each rep sends link to their personal recruits
```

**Why this works:**

- Nobody picks from a confusing list — whoever sent you the link IS your recruiter
- Rookies just enter name/phone/year (the simplest possible form)
- Each leader only onboards the people they directly manage (3-10 people, not 200)
- The org structure builds itself as each level signs up and starts inviting down

### The Flow

**Step 1 — You invite your Sr Manager**

- Send him your invite link
- He signs up (name/phone/year — that's it)
- You approve him, assign his role (Sr Manager) and MGMT group **** PROBLEM what if I send this to my divisional? Am I only able to approve his role/change his role this one time because of the problem where he doesn't have app access, I created it, and I'm the only one that is able to get him app access?

**Step 2 — Sr Manager invites his MGMT Group Leads**

- He now has an account with Sr Manager access
- He creates his org structure (MGMT groups, teams) in the Org tab
- He sends HIS invite link to his 2-3 MGMT Group Leads
- He approves them, assigns their roles

**Step 3 — Each MGMT Group Lead invites their Team Leads**

- Same pattern repeats down

**Step 4 — Team Leads invite their reps**

- Reps get the simplest signup: name, phone, year. Done.

### What Needs to Change

#### 1. Remove the recruiter/team picker from signup

Rookies don't need it. Nobody needs it. The invite link already knows who sent it — that person is the recruiter. Team/MGMT group are resolved from the inviter's position.

Keep the signup form as: **name, phone, year** — nothing else.

#### 2. Add role assignment to the approval flow

This is the critical missing piece. When a leader approves someone, they need to be able to assign a role (Team Lead, Manager, MGMT Group Lead, etc.) right there. Without this, the newly approved leader can't send their own invites with proper access.

**Changes to `PendingApprovalsSection` and `EditRecruitDrawer`:**

- Add a "Role" dropdown (from `ASSIGNABLE_ROLES`) visible to `mgmt_group_lead+` users
- On approval, if a role is selected, insert into `user_roles` table
- Also allow assigning the person to a specific team/MGMT group during approval

#### 3. Auto-resolve team/MGMT group from inviter

Update `process-invite-signup` to automatically inherit the inviter's team and MGMT group. If the inviter is a Team Lead, the new signup goes to that team. If they're a MGMT Group Lead, they go to that MGMT group (team TBD by approver).

This already partially works — just make sure it's reliable and the approver can override it.

#### 4. Post-approval onboarding prompt

After a leader approves someone AND assigns them a leadership role, show a prompt: "Send [Name] their invite link so they can start onboarding their team." This guides the cascade.

### File Changes


| File                                                          | Change                                                 |
| ------------------------------------------------------------- | ------------------------------------------------------ |
| `src/components/mygroup/PendingApprovalsSection.tsx`          | Add role selector dropdown on approval                 |
| `src/components/mygroup/recruit-detail/EditRecruitDrawer.tsx` | Add role assignment field for `mgmt_group_lead+`       |
| `supabase/functions/process-invite-signup/index.ts`           | Ensure team/MGMT group auto-resolution from inviter is |
