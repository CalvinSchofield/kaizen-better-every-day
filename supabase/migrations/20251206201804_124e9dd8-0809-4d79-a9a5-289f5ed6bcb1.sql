-- Allow authenticated users to view all season_config for team reports
-- Application layer already scopes to leader's downline via useTeamAccess
CREATE POLICY "Authenticated users can view all season_config for reports"
ON public.season_config
FOR SELECT
TO authenticated
USING (true);