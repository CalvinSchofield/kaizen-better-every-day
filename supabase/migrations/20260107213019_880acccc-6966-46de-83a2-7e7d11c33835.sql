-- Drop ALL existing policies on challenge_participants
DROP POLICY IF EXISTS "Users can view challenge participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can insert themselves as participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can delete their own participation" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_select" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_insert" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_update" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_delete" ON public.challenge_participants;

-- Create simple, non-recursive policies for challenge_participants
-- SELECT: Users can see their own participations OR any participant of challenges they're in
CREATE POLICY "cp_select"
ON public.challenge_participants
FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_challenge_participant_direct(challenge_id, auth.uid())
);

-- INSERT: Challenge creators can add participants, users can add themselves
CREATE POLICY "cp_insert"
ON public.challenge_participants
FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);

-- UPDATE: Users can only update their own participation
CREATE POLICY "cp_update"
ON public.challenge_participants
FOR UPDATE
USING (user_id = auth.uid());

-- DELETE: Users can delete their own, or challenge creator can delete any
CREATE POLICY "cp_delete"
ON public.challenge_participants
FOR DELETE
USING (
  user_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.challenges c WHERE c.id = challenge_id AND c.created_by = auth.uid())
);

-- Now fix incentive_eligible_reps - create security definer function first
CREATE OR REPLACE FUNCTION public.is_incentive_eligible_direct(_incentive_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.incentive_eligible_reps
    WHERE incentive_id = _incentive_id
      AND user_id = _user_id
  )
$$;

-- Drop existing policies on incentive_eligible_reps
DROP POLICY IF EXISTS "incentive_eligible_reps_select" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_insert" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_delete" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "Users can view incentive eligibility" ON public.incentive_eligible_reps;

-- Create simple policies for incentive_eligible_reps
CREATE POLICY "ier_select"
ON public.incentive_eligible_reps
FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_incentive_eligible_direct(incentive_id, auth.uid())
  OR EXISTS (SELECT 1 FROM public.incentives i WHERE i.id = incentive_id AND i.created_by = auth.uid())
);

CREATE POLICY "ier_insert"
ON public.incentive_eligible_reps
FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.incentives i WHERE i.id = incentive_id AND i.created_by = auth.uid())
);

CREATE POLICY "ier_delete"
ON public.incentive_eligible_reps
FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.incentives i WHERE i.id = incentive_id AND i.created_by = auth.uid())
);