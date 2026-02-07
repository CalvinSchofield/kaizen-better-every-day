
# Fix Reports V2 Rep List - Team Grouping, Filtering & Organic Hierarchy

## Problem Summary
The "Working Reps" drill-down in Reports V2 has several issues:
1. Shows "Other" group containing all 49 reps instead of proper team groupings
2. Shows everyone, not just reps who actually worked that day
3. Doesn't include the leader viewing the report
4. Doesn't handle "organic leaders" (recruiters without official teams) properly

## Solution Overview
Fix the data flow to include team information, filter to only active reps, include the leader, and improve grouping logic for organic recruiter hierarchies.

---

## Implementation Steps

### Step 1: Add Team Data to Working Reps Data Flow
**File: `src/pages/ReportsV2.tsx`**

The `workingRepsData` mapping currently omits `teamId` and `teamName`. Add these fields from `repsWithEffort`:

```typescript
workingRepsData={repsWithEffort.map(rep => ({
  userId: rep.userId,
  name: rep.name,
  year: rep.year,
  timezone: rep.timezone,
  teamId: rep.teamId,      // ADD
  teamName: rep.teamName,  // ADD
  workStartTime: rep.workStartTime,
  // ... rest
}))}
```

### Step 2: Update RepWithEffort Interface & Data Processing
**File: `src/hooks/useReportsV2Data.ts`**

Add `teamId` and `teamName` to the `RepWithEffort` interface and populate them from the live data or insights data.

### Step 3: Filter to Only Reps Who Worked
**File: `src/components/reports/v2/HierarchicalRepList.tsx`**

Add filtering logic to exclude reps with zero activity:
- For "Live" view: Show reps who have started work OR have any recorded activity
- For historical views: Show reps who have doors > 0 OR any funnel activity OR FP+ > 0

### Step 4: Include Leader in the List
**File: `src/hooks/useReportsV2Data.ts`**

Ensure the current user (leader) is included in `repsWithEffort` when they have activity.

### Step 5: Improve Grouping for Organic Hierarchy
**File: `src/components/reports/v2/HierarchicalRepList.tsx`**

When `teamId` is null but the rep has a known recruiter hierarchy:
- Group under recruiter's name (e.g., "Calder's Group") instead of "Other"
- Fall back to "Ungrouped" only when no hierarchy information exists

**File: `supabase/functions/fetch-team-access/index.ts`**

Ensure `recruiterName` or `recruiterUserId` is included in accessible reps for grouping purposes.

### Step 6: Update Interface Definitions
**File: `src/components/reports/v2/WorkingRepsDrawer.tsx`**

Update the `WorkingRepData` interface to include optional recruiter info:
```typescript
interface WorkingRepData {
  // existing fields...
  teamId?: string | null;
  teamName?: string | null;
  recruiterName?: string | null;  // For organic grouping
}
```

---

## Technical Details

### Data Flow Changes:
```text
┌─────────────────────────┐
│ fetch-team-access       │
│ (adds recruiterName)    │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ useTeamLiveData         │
│ (includes teamName,     │
│  teamId from cache)     │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ useReportsV2Data        │
│ (populates teamId/Name  │
│  in RepWithEffort)      │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ ReportsV2.tsx           │
│ (maps to workingRepsData│
│  with team fields)      │
└───────────┬─────────────┘
            │
┌───────────▼─────────────┐
│ HierarchicalRepList     │
│ (groups by team OR      │
│  recruiter hierarchy)   │
└─────────────────────────┘
```

### Grouping Priority Logic:
1. If `teamId` exists → Group by team name
2. If no team but `recruiterName` exists → Group under "[Recruiter]'s Group"  
3. If neither → Show in "Ungrouped" (should be rare)

### Filtering Logic:
```typescript
// Only show reps with activity
const activeReps = reps.filter(rep => {
  const hasActivity = rep.doors > 0 || rep.transitions > 0 || 
                      rep.presentations > 0 || rep.fp > 0;
  const isCurrentlyWorking = !!rep.workStartTime && !rep.workEndTime;
  return hasActivity || isCurrentlyWorking;
});
```

---

## Files to Modify:
1. `src/pages/ReportsV2.tsx` - Add team fields to workingRepsData mapping
2. `src/hooks/useReportsV2Data.ts` - Add teamId/teamName to RepWithEffort interface and population
3. `src/components/reports/v2/HierarchicalRepList.tsx` - Filter inactive reps, improve grouping logic
4. `src/components/reports/v2/WorkingRepsDrawer.tsx` - Update interface
5. `supabase/functions/fetch-team-access/index.ts` - Add recruiter info for organic hierarchy grouping

## Edge Function Deployment:
The `fetch-team-access` edge function will need redeployment after adding recruiter info.
