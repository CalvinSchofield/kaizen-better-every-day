-- Drop the existing update policy that only allows self-updates
DROP POLICY IF EXISTS "cp_update" ON challenge_participants;

-- Create a new policy that allows:
-- 1. Users to update their own participation (accept/decline)
-- 2. Challenge creator to update all participants (for auto-start when all are in downline)
CREATE POLICY "cp_update" ON challenge_participants
FOR UPDATE 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM challenges c 
    WHERE c.id = challenge_participants.challenge_id 
    AND c.created_by = auth.uid()
  )
);