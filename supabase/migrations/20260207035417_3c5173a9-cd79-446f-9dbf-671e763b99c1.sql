-- Phase 1: Fix the RLS policy for challenge_edit_approvals INSERT
-- Currently fails because proposers can't insert approval rows for other participants

-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Users can insert their own approval" ON public.challenge_edit_approvals;

-- Create new policy that allows:
-- 1. Users inserting their own approval row, OR
-- 2. Proposers creating approval records for all participants in their proposal
CREATE POLICY "Users can insert approvals for their proposals"
ON public.challenge_edit_approvals
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.challenge_edit_proposals 
    WHERE id = challenge_edit_approvals.proposal_id 
    AND proposed_by = auth.uid()
  )
);