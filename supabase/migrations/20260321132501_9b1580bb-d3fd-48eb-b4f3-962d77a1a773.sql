
-- Create regions table for organizational grouping
CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  lead_user_id uuid REFERENCES public.reps(user_id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add region_id to offices
ALTER TABLE public.offices ADD COLUMN region_id uuid REFERENCES public.regions(id);

-- Enable RLS
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

-- RLS: authenticated users can read regions
CREATE POLICY "Authenticated users can read regions"
ON public.regions FOR SELECT TO authenticated
USING (true);

-- RLS: only regional+ can manage regions (use has_min_role)
CREATE POLICY "Regional+ can manage regions"
ON public.regions FOR ALL TO authenticated
USING (public.has_min_role(auth.uid(), 'regional'))
WITH CHECK (public.has_min_role(auth.uid(), 'regional'));
