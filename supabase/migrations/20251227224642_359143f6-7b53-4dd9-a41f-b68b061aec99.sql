-- Drop existing delete policy on recruits
DROP POLICY IF EXISTS "Leaders can delete recruits" ON public.recruits;

-- Create new policy allowing only area directors to delete
CREATE POLICY "Area directors can delete recruits"
ON public.recruits
FOR DELETE
USING (is_area_director(auth.uid()));