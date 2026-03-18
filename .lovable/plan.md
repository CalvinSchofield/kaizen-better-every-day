

## Issues Identified

### 1. Planned Days Always Show 0 (RLS Bug)
The `planned_work_days` table has RLS that only allows `auth.uid() = user_id` for SELECT. When a leader queries their downline's planned days directly from the client (line 281 in `useReportsV2Data.ts`), RLS blocks all non-self rows. The edge function `fetch-downline-planned-days` already exists and uses service role key to bypass RLS, but the `goalsQuery` in `useReportsV2Data.ts` queries the table directly instead of using the edge function.

**Fix**: Replace the direct `planned_work_days` query in `goalsQuery` (lines 280-286) with a call to `fetch-downline-planned-days` edge function, which already handles authorization and returns planned days for the leader's downline.

### 2. Inactive/Pre-Signing Reps Showing in Goal Pace
The `enhancedGoalPace` computation iterates all `userIds` without filtering by stage. Reps in exit stages (Not Interested, Signed but Not Interested, Potential Follow Up) and pre-signing stages (100 List, Reached Out, Evaluating) should be excluded.

**Fix**: In the `goalsQuery`, fetch the `stage` column from the `reps` table. In the `enhancedGoalPace` computation, filter to only include reps in `SIGNED_PLUS_STAGES` (Signed, Shadow, Sold, Sold 5+) using the existing `isStageIn` utility from `stageConstants.ts`.

### 3. Pace Context Not Eye-Catching Enough
The Avg/Need/YTD row uses small `text-sm` with `text-[10px]` labels. Need to make the daily needed vs current pace comparison more visually prominent.

**Fix**: In `GoalPaceDrawer.tsx` `RepGoalCard`:
- Make Avg and Need numbers larger (`text-lg font-bold`) 
- Add color coding: green when Avg >= Need, red/amber when Avg < Need
- Add a visual "vs" comparison or arrow between Avg and Need
- Add an "expected pace" marker on the focus tier's progress bar (similar to how the personal goals page shows it)
- Show a percentage badge like "85% of pace" prominently near the header

## Technical Plan

### File: `src/hooks/useReportsV2Data.ts`

1. **Add stage to reps query** (line 265): Change `.select('user_id, name, phone')` to `.select('user_id, name, phone, stage')`

2. **Replace direct planned_work_days query** (lines 280-286): Use the `fetch-downline-planned-days` edge function instead:
   ```typescript
   const session = (await supabase.auth.getSession()).data.session;
   const { data: plannedResult } = await supabase.functions.invoke('fetch-downline-planned-days', {
     body: { userIds },
     headers: { Authorization: `Bearer ${session?.access_token}` },
   });
   const allPlannedDays = plannedResult?.plannedDays || [];
   ```

3. **Filter by active selling stages** (around line 1019-1021): Add stage filtering in the `enhancedGoalPace` loop:
   ```typescript
   import { SIGNED_PLUS_STAGES, isStageIn } from "@/utils/stageConstants";
   // ...
   const rep = repsMap.get(userId);
   if (!rep) continue;
   if (!isStageIn((rep as any).stage, SIGNED_PLUS_STAGES)) continue;
   ```

### File: `src/components/reports/v2/GoalPaceDrawer.tsx`

4. **Make pace numbers more prominent** in `RepGoalCard`:
   - Increase Avg and Need font sizes to `text-base` or `text-lg`
   - Color-code: Avg in green when >= Need, red when significantly below
   - Add a pace percentage badge in the header area (e.g., colored pill showing "92% pace" or "67% pace")
   - Add expected pace marker line on the focus tier progress bar
   - Make the Need