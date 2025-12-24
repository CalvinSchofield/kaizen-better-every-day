
-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE,
  name TEXT NOT NULL,
  lead_user_id UUID REFERENCES public.reps(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create mgmt_groups table
CREATE TABLE public.mgmt_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE,
  name TEXT NOT NULL,
  lead_user_id UUID REFERENCES public.reps(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create team_mgmt_groups junction table
CREATE TABLE public.team_mgmt_groups (
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  mgmt_group_id UUID REFERENCES public.mgmt_groups(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, mgmt_group_id)
);

-- Create recruits table
CREATE TABLE public.recruits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  stage TEXT DEFAULT '100 List',
  year TEXT DEFAULT 'Rookie',
  location TEXT,
  recruitment_source TEXT,
  last_contact DATE,
  next_action TEXT,
  next_action_due DATE,
  badge_id TEXT,
  
  -- Relations
  recruiter_user_id UUID REFERENCES public.reps(user_id),
  team_id UUID REFERENCES public.teams(id),
  mgmt_group_id UUID REFERENCES public.mgmt_groups(id),
  
  -- Onboarding status
  onboarding_complete BOOLEAN DEFAULT false,
  trainings_complete BOOLEAN DEFAULT false,
  slack_joined BOOLEAN DEFAULT false,
  ramp_phase_1_complete BOOLEAN DEFAULT false,
  ramp_phase_2_complete BOOLEAN DEFAULT false,
  ramp_phase_3_complete BOOLEAN DEFAULT false,
  ramp_phase_4_complete BOOLEAN DEFAULT false,
  ipad_assigned BOOLEAN DEFAULT false,
  blitz_ready BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create blitzes table
CREATE TABLE public.blitzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notion_page_id TEXT UNIQUE,
  name TEXT NOT NULL,
  date DATE NOT NULL,
  end_date DATE,
  location TEXT,
  address TEXT,
  wifi TEXT,
  code TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create recruit_blitzes junction table (committed blitzes)
CREATE TABLE public.recruit_blitzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id UUID REFERENCES public.recruits(id) ON DELETE CASCADE NOT NULL,
  blitz_id UUID REFERENCES public.blitzes(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recruit_id, blitz_id)
);

-- Enable RLS on all tables
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mgmt_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_mgmt_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blitzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruit_blitzes ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check if user is area director (leads all mgmt groups)
CREATE OR REPLACE FUNCTION public.is_area_director(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mgmt_groups 
    WHERE lead_user_id = _user_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.mgmt_groups 
    WHERE lead_user_id IS NULL OR lead_user_id != _user_id
    HAVING COUNT(*) > 0
  );
$$;

-- Create security definer function to check if user leads a mgmt group
CREATE OR REPLACE FUNCTION public.is_mgmt_group_lead(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mgmt_groups WHERE lead_user_id = _user_id
  );
$$;

-- Create security definer function to check if user leads a team
CREATE OR REPLACE FUNCTION public.is_team_lead(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.teams WHERE lead_user_id = _user_id
  );
$$;

-- Create security definer function to get accessible team IDs for a user
CREATE OR REPLACE FUNCTION public.get_accessible_team_ids(_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Teams user directly leads
  SELECT id FROM public.teams WHERE lead_user_id = _user_id
  UNION
  -- Teams under mgmt groups user leads
  SELECT tmg.team_id 
  FROM public.team_mgmt_groups tmg
  JOIN public.mgmt_groups mg ON mg.id = tmg.mgmt_group_id
  WHERE mg.lead_user_id = _user_id;
$$;

-- Create security definer function to check if user can access a recruit
CREATE OR REPLACE FUNCTION public.can_access_recruit(_user_id UUID, _recruit_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.recruits r
    WHERE r.id = _recruit_id
    AND (
      -- User is the recruiter
      r.recruiter_user_id = _user_id
      -- Or user leads the recruit's team
      OR r.team_id IN (SELECT public.get_accessible_team_ids(_user_id))
      -- Or user is area director (can see all)
      OR public.is_area_director(_user_id)
    )
  );
$$;

-- RLS Policies for teams
CREATE POLICY "Authenticated users can view teams"
ON public.teams FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Team leads can update their teams"
ON public.teams FOR UPDATE
TO authenticated
USING (lead_user_id = auth.uid() OR public.is_area_director(auth.uid()));

CREATE POLICY "Area directors can insert teams"
ON public.teams FOR INSERT
TO authenticated
WITH CHECK (public.is_area_director(auth.uid()));

CREATE POLICY "Area directors can delete teams"
ON public.teams FOR DELETE
TO authenticated
USING (public.is_area_director(auth.uid()));

-- RLS Policies for mgmt_groups
CREATE POLICY "Authenticated users can view mgmt_groups"
ON public.mgmt_groups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Mgmt group leads can update their groups"
ON public.mgmt_groups FOR UPDATE
TO authenticated
USING (lead_user_id = auth.uid() OR public.is_area_director(auth.uid()));

CREATE POLICY "Area directors can insert mgmt_groups"
ON public.mgmt_groups FOR INSERT
TO authenticated
WITH CHECK (public.is_area_director(auth.uid()));

CREATE POLICY "Area directors can delete mgmt_groups"
ON public.mgmt_groups FOR DELETE
TO authenticated
USING (public.is_area_director(auth.uid()));

-- RLS Policies for team_mgmt_groups
CREATE POLICY "Authenticated users can view team_mgmt_groups"
ON public.team_mgmt_groups FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Area directors can manage team_mgmt_groups"
ON public.team_mgmt_groups FOR ALL
TO authenticated
USING (public.is_area_director(auth.uid()))
WITH CHECK (public.is_area_director(auth.uid()));

-- RLS Policies for recruits
CREATE POLICY "Users can view accessible recruits"
ON public.recruits FOR SELECT
TO authenticated
USING (
  recruiter_user_id = auth.uid()
  OR team_id IN (SELECT public.get_accessible_team_ids(auth.uid()))
  OR public.is_area_director(auth.uid())
);

CREATE POLICY "Users can insert recruits for their team"
ON public.recruits FOR INSERT
TO authenticated
WITH CHECK (
  recruiter_user_id = auth.uid()
  OR public.is_team_lead(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_area_director(auth.uid())
);

CREATE POLICY "Users can update accessible recruits"
ON public.recruits FOR UPDATE
TO authenticated
USING (
  recruiter_user_id = auth.uid()
  OR team_id IN (SELECT public.get_accessible_team_ids(auth.uid()))
  OR public.is_area_director(auth.uid())
);

CREATE POLICY "Leaders can delete recruits"
ON public.recruits FOR DELETE
TO authenticated
USING (
  public.is_team_lead(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_area_director(auth.uid())
);

-- RLS Policies for blitzes
CREATE POLICY "Authenticated users can view blitzes"
ON public.blitzes FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Leaders can insert blitzes"
ON public.blitzes FOR INSERT
TO authenticated
WITH CHECK (
  public.is_team_lead(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_area_director(auth.uid())
);

CREATE POLICY "Leaders can update blitzes"
ON public.blitzes FOR UPDATE
TO authenticated
USING (
  public.is_team_lead(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_area_director(auth.uid())
);

CREATE POLICY "Leaders can delete blitzes"
ON public.blitzes FOR DELETE
TO authenticated
USING (
  public.is_team_lead(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_area_director(auth.uid())
);

-- RLS Policies for recruit_blitzes
CREATE POLICY "Users can view recruit_blitzes for accessible recruits"
ON public.recruit_blitzes FOR SELECT
TO authenticated
USING (
  recruit_id IN (
    SELECT id FROM public.recruits 
    WHERE recruiter_user_id = auth.uid()
    OR team_id IN (SELECT public.get_accessible_team_ids(auth.uid()))
    OR public.is_area_director(auth.uid())
  )
);

CREATE POLICY "Users can insert recruit_blitzes for accessible recruits"
ON public.recruit_blitzes FOR INSERT
TO authenticated
WITH CHECK (
  recruit_id IN (
    SELECT id FROM public.recruits 
    WHERE recruiter_user_id = auth.uid()
    OR team_id IN (SELECT public.get_accessible_team_ids(auth.uid()))
    OR public.is_area_director(auth.uid())
  )
);

CREATE POLICY "Users can delete recruit_blitzes for accessible recruits"
ON public.recruit_blitzes FOR DELETE
TO authenticated
USING (
  recruit_id IN (
    SELECT id FROM public.recruits 
    WHERE recruiter_user_id = auth.uid()
    OR team_id IN (SELECT public.get_accessible_team_ids(auth.uid()))
    OR public.is_area_director(auth.uid())
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_teams_updated_at
BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mgmt_groups_updated_at
BEFORE UPDATE ON public.mgmt_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recruits_updated_at
BEFORE UPDATE ON public.recruits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blitzes_updated_at
BEFORE UPDATE ON public.blitzes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_recruits_recruiter ON public.recruits(recruiter_user_id);
CREATE INDEX idx_recruits_team ON public.recruits(team_id);
CREATE INDEX idx_recruits_stage ON public.recruits(stage);
CREATE INDEX idx_blitzes_date ON public.blitzes(date);
CREATE INDEX idx_recruit_blitzes_recruit ON public.recruit_blitzes(recruit_id);
CREATE INDEX idx_recruit_blitzes_blitz ON public.recruit_blitzes(blitz_id);
