
-- Function to check if a user's upline (recruiter) has onboarded to the app
-- Returns true if they have an active upline with a user account, false if bootstrapping
CREATE OR REPLACE FUNCTION public.has_active_upline(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Find the user's name from reps
    SELECT 1
    FROM public.reps r
    JOIN public.recruits rc ON normalize_name(rc.name) = normalize_name(r.name)
    JOIN public.reps recruiter_rep ON recruiter_rep.user_id = rc.recruiter_user_id
    WHERE r.user_id = _user_id
      AND rc.recruiter_user_id IS NOT NULL
      AND recruiter_rep.user_id IS NOT NULL
  )
$$;
