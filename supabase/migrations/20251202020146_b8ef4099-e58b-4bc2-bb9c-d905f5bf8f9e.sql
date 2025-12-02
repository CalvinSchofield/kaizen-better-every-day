-- Add policy to allow all authenticated users to view all reps for leaderboard purposes
CREATE POLICY "Authenticated users can view all reps for leaderboards" 
ON public.reps
FOR SELECT 
TO authenticated
USING (true);