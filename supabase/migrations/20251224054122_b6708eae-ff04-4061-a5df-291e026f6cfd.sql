-- Create blitz_accommodations table for multi-Airbnb support
CREATE TABLE public.blitz_accommodations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blitz_id UUID NOT NULL REFERENCES public.blitzes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  wifi_password TEXT,
  door_code TEXT,
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add created_by to blitzes table
ALTER TABLE public.blitzes ADD COLUMN IF NOT EXISTS created_by UUID;

-- Enable RLS on blitz_accommodations
ALTER TABLE public.blitz_accommodations ENABLE ROW LEVEL SECURITY;

-- RLS policies for blitz_accommodations (same as blitzes - all auth can view, leaders can manage)
CREATE POLICY "Authenticated users can view accommodations"
ON public.blitz_accommodations
FOR SELECT
USING (true);

CREATE POLICY "Leaders can insert accommodations"
ON public.blitz_accommodations
FOR INSERT
WITH CHECK (is_team_lead(auth.uid()) OR is_mgmt_group_lead(auth.uid()) OR is_area_director(auth.uid()));

CREATE POLICY "Leaders can update accommodations"
ON public.blitz_accommodations
FOR UPDATE
USING (is_team_lead(auth.uid()) OR is_mgmt_group_lead(auth.uid()) OR is_area_director(auth.uid()));

CREATE POLICY "Leaders can delete accommodations"
ON public.blitz_accommodations
FOR DELETE
USING (is_team_lead(auth.uid()) OR is_mgmt_group_lead(auth.uid()) OR is_area_director(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_blitz_accommodations_updated_at
  BEFORE UPDATE ON public.blitz_accommodations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing accommodation data from blitzes table
INSERT INTO public.blitz_accommodations (blitz_id, name, address, wifi_password, door_code, sort_order)
SELECT 
  id,
  'Main House',
  address,
  wifi,
  code,
  0
FROM public.blitzes
WHERE address IS NOT NULL OR wifi IS NOT NULL OR code IS NOT NULL;