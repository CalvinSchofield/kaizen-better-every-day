
-- Update RLS policies to only allow self-serve when upline hasn't onboarded
-- Bootstrap condition: leader role + no active upline

DROP POLICY IF EXISTS "Leaders can insert teams" ON public.teams;
CREATE POLICY "Leaders can insert teams" ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Corporate can always do it
    is_corporate(auth.uid())
    -- Leaders can self-serve only when bootstrapping (no active upline)
    OR (
      (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()))
      AND NOT has_active_upline(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Leaders can delete teams" ON public.teams;
CREATE POLICY "Leaders can delete teams" ON public.teams
  FOR DELETE TO authenticated
  USING (
    is_corporate(auth.uid())
    OR (
      (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()))
      AND NOT has_active_upline(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Leaders can insert team_mgmt_groups" ON public.team_mgmt_groups;
CREATE POLICY "Leaders can insert team_mgmt_groups" ON public.team_mgmt_groups
  FOR INSERT TO authenticated
  WITH CHECK (
    is_corporate(auth.uid())
    OR (
      (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()))
      AND NOT has_active_upline(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Leaders can delete team_mgmt_groups" ON public.team_mgmt_groups;
CREATE POLICY "Leaders can delete team_mgmt_groups" ON public.team_mgmt_groups
  FOR DELETE TO authenticated
  USING (
    is_corporate(auth.uid())
    OR (
      (is_area_director(auth.uid()) OR is_mgmt_group_lead(auth.uid()))
      AND NOT has_active_upline(auth.uid())
    )
  );
