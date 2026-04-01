

# Leader Onboarding Flow: Pending → Approval → Guided Org Setup

## Problem

Today, when a leader like Gunnar signs up via invite:
1. If their role is pre-assigned, they **skip** the pending approval screen entirely and land on the blitz recap page — useless and confusing
2. There's no guided flow to help them define their org structure or learn how to invite their own leaders
3. The existing IntroWizard doesn't have a leader-specific org setup path

## Current Flow (Broken)
```text
Gunnar signs up → (role pre-assigned, auto-approved?) → Home page → Blitz Recap → confused
```

## Proposed Flow
```text
Gunnar signs up → Pending Approval Screen (feature showcase) 
  → Calvin approves + assigns role
  → Gunnar refreshes → IntroWizard (leader variant)
    → Welcome slides + photo upload
    → Goal setup wizard (personal goals/planning)
    → NEW: "Define Your Group" step → navigates to Org tab
    → NEW: "Invite Your Leaders" step → opens My Group + invite drawer
```

## Changes

### 1. Ensure ALL recruits hit pending approval (even with pre-assigned roles)
**File:** `src/components/mygroup/PendingApprovalsSection.tsx`

Currently, lateral invites with pre-assigned roles are auto-approved. Change this so that **all** signups require explicit approval — the role can be pre-assigned but `approval_status` stays `pending` until the approver confirms.

Also update `process-invite-signup` edge function if it auto-approves lateral invites.

### 2. Add leader org-setup slides to IntroWizard
**Files:** `src/data/introSlides.ts`, `src/components/IntroWizard.tsx`

Add two new slides to the leader intro flow (after photo upload, before CTA):

- **"Define Your Group"** slide — explains the Org tab, shows that structure has been pre-built for them, encourages them to review and create any missing teams/groups. CTA navigates to `/my-group` with org tab selected.
- **"Invite Your Leaders"** slide — explains the invite flow, shows how to add people to their downline. CTA opens the invite drawer.

Update `getInOrgVetSlides` and `getKnockingUserSlides` (leader paths) to include these slides.

### 3. Add post-onboarding guided tour for Org & My Group pages
**Files:** New component `src/components/mygroup/LeaderOnboardingTour.tsx`

After the IntroWizard completes, when a leader lands on My Group/Org for the first time:
- Use the existing `usePageTour` hook (page: `'my-group'`)
- Show a step-by-step tooltip tour highlighting:
  1. The "Structure" tab — "Here's your org. Review what's been set up."
  2. The "+" create button — "Create teams or groups you still need."
  3. The invite button — "Invite your sub-leaders to start building."

### 4. IntroWizard CTA routing for leaders
**File:** `src/components/IntroWizard.tsx`

When a leader completes the last CTA slide, instead of just marking intro complete and staying on Home:
- Navigate to `/goals` (to enter the goal setup wizard)
- After goal setup completes, if `pages_toured` doesn't include `'my-group'`, redirect to `/my-group` so the page tour fires

### 5. Post-goal-setup redirect for leaders
**File:** `src/pages/Goals.tsx`

After `setup_complete` is set to true for a leader, check if they've toured the my-group page. If not, navigate them to `/my-group` with state `{ fromOnboarding: true }` so the org structure tab auto-opens and the tour begins.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/mygroup/PendingApprovalsSection.tsx` | Remove auto-approval for lateral invites with pre-assigned roles |
| `supabase/functions/process-invite-signup/index.ts` | Ensure lateral invites stay `pending` |
| `src/data/introSlides.ts` | Add "Define Your Group" and "Invite Leaders" slides for leader paths |
| `src/components/IntroWizard.tsx` | Route leaders to `/goals` on CTA completion; handle new slide types |
| `src/pages/Goals.tsx` | Post-setup redirect to `/my-group` for leaders who haven't toured it |
| `src/components/mygroup/LeaderOnboardingTour.tsx` | New: tooltip-based guided tour for org structure + invite flow |
| `src/pages/MyGroup.tsx` (or equivalent) | Integrate `usePageTour('my-group')` and auto-open Structure tab when `fromOnboarding` state is present |

