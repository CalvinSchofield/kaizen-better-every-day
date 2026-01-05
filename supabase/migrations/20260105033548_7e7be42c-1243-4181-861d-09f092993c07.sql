-- Create table for team/leader effort threshold customization
CREATE TABLE public.effort_thresholds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  mgmt_group_id UUID REFERENCES public.mgmt_groups(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  doors_per_hour_rookie NUMERIC NOT NULL DEFAULT 12,
  doors_per_hour_vet NUMERIC NOT NULL DEFAULT 15,
  late_start_minutes INTEGER NOT NULL DEFAULT 630,
  early_end_minutes INTEGER NOT NULL DEFAULT 1140,
  min_hours_worked NUMERIC NOT NULL DEFAULT 2,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Ensure only one threshold config per team or mgmt_group
  CONSTRAINT unique_team_threshold UNIQUE (team_id),
  CONSTRAINT unique_mgmt_group_threshold UNIQUE (mgmt_group_id),
  -- Ensure at least one scope is set
  CONSTRAINT has_scope CHECK (team_id IS NOT NULL OR mgmt_group_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.effort_thresholds ENABLE ROW LEVEL SECURITY;

-- Leaders can view thresholds for their teams
CREATE POLICY "Leaders can view effort thresholds"
ON public.effort_thresholds
FOR SELECT
USING (
  is_team_lead(auth.uid()) OR 
  is_mgmt_group_lead(auth.uid()) OR 
  is_area_director(auth.uid())
);

-- Leaders can insert thresholds for their teams
CREATE POLICY "Leaders can insert effort thresholds"
ON public.effort_thresholds
FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  (is_team_lead(auth.uid()) OR is_mgmt_group_lead(auth.uid()) OR is_area_director(auth.uid()))
);

-- Leaders can update their own thresholds
CREATE POLICY "Leaders can update effort thresholds"
ON public.effort_thresholds
FOR UPDATE
USING (
  auth.uid() = created_by OR is_area_director(auth.uid())
);

-- Leaders can delete their own thresholds
CREATE POLICY "Leaders can delete effort thresholds"
ON public.effort_thresholds
FOR DELETE
USING (
  auth.uid() = created_by OR is_area_director(auth.uid())
);

-- Create updated_at trigger
CREATE TRIGGER update_effort_thresholds_updated_at
BEFORE UPDATE ON public.effort_thresholds
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();