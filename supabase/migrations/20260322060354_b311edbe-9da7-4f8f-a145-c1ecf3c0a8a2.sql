-- Drop the old restrictive insert policy on incentives
DROP POLICY IF EXISTS "Leaders can create incentives" ON public.incentives;

-- Allow any authenticated user to create incentives
CREATE POLICY "Authenticated users can create incentives"
ON public.incentives
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Drop the old restrictive insert policy on challenges  
DROP POLICY IF EXISTS "Authenticated users can create challenges" ON public.challenges;

-- Allow any authenticated user to create challenges
CREATE POLICY "Authenticated users can create challenges"
ON public.challenges
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);