-- Drop and recreate the update policy to allow:
-- 1. Voiding any pending/active challenge created by the user
-- 2. Changing status from pending to active (for auto-start)
-- 3. Other updates before the challenge starts

DROP POLICY IF EXISTS "Creator can update challenges" ON challenges;

CREATE POLICY "Creator can update challenges" ON challenges
FOR UPDATE 
USING (auth.uid() = created_by)
WITH CHECK (
  auth.uid() = created_by AND (
    -- Allow voiding any non-completed challenge
    status = 'voided' OR
    -- Allow changing from pending to active (auto-start)
    (status = 'active' AND (SELECT c.status FROM challenges c WHERE c.id = challenges.id) = 'pending') OR
    -- Allow other updates before the challenge starts
    start_date > CURRENT_DATE
  )
);