

# Onboarding Flow Overhaul

This is a large, multi-part effort. I recommend tackling it in phases rather than one giant change. Here's what needs to happen:

## Problem Summary

The current onboarding has one flow for rookies (sell the opportunity) and one for vets/leaders (quick feature tour). It doesn't account for:
- Whether the user is in your office/org vs an outside group
- Whether summer has started (making preseason steps pointless)
- Calendar/app remaining locked after goals+sync are completed
- The need to immediately chain: Sync numbers -> Set goals -> Plan days

## Phase 1: Fix Calendar Unlock Logic (Bug Fix)

**Currently**: Calendar is locked for all pre-blitz rookies via `useRookieUnlockStatus` which checks blitz attendance, shadow status, or summer start.

**Fix**: Add a new unlock condition — if the user has `setup_complete = true` on their goals AND `hasOfficialTotals = true` (completed initial sync), they should be unlocked. This means updating `useRookieUnlockStatus` to accept goals data and check these conditions.

**Files**: `src/hooks/useRookieUnlockStatus.ts`, which cascades to Calendar, Track, Insights, Customers, Layout nav, AppDrawer, etc. (all already consume this hook).

## Phase 2: Determine "In My Org" vs "Outside"

**Logic**: When a user signs up via an invite code, the `invite_codes` table stores `inviter_user_id`. We trace that inviter's team/MGMT group membership back to an office. If that office is one of yours (Calvin MGMT, Quinn MGMT, Christopher MGMT), the user is "in org." Otherwise, they're "outside."

**Implementation**: Add a field or computed flag (e.g., `is_in_primary_office`) on signup, or compute it at onboarding time by looking up the invite code creator's office membership via `office_staff` / `mgmt_groups` tables.

**Files**: New utility or hook `useOnboardingSegment.ts` that returns the user's onboarding type.

## Phase 3: Refactor IntroWizard to Support All Segments

Replace the current 4 user types (`pre-blitz-rookie`, `post-blitz-rookie`, `vet`, `leader`) with a more nuanced segmentation:

| Segment | IntroWizard Slides | After Wizard |
|---------|-------------------|--------------|
| **Outside org (any year)** | No team/opportunity slides. Straight to sync. | Sync -> Goals (skip preseason if summer) -> Plan days |
| **In-org Soph/Vet** | No opportunity slides. Quick welcome. | Sync -> Goals (skip preseason standards, only preseason FP goal + blitz commits if pre-summer) -> Plan days |
| **In-org Rookie (preseason)** | Team/opportunity slides -> Home for ramp-to-blitz | After Phase 1 ramp complete: Goals -> Sync -> Plan days |
| **In-org Rookie (summer started)** | Brief opportunity slides | Sync (with "haven't sold yet" option) -> Goals (summer only, no preseason) -> Plan days |

## Phase 4: Update GoalSetupWizard for Summer-Awareness

**Currently**: `GoalSetupWizard` checks `isCurrentlySummer` to skip some steps, but it still uses a static date check (`new Date() >= SUMMER_START_MIN`).

**Changes needed**:
- When summer has started, skip: preseason FP goal step, preseason commitments step (books, training, role plays, MNL), blitz commitment step (if no future blitzes)
- For outside-org users: skip "Your Why" / purpose statement, skip preseason commitments entirely — just dates + goals
- For in-org sophs/vets: skip preseason standards (commitments), keep preseason FP goal only if blitzes remain before summer

**Files**: `src/components/goals/GoalSetupWizard.tsx` — update `stepSequence` logic to accept new props like `skipPreseason`, `skipCommitments`, `isExternalUser`.

## Phase 5: Chain the Flows Together

After the IntroWizard completes, instead of just marking `intro_seen = true` and dumping the user on Home, the completion handler should route them through the chain:

1. **Sync** (BiweeklySyncGate with `isInitialSync=true`) — with "I haven't sold yet" option
2. **Goals** (GoalSetupWizard) — contextually filtered
3. **Plan Days** (Calendar planning view) — mark preseason incoming days + summer off days

This means the onboarding becomes a multi-page guided flow rather than separate disconnected pages. The IntroWizard's `onComplete` should navigate to Goals, which gates on sync first, then shows setup wizard, then auto-opens calendar planning.

**Files**: `src/pages/Home.tsx` (IntroWizard completion handler), `src/pages/Goals.tsx` (flow chaining), `src/components/IntroWizard.tsx`, `src/data/introSlides.ts`.

## Recommended Implementation Order

1. **Phase 1** — Calendar unlock bug fix (small, high impact)
2. **Phase 4** — GoalSetupWizard summer-awareness (needed for all flows)
3. **Phase 2** — In-org detection logic
4. **Phase 3** — IntroWizard segmentation refactor
5. **Phase 5** — Flow chaining

Shall I start with Phase 1 (the calendar unlock bug fix) and Phase 4 (summer-skipping in goal setup)?

