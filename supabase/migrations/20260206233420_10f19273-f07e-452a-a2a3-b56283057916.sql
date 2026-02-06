-- Add policy for creators to view their own challenges
-- This fixes the RLS error when creating private challenges
CREATE POLICY "Creators can view their challenges"
ON public.challenges FOR SELECT
USING (auth.uid() = created_by);