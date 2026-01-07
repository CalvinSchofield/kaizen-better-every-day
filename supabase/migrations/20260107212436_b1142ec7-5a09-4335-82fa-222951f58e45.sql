-- Drop the problematic policies on challenge_participants
DROP POLICY IF EXISTS "Challenge participants can view challenge participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Users can view their own participations" ON public.challenge_participants;
DROP POLICY IF EXISTS "Participants can view challenge participants" ON public.challenge_participants;

-- Create a security definer function that bypasses RLS to check participation
CREATE OR REPLACE FUNCTION public.is_challenge_participant_direct(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.challenge_participants
    WHERE challenge_id = _challenge_id
      AND user_id = _user_id
  )
$$;

-- Create new RLS policies using the security definer function
-- Policy for SELECT: Users can view participants of challenges they participate in
CREATE POLICY "Users can view challenge participants"
ON public.challenge_participants
FOR SELECT
USING (
  user_id = auth.uid() 
  OR public.is_challenge_participant_direct(challenge_id, auth.uid())
);

-- Policy for INSERT: Users can only insert themselves as participants
CREATE POLICY "Users can insert themselves as participants"
ON public.challenge_participants
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Policy for UPDATE: Users can only update their own participation
CREATE POLICY "Users can update their own participation"
ON public.challenge_participants
FOR UPDATE
USING (user_id = auth.uid());

-- Policy for DELETE: Users can only delete their own participation
CREATE POLICY "Users can delete their own participation"
ON public.challenge_participants
FOR DELETE
USING (user_id = auth.uid());