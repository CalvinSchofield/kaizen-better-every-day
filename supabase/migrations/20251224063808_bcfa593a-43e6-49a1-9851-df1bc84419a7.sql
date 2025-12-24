-- Create area_directors table to explicitly track who is an Area Director
CREATE TABLE public.area_directors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.area_directors ENABLE ROW LEVEL SECURITY;

-- Everyone can view area directors
CREATE POLICY "Authenticated users can view area_directors"
ON public.area_directors FOR SELECT
TO authenticated
USING (true);

-- Only existing area directors can manage (bootstrap handled via service role)
CREATE POLICY "Area directors can insert area_directors"
ON public.area_directors FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.area_directors WHERE user_id = auth.uid())
);

CREATE POLICY "Area directors can update area_directors"
ON public.area_directors FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.area_directors WHERE user_id = auth.uid())
);

CREATE POLICY "Area directors can delete area_directors"
ON public.area_directors FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.area_directors WHERE user_id = auth.uid())
);

-- Update the is_area_director function to use the new table
CREATE OR REPLACE FUNCTION public.is_area_director(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.area_directors WHERE user_id = _user_id
  );
$$;