-- Fix broken RLS policies for challenges and incentives
-- The existing policies have a bug where they reference the wrong table/column

-- Drop broken policies
DROP POLICY IF EXISTS "Participants can view their private challenges" ON public.challenges;
DROP POLICY IF EXISTS "Eligible reps can view private incentives" ON public.incentives;

-- Recreate challenges SELECT policies:
-- 1. Public challenges: anyone authenticated can view
-- 2. Private challenges: only participants can view
CREATE POLICY "Participants can view their private challenges" ON public.challenges
  FOR SELECT
  USING (
    visibility = 'private' 
    AND is_challenge_participant_direct(id, auth.uid())
  );

-- Recreate incentives SELECT policies:
-- Only eligible reps (or creator) can view - visibility doesn't affect who can see
-- Drop the public policy too since incentives should only be visible to eligible reps
DROP POLICY IF EXISTS "Users can view public incentives" ON public.incentives;

CREATE POLICY "Eligible reps and creator can view incentives" ON public.incentives
  FOR SELECT
  USING (
    created_by = auth.uid() 
    OR is_incentive_eligible_direct(id, auth.uid())
  );