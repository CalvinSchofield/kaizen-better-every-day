
-- Create a SECURITY DEFINER function to get all recruit IDs in a user's recursive downline
CREATE OR REPLACE FUNCTION public.get_downline_recruit_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE downline AS (
    -- Base: direct recruits
    SELECT r.id, rp.user_id as recruit_user_id
    FROM recruits r
    LEFT JOIN reps rp ON rp.id = r.id
    WHERE r.recruiter_user_id = _user_id
    
    UNION ALL
    
    -- Recursive: recruits recruited by people in the downline
    SELECT r.id, rp.user_id as recruit_user_id
    FROM recruits r
    LEFT JOIN reps rp ON rp.id = r.id
    INNER JOIN downline d ON r.recruiter_user_id = d.recruit_user_id
    WHERE d.recruit_user_id IS NOT NULL
  )
  SELECT id FROM downline
$$;

-- Add a new PERMISSIVE SELECT policy so users can see their full recursive downline
CREATE POLICY "Users can view recursive downline recruits"
ON public.recruits
FOR SELECT
TO authenticated
USING (id IN (SELECT public.get_downline_recruit_ids(auth.uid())));
