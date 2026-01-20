-- Create official_totals table for storing verified Vivint totals
CREATE TABLE public.official_totals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  season_year INTEGER NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('preseason', 'summer')),
  fp_plus NUMERIC DEFAULT 0,
  prmr NUMERIC DEFAULT 0,
  knocking_days INTEGER DEFAULT 0,
  last_verified_at TIMESTAMPTZ,
  verified_by TEXT CHECK (verified_by IN ('self', 'leader', 'import')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, season_year, season_type)
);

-- Enable RLS
ALTER TABLE public.official_totals ENABLE ROW LEVEL SECURITY;

-- Users can view their own official totals
CREATE POLICY "Users can view their own official totals"
ON public.official_totals
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own official totals
CREATE POLICY "Users can insert their own official totals"
ON public.official_totals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own official totals
CREATE POLICY "Users can update their own official totals"
ON public.official_totals
FOR UPDATE
USING (auth.uid() = user_id);

-- Leaders can view official totals for their accessible users
CREATE POLICY "Leaders can view downline official totals"
ON public.official_totals
FOR SELECT
USING (
  public.is_area_director(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_team_lead(auth.uid())
);

-- Leaders can update official totals for their accessible users (leader verification)
CREATE POLICY "Leaders can update downline official totals"
ON public.official_totals
FOR UPDATE
USING (
  public.is_area_director(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_team_lead(auth.uid())
);

-- Leaders can insert official totals for their accessible users
CREATE POLICY "Leaders can insert downline official totals"
ON public.official_totals
FOR INSERT
WITH CHECK (
  public.is_area_director(auth.uid())
  OR public.is_mgmt_group_lead(auth.uid())
  OR public.is_team_lead(auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_official_totals_updated_at
BEFORE UPDATE ON public.official_totals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();