

# Competitions System Audit & Enhancement Plan

## Executive Summary
After a thorough audit of the competitions/incentives codebase, I found **one critical bug** causing the "Failed to propose edit" error, plus identified several areas for improvement to make this a world-class competition experience.

---

## Part 1: Critical Bug Fix - "Failed to propose edit"

### Problem
When editing a challenge, the system fails with "Failed to propose edit" (as shown in the screenshot).

### Root Cause
The RLS policy for `challenge_edit_approvals` INSERT is:
```sql
WITH CHECK (user_id = auth.uid())
```

But the `useProposeEdit` mutation tries to insert approval records for ALL participants:
```javascript
const approvals = participants.map(p => ({
  proposal_id: proposal.id,
  user_id: p.user_id,  // Includes OTHER users - blocked by RLS!
  approved: p.user_id === user.id ? true : null,
  ...
}));
```

This fails because the current user cannot insert rows with other users' IDs.

### Solution
Update the RLS policy to allow proposal creators to insert approval records for all participants:
```sql
-- Allow insert if either:
-- 1. User is inserting their own approval row, OR
-- 2. User is the proposer of this proposal (they need to create records for all participants)
WITH CHECK (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM challenge_edit_proposals 
    WHERE id = challenge_edit_approvals.proposal_id 
    AND proposed_by = auth.uid()
  )
)
```

---

## Part 2: Downline Auto-Approve for Edits (Currently Missing)

### Current State
Challenge CREATION already has "downline auto-start" logic - if a leader creates a challenge with their downline, it auto-starts without requiring acceptance.

### Problem
Challenge EDITS do not have this same bypass. The EditChallengeDrawer always shows "All participants must approve changes" even when the leader is editing their own downline's challenge.

### Solution
Add similar auto-approve logic to `useProposeEdit`:
1. Check if the proposer has leadership access
2. Check if ALL participants are in their downline
3. If so, auto-approve all approvals and apply changes immediately
4. Update the EditChallengeDrawer UI to reflect this (hide warning banner for downline challenges)

---

## Part 3: Flow Verification - Acceptance Logic

### Current Implementation (Working Correctly)

**Challenge Creation:**
- Non-downline participants receive pending invites, must accept/decline
- Downline participants auto-accept when leader creates

**Challenge Response:**
- 1v1: If anyone declines, entire challenge is declined
- Team: Captain B decline = whole challenge declined
- Team: Regular member decline = removed but challenge can continue

**Status Transitions:**
- Pending -> Active (when all accept)
- Pending -> Declined (when captain/1v1 participant declines)
- Active -> Completed (by auto-complete edge function)
- Pending -> Voided (if end date passes)

### Verified Working:
- Auto-expire logic for pending challenges past end date
- Push notifications for invites/acceptances
- Realtime subscriptions for status changes

---

## Part 4: New Features for World-Class Competition Experience

### Feature 1: Challenge Win Streaks
Track consecutive wins of similar challenge types:
- "3-game win streak vs Adam in FP+ challenges"
- "5 1v1 victories in a row!"
- Display streak badges on challenge cards

**Implementation:**
- Add `streak_count` and `streak_type` columns to `challenge_participants`
- Create trigger to update streaks on challenge completion
- Add StreakBadge component to ChallengeCard

### Feature 2: Enhanced History View
Current state: Just a plain list with basic badges.

**Improvements:**
- Monthly/weekly grouping with summary stats
- Win/loss ratio visualization
- "Rivalry" cards showing head-to-head records against frequent opponents
- Search/filter by opponent, metric, or outcome
- Expandable detail cards (not just badges)

### Feature 3: Head-to-Head Records
When viewing a challenge or creating one:
- Show lifetime record vs that opponent
- "You're 3-2 all-time vs Adam"
- Most recent results

### Feature 4: Challenge Templates/Rematch
- One-tap "rematch" button on completed challenges
- Save favorite challenge configurations
- "Challenge again" with same settings

---

## Technical Implementation Plan

### Phase 1: Bug Fix (Critical)
1. Database migration to update `challenge_edit_approvals` INSERT policy
2. Verify fix works end-to-end

### Phase 2: Downline Auto-Approve for Edits
1. Modify `useProposeEdit` to check team access
2. If all participants in downline, auto-approve immediately
3. Update EditChallengeDrawer UI conditionally

### Phase 3: History UX Improvements
1. Create CompetitionHistoryPage component
2. Add grouping logic (by week/month)
3. Implement rivalry tracking query
4. Add head-to-head record lookup

### Phase 4: Win Streaks (Future)
1. Database: Add streak tracking columns
2. Trigger: Update streaks on completion
3. UI: Streak badges and celebrations

---

## Files to Modify

**Database:**
- Migration: Update RLS policy for `challenge_edit_approvals`

**Hooks:**
- `src/hooks/useChallengeEdits.ts` - Add downline bypass logic
- New: `src/hooks/useHeadToHeadRecord.ts` - Track rivalry stats
- New: `src/hooks/useChallengeStreaks.ts` - Win streak tracking

**Components:**
- `src/components/leaderboard/EditChallengeDrawer.tsx` - Conditional warning banner
- `src/pages/Compete.tsx` - Enhanced history section
- New: `src/components/leaderboard/RivalryCard.tsx`
- New: `src/components/leaderboard/StreakBadge.tsx`

---

## Priority Order
1. **Bug Fix (RLS policy)** - Critical, blocks edit functionality
2. **Downline auto-approve** - Important for leader UX consistency
3. **Enhanced history** - Quality of life improvement
4. **Win streaks & rivalries** - Gamification enhancement

