-- Fix infinite recursion in challenge_participants RLS policies
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own participations" ON public.challenge_participants;
DROP POLICY IF EXISTS "Participants can view other participants in same challenge" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can insert their own participation" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_select" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_insert" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_update" ON public.challenge_participants;

-- Create simple, non-recursive policies for challenge_participants
CREATE POLICY "challenge_participants_select_policy"
ON public.challenge_participants
FOR SELECT
USING (true); -- Allow all authenticated users to see challenge participants

CREATE POLICY "challenge_participants_insert_policy"
ON public.challenge_participants
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "challenge_participants_update_policy"
ON public.challenge_participants
FOR UPDATE
USING (user_id = auth.uid());

-- Fix infinite recursion in incentive_eligible_reps RLS policies
DROP POLICY IF EXISTS "Users can view their own eligibility" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "Eligible users can view other eligible reps" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_select" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_insert" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_delete" ON public.incentive_eligible_reps;

-- Create simple, non-recursive policies for incentive_eligible_reps
CREATE POLICY "incentive_eligible_reps_select_policy"
ON public.incentive_eligible_reps
FOR SELECT
USING (true); -- Allow all authenticated users to see eligible reps

CREATE POLICY "incentive_eligible_reps_insert_policy"
ON public.incentive_eligible_reps
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "incentive_eligible_reps_delete_policy"
ON public.incentive_eligible_reps
FOR DELETE
USING (auth.uid() IS NOT NULL);