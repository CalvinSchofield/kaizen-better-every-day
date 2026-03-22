-- Allow MGMT group leads to insert teams (bootstrap: they can manage their own groups)
DROP POLICY IF EXISTS "Area directors can insert teams" ON public.teams;
CREATE POLICY "Leaders can insert teams" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()));

-- Allow MGMT group leads to delete teams in their groups
DROP POLICY IF EXISTS "Area directors can delete teams" ON public.teams;
CREATE POLICY "Leaders can delete teams" ON public.teams
  FOR DELETE TO authenticated
  USING (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()));

-- Allow MGMT group leads to insert team_mgmt_groups linkages
DROP POLICY IF EXISTS "Leaders can insert team_mgmt_groups" ON public.team_mgmt_groups;
CREATE POLICY "Leaders can insert team_mgmt_groups" ON public.team_mgmt_groups
  FOR INSERT TO authenticated
  WITH CHECK (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()));

-- Allow MGMT group leads to delete team_mgmt_groups linkages
DROP POLICY IF EXISTS "Leaders can delete team_mgmt_groups" ON public.team_mgmt_groups;
CREATE POLICY "Leaders can delete team_mgmt_groups" ON public.team_mgmt_groups
  FOR DELETE TO authenticated
  USING (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()));