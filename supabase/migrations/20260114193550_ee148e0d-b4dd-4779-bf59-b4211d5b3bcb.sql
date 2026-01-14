-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Creator can update challenge before start" ON challenges;

-- Create a new policy that allows:
-- 1. Creator to update status to 'voided' at any time (for pending or active challenges)
-- 2. Creator to update other fields only before the challenge starts
CREATE POLICY "Creator can update challenges" ON challenges
FOR UPDATE 
USING (auth.uid() = created_by)
WITH CHECK (
  auth.uid() = created_by AND (
    -- Allow voiding (changing status to 'voided') at any time for pending/active challenges
    (status = 'voided') OR
    -- Allow other updates only before challenge starts
    (start_date > CURRENT_DATE)
  )
);