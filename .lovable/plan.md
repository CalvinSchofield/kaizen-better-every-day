## Issues You've Identified & How to Address Them

### Issue 1: Inviting Your Upline (The Bootstrap Problem)

**Current behavior**: When you invite Gunnar, the system sets `recruiter_user_id = YOU` on his recruit record. This means Gunnar appears as YOUR recruit — but he's actually your boss.

**What needs to happen**: When you approve Gunnar and assign him `senior_manager`, the system should detect that his role is ABOVE yours and **flip the relationship**:

- Remove `recruiter_user_id` from Gunnar's record (he wasn't recruited by you — you just gave him app access)
- Set YOUR `recruiter_user_id` to point to Gunnar (he's your upline)
- Gunnar automatically inherits your entire downline, MGMT groups, and stats because the org tree now flows through him

**Implementation**: In the `EditRecruitDrawer` save logic, when a role is assigned that is higher than the approver's own role, trigger a "relationship flip" — update the approver's own recruit record to set `recruiter_user_id = the new upline's user_id`, and clear `recruiter_user_id` on the upline's record (or set it to their own upline if known).

### Issue 2: Preventing Downward Role Changes on Upline

**Current behavior**: After assigning Gunnar as Sr Manager, you can still open his profile and change his role or edit his details. That's wrong — he's your boss.

**What needs to happen**: The system should prevent anyone from editing or managing someone with a role equal to or higher than their own. Role changes should only flow downward. *** and specifically, role changes and hierarchy changes should only flow downward in YOUR downline, I shouldn't be able to change peoples roles or the hierarchy structure for people that are not in my down line even if they are a team lead. It would only be able to change it if they are a team lead in my down line a.k.a. I am their boss

**Implementation**: 

- In `EditRecruitDrawer`, before rendering role assignment or allowing edits, compare the current user's access level against the target recruit's assigned role. If the target has an equal or higher role, disable editing or hide the edit button entirely.
- In `PendingApprovalsSection`, this is a one-time bootstrap exception — you CAN assign a higher role during initial approval, but after that, you lose edit access to that person.

### Issue 3: Context-Aware Invite Links

**Your concern**: When Gunnar (Sr Manager + MGMT Group Lead of his own group) sends a link, how do his team leads know if he's inviting them as their MGMT Group Lead vs as their Sr Manager?

**Answer**: They don't need to know. The invite link just gets them into the system. Gunnar then assigns them to the correct MGMT group and team during approval via the EditRecruitDrawer. The invite link carries Gunnar's user ID — during approval, Gunnar picks which MGMT group and team this person belongs to, and assigns their role (Team Lead, Manager, etc.).

No code change needed here — the existing approval flow already lets the approver set team/MGMT group. The key insight is: **the invite link is just the door; the approval step is where placement happens.**

### Issue 4: Team-Level Mass Invite (Different Recruiters)

**Your concern**: As a Team Lead, you want to send ONE link to your whole team group chat. Some people have different direct recruiters (not you). But the system sets `recruiter_user_id = you` for everyone.

**Answer**: This is fine for initial onboarding. Everyone signs up, you approve them all, then you use the existing **recruiter reassignment** feature to move people to their correct direct recruiter. Since you already have that feature (with branch-move confirmation), this is manageable at the team level (5-10 people).

**Small improvement**: After approving a batch, show a prompt: "Some of these reps may have different direct recruiters. You can reassign them in the Recruiter Tree." This guides the team lead to fix the recruiter relationships.

### Summary of Code Changes


| File                                                          | Change                                                                                                                                                                                   |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/mygroup/recruit-detail/EditRecruitDrawer.tsx` | Add "relationship flip" logic when assigning a role higher than the approver's. Add guard to prevent editing someone with an equal/higher role (except during initial pending approval). |
| `src/components/mygroup/PendingApprovalsSection.tsx`          | After batch approval, show recruiter-reassignment prompt. Mark the one-time bootstrap approval as an exception to the upline-edit guard.                                                 |
| `supabase/functions/process-invite-signup/index.ts`           | No changes needed — the current auto-resolution logic is correct. The relationship flip happens at approval time, not signup time.                                                       |


### The Full Onboarding Flow (Corrected)

```text
You invite Gunnar → he signs up → you approve him
  → You assign role: Senior Manager
  → System detects: Sr Manager > your MGMT Group Lead role
  → System flips: YOUR recruiter_user_id → Gunnar
  → Gunnar now inherits your downline in the org tree

Gunnar creates his org structure (other MGMT groups, teams)
  → Skips YOUR MGMT group (already exists)
  → Sends ONE invite link to all his MGMT Group Leads
  → Approves each, assigns role + MGMT group placement
  → Each MGMT Lead does the same for their Team Leads

Team Lead sends ONE link to entire team group chat
  → Everyone signs up → Team Lead approves all
  → Team Lead reassigns recruiters via Recruiter Tree
  → Done — org is built
```