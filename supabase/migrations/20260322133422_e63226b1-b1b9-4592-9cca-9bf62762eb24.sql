-- Allow Sr MGMT Group leads and senior_manager+ to manage sr_mgmt_groups
CREATE POLICY "Leaders can manage sr_mgmt_groups"
  ON public.sr_mgmt_groups FOR ALL TO authenticated
  USING (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'senior_manager'::app_role)
  )
  WITH CHECK (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'senior_manager'::app_role)
  );

-- Allow Sr Region leads and sr_regional+ to manage sr_regions
CREATE POLICY "Leaders can manage sr_regions"
  ON public.sr_regions FOR ALL TO authenticated
  USING (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'sr_regional'::app_role)
  )
  WITH CHECK (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'sr_regional'::app_role)
  );

-- Allow Partner leads and partner+ to manage partners
CREATE POLICY "Leaders can manage partners"
  ON public.partners FOR ALL TO authenticated
  USING (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'partner'::app_role)
  )
  WITH CHECK (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'partner'::app_role)
  );

-- Allow Division leads and divisional+ to manage divisions
CREATE POLICY "Leaders can manage divisions"
  ON public.divisions FOR ALL TO authenticated
  USING (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'divisional'::app_role)
  )
  WITH CHECK (
    lead_user_id = auth.uid()
    OR public.has_min_role(auth.uid(), 'divisional'::app_role)
  );