
-- Create role enum for expanded hierarchy
CREATE TYPE public.app_role AS ENUM ('assistant_manager', 'regional', 'sr_regional', 'partner', 'divisional', 'corporate');

-- Create user_roles table (per security best practices - separate from profiles)
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at timestamptz DEFAULT now(),
    assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Helper: check if user has any role at or above a given level
CREATE OR REPLACE FUNCTION public.has_min_role(_user_id uuid, _min_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role >= _min_role
  )
$$;

-- RLS: Everyone can view roles, only corporate can manage
CREATE POLICY "Authenticated users can view user_roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Corporate can insert user_roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (public.is_corporate(auth.uid()));

CREATE POLICY "Corporate can update user_roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (public.is_corporate(auth.uid()));

CREATE POLICY "Corporate can delete user_roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (public.is_corporate(auth.uid()));

-- Update is_corporate to also check user_roles table
CREATE OR REPLACE FUNCTION public.is_corporate(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.office_staff WHERE user_id = _user_id AND role = 'corporate'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'corporate'
  )
$$;

-- Migrate existing corporate users from office_staff into user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT user_id, 'corporate'::app_role
FROM public.office_staff
WHERE role = 'corporate'
ON CONFLICT (user_id, role) DO NOTHING;
