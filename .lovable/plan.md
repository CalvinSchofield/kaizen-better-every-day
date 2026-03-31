

# Onboarding Flow Overhaul: Three User Segments

## Problem Summary

The current onboarding has only two IntroWizard paths (`pre-blitz-rookie` and `knocking-user`) and doesn't distinguish between users inside vs. outside your office. It also:
- Shows team-selling slides (accolades, leaders, testimonials) to vets/sophomores in your org who don't need them
- Shows the same flow to outside-org users who also don't need your team's specific content
- Locks Calendar/Track for rookies until they complete all of Ramp to Blitz instead of unlocking after goal setup
- Shows preseason commitment steps (training, books, MNL) to vets/sophomores who don't need them
- Shows preseason goals/commitments when summer has already started

## Proposed Segments

```text
┌─────────────────────────────────────────────────────┐
│ Segment 1: Outside Org (any year)                   │
│   - No team-sell slides                             │
│   - Sync → Goals (summer-aware) → Plan Days         │
│                                                     │
│ Segment 2: In-Org Vet/Sophomore                     │
│   - No team-sell slides                             │
│   - Sync → Goals (no preseason commitments;         │
│     preseason goal + blitzes only if pre-summer)     │
│   → Plan Days                                       │
│                                                     │
│ Segment 3: In-Org Rookie                            │
│   Preseason:                                        │
│     - Team-sell intro → Home (Ramp Phase 1)         │
│     - After Phase 1: Sync → Goals → Plan Days       │
│   Summer already started:                           │
│     - Team-sell intro → Sync → Goals (summer only)  │
│     → Plan Days                                     │
└─────────────────────────────────────────────────────┘
```

## "In My Office" Determination

The reps table has `office_id`. We need to check whether the user's `office_id` matches one of "your" offices (Calvin's office). Since `office_id` is on the rep record, we compare it to the office(s) that Calvin/Quinn/Christopher MGMT groups belong to. This is per-individual, not per MGMT group — Christopher Mevs MGMT may span multiple offices, so we check the rep's own `office_id`.

Create a new hook `useIsInMyOffice` that:
1. Reads the current user's `office_id` from repData (already fetched via `select *`)
2. Queries `office_staff` to get office IDs where `role = 'area_director'` and the AD's name/office matches Calvin's known office(s)
3. Returns `isInMyOffice: boolean`

Alternatively (simpler): hardcode the known office ID(s) as constants (Calvin's office), since these rarely change. The rep's `office_id` is already available.

## Changes

### File 1: `src/hooks/useIsInMyOffice.ts` (new)
Create a hook that determines if the current user belongs to "your" office:
- Query the rep's `office_id` (available from repData via `select *`)
- Compare against known office ID(s) via a query to `office_staff` for Area Directors, or check if their MGMT group's `office_id` matches
- Return `{ isInMyOffice, isLoading }`

### File 2: `src/hooks/useRepData.ts`
Add `office_id: string | null` to the `RepData` interface so TypeScript knows about it.

### File 3: `src/data/introSlides.ts`
- Add a new `getOutsideOrgSlides(firstName)` function — minimal welcome, photo upload, CTA that goes straight to sync
- Add a new `getInOrgVetSlides(firstName)` — minimal welcome, photo upload, CTA to sync
- Modify `getPreBlitzRookieSlides` to be the team-sell slides (already correct for in-org rookies)
- The `getKnockingUserSlides` becomes the fallback for in-org vets/leaders

### File 4: `src/components/IntroWizard.tsx`
- Expand `UserType` to: `'outside-org' | 'in-org-vet' | 'in-org-rookie-preseason' | 'in-org-rookie-summer'`
- Route `outside-org` and `in-org-vet` to complete → navigate to Goals page (which triggers sync gate → goal setup → calendar planning)
- Route `in-org-rookie-preseason` to complete → navigate to About Team → then Home for ramp
- Route `in-org-rookie-summer` to complete → navigate to Goals (sync → goals → plan)

### File 5: `src/pages/Home.tsx`
- Update `getUserType()` to use `isInMyOffice` hook
- Pass the correct segment to IntroWizard
- After intro, outside-org and in-org vets navigate to Goals for sync+setup

### File 6: `src/pages/Settings.tsx`
- Mirror the updated `getUserType()` logic

### File 7: `src/components/goals/GoalSetupWizard.tsx`
- Accept a new prop `segment` or `skipPreseasonCommitments: boolean`
- For in-org vets/sophomores and outside-org users: skip 'why', 'expenses', 'commitments' steps
- For all users when `isCurrentlySummer`: already skips preseason steps (verify this works for all segments)
- For in-org vets pre-summer: show 'dates', 'goals', 'preseason' (FP goal), 'blitzes' (if available), 'review' — but NOT 'commitments' (books, training, MNL, role plays)

### File 8: `src/hooks/useRookieUnlockStatus.ts`
- Add `setup_complete` as an unlock condition: if a rookie has completed goal setup (`setup_complete = true`), they should be unlocked for Calendar/Track/Insights
- Update both hook and pure function versions

### File 9: `src/pages/Calendar.tsx` & `src/components/AppDrawer.tsx`
- The unlock change in `useRookieUnlockStatus` will automatically unlock Calendar/Track/Insights after goal setup since `isPreBlitzRookie` will become false
- Verify the locked-state check uses `useRookieUnlockStatus` (it does — via `isPreBlitzRookie`)

### File 10: `src/pages/Goals.tsx`
- Pass `isInMyOffice` context to GoalSetupWizard so it knows which steps to show
- After goal setup completes, auto-navigate to calendar planning view

## Unlock Logic Change (Critical Fix)

Currently, rookies are locked (`isPreBlitzRookie = true`) until they attend a blitz, complete shadow, or summer starts. The user's request is to **unlock after goal setup**. 

In `useRookieUnlockStatus`, add a new unlock condition:
```
isUnlocked = !isInactive && (hasAttendedOrOnBlitz || hasQualifyingStage || hasSummerStarted || hasCompletedGoalSetup)
```

This requires passing `setup_complete` into the hook. We can query `rep_goals.setup_complete` inside the hook (similar to how it queries `season_config`).

## Summary of Flow After Changes

**Outside-org user (any year):**
IntroWizard (welcome + photo) → Goals page (sync gate → goal wizard with dates+goals only → calendar planning)

**In-org vet/sophomore:**
IntroWizard (welcome + photo) → Goals page (sync gate → goal wizard: dates, goals, preseason goal + blitzes if pre-summer → calendar planning)

**In-org rookie (preseason):**
IntroWizard (team sell + photo → About Team) → Home (Ramp Phase 1) → After Phase 1: Goals (sync → full wizard with why, expenses, commitments, etc. → calendar planning) → App unlocked

**In-org rookie (summer started):**
IntroWizard (team sell + photo) → Goals (sync → wizard: why, expenses, dates, goals → calendar planning) → App unlocked

