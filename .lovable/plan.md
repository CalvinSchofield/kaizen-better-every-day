

# Restructure Ramp to Blitz: Topic-Based Sections

## Current Structure vs New Structure

```text
CURRENT (Generic Phases)          NEW (Topic-Based Sections)
========================          =========================
Phase 1: Set Goals                Section 1: Pay & Earnings
  - What is a Blitz video           - "How You Get Paid" video
  - How Pay Works video             - Deep Dive video (bonus)
  - Payscale download               - Payscale download
  - Goals (Why/What/How)            - Self-report: "I've reviewed pay"
  - Commit to blitz
                                  Section 2: Goals & Planning
Phase 2: Start Training             - Why/What/How review
  - Study Product                    - Set goals in-app (action)
  - Product Quiz                     - Commit to blitz
  - Upgrades 101
  - Takeover Approach             Section 3: Product Knowledge
  - Submit Pitches                   - Study products (link to module)
                                     - Self-report per product area
Phase 3: Practice
  - iPad Setup (apps)             Section 4: The Process
  - Write Your Why                   - Upgrades 101 + pitch guide
  - 1-on-1 Practice                 - Takeover approach + pitch guide
                                     - Record & send pitch video
Phase 4: Saddle Up!
  - Packing List                  Section 5: iPad & Practice
  - Knocking Essentials              - iPad apps checklist
  - "When It Gets Tough"            - 1-on-1 practice with vet/leader
                                       (using iPad to get familiar)

                                  Section 6: Packing List
                                     - Dynamic: "Blitz Packing" or
                                       "Summer Packing" based on
                                       upcoming blitz status
                                     - Knocking essentials check
```

## What Gets Removed
- "What is a Blitz?" video (from Phase 1)
- Product Quiz (from Phase 2) -- replaced by self-report per item
- "When It Gets Tough" / playbook section (from Phase 4) -- to be refined later
- "Write Your Why" section (from Phase 3) -- this was already covered in Goals

## What Changes
- Product study becomes self-report per item instead of quiz
- iPad setup + practice combined: the action item becomes "practice pitch with vet while using the iPad"
- Phase 4 packing list becomes context-aware (blitz vs summer)

## Critical Logic Dependencies to Preserve

### 1. Database Fields Stay the Same
The `ramp_phase_1_complete` through `ramp_phase_4_complete` fields in the `reps` table stay unchanged. We just remap what they mean:
- `ramp_phase_1_complete` = "Pay & Earnings" + "Goals & Planning" (sections 1-2)
- `ramp_phase_2_complete` = "Product Knowledge" + "The Process" (sections 3-4)  
- `ramp_phase_3_complete` = "iPad & Practice" (section 5)
- `ramp_phase_4_complete` = "Packing List" (section 6)

This avoids any migration and preserves all existing progress, locking logic, leader verification, and Notion sync.

### 2. Leader View (ProgressTab.tsx)
The `rampStepConfigs` labels change to match new names:
- Phase 1: "Pay & Goals" (covers sections 1-2)
- Phase 2: "Product & Process" (covers sections 3-4)
- Phase 3: "iPad & Practice" (section 5)
- Phase 4: "Packing List" (section 6)

### 3. Locking Logic
Unchanged -- Phase 2 still locks until Phase 1 complete, etc. The `RampToBlitz.tsx` phases array and `ProgressTab.tsx` locking stays identical.

### 4. Watched Videos / Progress Keys
- REMOVE: `what-is-blitz` from required videos (keep `how-pay-works`)
- REMOVE: `phase2-quiz-passed` (no more quiz)
- ADD: new self-report keys for product sub-items
- KEEP: all other progress keys

### 5. Edge Functions & Notion Sync
`update-rookie-status` and `fetch-blitz-attendance` use "Phase 1 ✅" etc. These stay as-is in the DB; just the UI labels change. No edge function changes needed.

### 6. Hero Progress (RampHeroProgress.tsx)
`PHASE_ITEMS` totals and getCompleted functions update to match new step counts per phase.

### 7. Next Step Logic (RampNextStep.tsx)
`getNextStep` and `isSelfServiceComplete` update to reflect new steps per phase.

### 8. Notification Text
`check-ramp-progress-notifications` edge function updates phase descriptions.

## Files to Modify

### Frontend Components (major rewrites)
- `src/components/ramp/Phase1Content.tsx` -- becomes "Pay & Goals" with two visual sections
- `src/components/ramp/Phase2Content.tsx` -- becomes "Product & Process" 
- `src/components/ramp/Phase3Content.tsx` -- becomes "iPad & Practice" (combined)
- `src/components/ramp/Phase4Content.tsx` -- becomes "Packing List" with blitz/summer detection

### Logic & Navigation
- `src/pages/RampToBlitz.tsx` -- update phase titles/subtitles
- `src/components/ramp/RampHeroProgress.tsx` -- update PHASE_ITEMS counts
- `src/components/ramp/RampNextStep.tsx` -- update step sequences and labels
- `src/components/ramp/RampPhaseContent.tsx` -- no structural changes needed

### Leader View
- `src/components/mygroup/recruit-detail/tabs/ProgressTab.tsx` -- update rampStepConfigs labels
- `src/components/mygroup/recruit-detail/RecruitDetailDrawer.tsx` -- update fieldToNotionStatus labels and computedOnboardingStatus

### Edge Functions
- `supabase/functions/check-ramp-progress-notifications/index.ts` -- update notification text
- `supabase/functions/fetch-blitz-attendance/index.ts` -- update onboardingStatus display strings

### No Changes Needed
- Database schema (same 4 phase fields)
- `update-rookie-status` edge function (same field names)
- RLS policies
- `useRampProgress` hook
- `useRookieUnlockStatus` hook

## Phase 4 Dynamic Content Logic
```typescript
// In Phase4Content, detect context:
const hasUpcomingBlitz = repData?.committed_blitzes?.length > 0 
  && allBlitzes.some(b => committedIds.includes(b.id) && isUpcoming(b));

// If upcoming blitz: "Blitz Packing List" with blitz-specific items
// If no upcoming blitz: "Summer Packing List" with summer-specific items
// Core list is largely the same, verbiage changes
```

## Note on Packing List
You mentioned you'll provide a separate summer packing list soon. I'll implement the dynamic switching logic now with the current blitz list as default, and we can swap in the summer-specific list when you share it.

