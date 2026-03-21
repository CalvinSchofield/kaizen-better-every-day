
-- Create offices table
CREATE TABLE public.offices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Create office_staff table (links users to offices with roles)
CREATE TABLE public.office_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'area_director',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(office_id, user_id)
);

-- Add office_id to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;

-- Add office_id to mgmt_groups
ALTER TABLE public.mgmt_groups ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_staff ENABLE ROW LEVEL SECURITY;

-- Security definer function to check if user is office staff
CREATE OR REPLACE FUNCTION public.is_office_staff(_user_id uuid, _office_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_staff
    WHERE user_id = _user_id AND office_id = _office_id
  )
$$;

-- Security definer function to check if user is corporate
CREATE OR REPLACE FUNCTION public.is_corporate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_staff
    WHERE user_id = _user_id AND role = 'corporate'
  )
$$;

-- Security definer function to get user's office IDs
CREATE OR REPLACE FUNCTION public.get_user_office_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT office_id FROM public.office_staff WHERE user_id = _user_id
$$;

-- RLS for offices: authenticated users can view all offices, office staff/corporate/AD can manage
CREATE POLICY "Authenticated users can view offices"
  ON public.offices FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Corporate and AD can insert offices"
  ON public.offices FOR INSERT
  TO authenticated
  WITH CHECK (
    is_corporate(auth.uid()) OR is_area_director(auth.uid())
  );

CREATE POLICY "Corporate and AD can update offices"
  ON public.offices FOR UPDATE
  TO authenticated
  USING (
    is_corporate(auth.uid()) OR is_office_staff(auth.uid(), id)
  );

CREATE POLICY "Corporate can delete offices"
  ON public.offices FOR DELETE
  TO authenticated
  USING (is_corporate(auth.uid()));

-- RLS for office_staff: viewable by authenticated, manageable by corporate/AD
CREATE POLICY "Authenticated users can view office_staff"
  ON public.office_staff FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Corporate and AD can insert office_staff"
  ON public.office_staff FOR INSERT
  TO authenticated
  WITH CHECK (
    is_corporate(auth.uid()) OR is_area_director(auth.uid())
  );

CREATE POLICY "Corporate and AD can update office_staff"
  ON public.office_staff FOR UPDATE
  TO authenticated
  USING (
    is_corporate(auth.uid()) OR is_area_director(auth.uid())
  );

CREATE POLICY "Corporate can delete office_staff"
  ON public.office_staff FOR DELETE
  TO authenticated
  USING (is_corporate(auth.uid()) OR is_area_director(auth.uid()));
