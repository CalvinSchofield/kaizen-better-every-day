-- Add RLS policies for blitz_invites table
-- This table tracks which reps have been contacted/invited to blitzes
-- Leaders need to see all invites to coordinate outreach

-- Allow all authenticated users to view blitz invites
CREATE POLICY "Authenticated users can view blitz invites"
ON public.blitz_invites
FOR SELECT
TO authenticated
USING (true);

-- Allow all authenticated users to insert/update blitz invites
-- This enables leaders to mark team members as contacted
CREATE POLICY "Authenticated users can manage blitz invites"
ON public.blitz_invites
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update blitz invites"
ON public.blitz_invites
FOR UPDATE
TO authenticated
USING (true);