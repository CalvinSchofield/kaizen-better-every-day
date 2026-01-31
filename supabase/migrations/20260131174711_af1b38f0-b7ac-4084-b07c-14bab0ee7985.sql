-- Fix RLS policy for challenge_participants to allow viewing participants of public challenges
-- The current policy only allows participants to see each other, but public challenges
-- should allow anyone to view who is participating

-- Drop the existing select policy
DROP POLICY IF EXISTS "cp_select" ON public.challenge_participants;

-- Create a new select policy that allows:
-- 1. Your own participant records
-- 2. All participants of challenges you're participating in
-- 3. All participants of PUBLIC challenges (visibility = 'public')
CREATE POLICY "cp_select" ON public.challenge_participants
FOR SELECT
USING (
  (user_id = auth.uid()) 
  OR is_challenge_participant_direct(challenge_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.challenges c 
    WHERE c.id = challenge_participants.challenge_id 
    AND c.visibility = 'public'
  )
);