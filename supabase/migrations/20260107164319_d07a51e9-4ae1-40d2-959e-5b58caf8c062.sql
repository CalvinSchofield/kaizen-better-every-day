-- CRITICAL: Fix infinite recursion in challenge_participants RLS policies
-- First, drop ALL existing policies on challenge_participants (use specific names we've used)
DROP POLICY IF EXISTS "Users can view their own participations" ON public.challenge_participants;
DROP POLICY IF EXISTS "Participants can view other participants in same challenge" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can insert their own participation" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can update their own participation" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_select" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_insert" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_update" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_select_policy" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_insert_policy" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_update_policy" ON public.challenge_participants;
DROP POLICY IF EXISTS "challenge_participants_delete_policy" ON public.challenge_participants;

-- Create new simple policies - NO self-referencing subqueries
CREATE POLICY "cp_select" ON public.challenge_participants FOR SELECT TO authenticated USING (true);
CREATE POLICY "cp_insert" ON public.challenge_participants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "cp_update" ON public.challenge_participants FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "cp_delete" ON public.challenge_participants FOR DELETE TO authenticated USING (user_id = auth.uid());

-- CRITICAL: Fix infinite recursion in incentive_eligible_reps RLS policies  
DROP POLICY IF EXISTS "Users can view their own eligibility" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "Eligible users can view other eligible reps" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_select" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_insert" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_delete" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_select_policy" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_insert_policy" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "incentive_eligible_reps_delete_policy" ON public.incentive_eligible_reps;

-- Create new simple policies
CREATE POLICY "ier_select" ON public.incentive_eligible_reps FOR SELECT TO authenticated USING (true);
CREATE POLICY "ier_insert" ON public.incentive_eligible_reps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ier_delete" ON public.incentive_eligible_reps FOR DELETE TO authenticated USING (true);