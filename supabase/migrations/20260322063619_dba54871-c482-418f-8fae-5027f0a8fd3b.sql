
-- ============================================================
-- Sr MGMT Groups: house multiple mgmt_groups under a senior manager
-- ============================================================
CREATE TABLE public.sr_mgmt_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_user_id UUID REFERENCES public.reps(user_id),
  office_id UUID REFERENCES public.offices(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sr_mgmt_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sr_mgmt_groups"
  ON public.sr_mgmt_groups FOR SELECT TO authenticated USING (true);

CREATE POLICY "Corporate can manage sr_mgmt_groups"
  ON public.sr_mgmt_groups FOR ALL TO authenticated
  USING (public.is_corporate(auth.uid()));

-- Link mgmt_groups to their parent sr_mgmt_group
ALTER TABLE public.mgmt_groups ADD COLUMN sr_mgmt_group_id UUID REFERENCES public.sr_mgmt_groups(id);

-- ============================================================
-- Sr Regions: house multiple regions under a sr_regional
-- ============================================================
CREATE TABLE public.sr_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_user_id UUID REFERENCES public.reps(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.sr_regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view sr_regions"
  ON public.sr_regions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Corporate can manage sr_regions"
  ON public.sr_regions FOR ALL TO authenticated
  USING (public.is_corporate(auth.uid()));

-- Link regions to their parent sr_region
ALTER TABLE public.regions ADD COLUMN sr_region_id UUID REFERENCES public.sr_regions(id);

-- ============================================================
-- Partners: house multiple sr_regions under a partner
-- ============================================================
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_user_id UUID REFERENCES public.reps(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view partners"
  ON public.partners FOR SELECT TO authenticated USING (true);

CREATE POLICY "Corporate can manage partners"
  ON public.partners FOR ALL TO authenticated
  USING (public.is_corporate(auth.uid()));

-- Link sr_regions to their parent partner
ALTER TABLE public.sr_regions ADD COLUMN partner_id UUID REFERENCES public.partners(id);

-- ============================================================
-- Divisions: house multiple partners under a divisional leader
-- ============================================================
CREATE TABLE public.divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  lead_user_id UUID REFERENCES public.reps(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view divisions"
  ON public.divisions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Corporate can manage divisions"
  ON public.divisions FOR ALL TO authenticated
  USING (public.is_corporate(auth.uid()));

-- Link partners to their parent division
ALTER TABLE public.partners ADD COLUMN division_id UUID REFERENCES public.divisions(id);
