
# Fix: Private Challenge Creation RLS Error

## The Problem
When creating a **private** challenge (the Private toggle enabled), you're getting:
> "new row violates row-level security policy for table 'challenges'"

## Root Cause Analysis
I traced through the code and found the exact issue:

The challenge creation flow in `useChallenges.ts`:
1. **Step 1**: Insert the challenge → `.select()` to get the challenge ID back
2. **Step 2**: Insert participants (including creator) using that challenge ID

The problem is the **SELECT policies** on the `challenges` table:
- **Public challenges**: `visibility = 'public'` ✓
- **Private challenges**: `visibility = 'private' AND is_challenge_participant_direct(id, auth.uid())`

For private challenges, the SELECT check requires you to be a **participant** - but participants haven't been inserted yet when the `.select()` runs! So PostgreSQL can't return the row, and the insert appears to fail.

```text
Timeline of the bug:
─────────────────────────────────────────────
1. INSERT challenge (visibility='private')  ✓ INSERT policy passes (created_by = auth.uid())
2. .select() to get challenge ID            ✗ SELECT policy fails! 
                                               (you're not a participant yet)
3. INSERT participants                      Never happens - step 2 failed
─────────────────────────────────────────────
```

## The Fix
Add a SELECT policy that allows **creators** to view their own challenges, regardless of visibility:

```sql
CREATE POLICY "Creators can view their challenges"
ON public.challenges FOR SELECT
USING (auth.uid() = created_by);
```

This makes sense from a business logic perspective too - if you created a challenge, you should always be able to see it.

## Database Migration
```sql
-- Add policy for creators to view their own challenges
-- This fixes the RLS error when creating private challenges
CREATE POLICY "Creators can view their challenges"
ON public.challenges FOR SELECT
USING (auth.uid() = created_by);
```

## Files Changed
| File | Change |
|------|--------|
| Database | Add new SELECT RLS policy on `challenges` table |

No code changes required - the fix is purely at the database security layer.

## Testing Checklist
After migration:
- [ ] Create a **public** 1v1 challenge → Should work
- [ ] Create a **private** 1v1 challenge → Should now work (was broken)
- [ ] Create a **private** team challenge → Should now work
- [ ] Other users should NOT see private challenges unless they're participants
- [ ] Challenge creator should see their private challenge in the list
