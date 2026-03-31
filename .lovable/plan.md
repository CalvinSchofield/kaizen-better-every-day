

# Fix: Filter competitions/incentives to active reps only

## Problem

In `useAllOfficeReps.ts`, the stage normalization has an ordering bug:

```
if (lower.includes('signed')) return 'signed';  // ← catches "Signed but Not Interested" too!
```

"Signed but Not Interested" is an exit stage, but it matches `includes('signed')` before any exit check, so those reps pass the `ACTIVE_STAGES` filter and appear in competition participant pools.

Similarly, there's no guard against "Potential Follow Up" or "Not Interested" stages that might have unexpected substrings.

## Fix

**File: `src/hooks/useAllOfficeReps.ts`**

Reorder the `normalizeStage` function to check exit/terminal stages first,