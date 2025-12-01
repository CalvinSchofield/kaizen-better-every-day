-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own entries" ON public.daily_entries;

-- Create new policy that allows all authenticated users to view all finalized entries
-- This enables leaderboards to show all reps' data while keeping personal data secure
CREATE POLICY "Users can view all finalized entries"
ON public.daily_entries
FOR SELECT
TO authenticated
USING (is_finalized = true);

-- Add additional policy to allow users to view their own entries (even non-finalized)
CREATE POLICY "Users can view own entries including drafts"
ON public.daily_entries
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);