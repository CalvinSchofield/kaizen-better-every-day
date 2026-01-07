-- Fix infinite recursion in RLS policies by replacing self-referencing subqueries

-- 1) Security definer helpers (bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_challenge_participant(_challenge_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.challenge_participants cp
    where cp.challenge_id = _challenge_id
      and cp.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_challenge_participant(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_challenge_participant(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_incentive_eligible(_incentive_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  select exists (
    select 1
    from public.incentive_eligible_reps ier
    where ier.incentive_id = _incentive_id
      and ier.user_id = _user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_incentive_eligible(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_incentive_eligible(uuid, uuid) TO authenticated;

-- 2) challenge_participants: drop recursive + overly-permissive policies
DROP POLICY IF EXISTS "Users can view participants of visible challenges" ON public.challenge_participants;
DROP POLICY IF EXISTS "Challenge creator can add participants" ON public.challenge_participants;
DROP POLICY IF EXISTS "Participants can update their own acceptance" ON public.challenge_participants;
DROP POLICY IF EXISTS "cp_select" ON public.challenge_participants;
DROP POLICY IF EXISTS "cp_insert" ON public.challenge_participants;
DROP POLICY IF EXISTS "cp_update" ON public.challenge_participants;
DROP POLICY IF EXISTS "cp_delete" ON public.challenge_participants;

-- Recreate safe policies (no recursion)
CREATE POLICY "challenge_participants_select"
ON public.challenge_participants
FOR SELECT
TO authenticated
USING (
  exists (
    select 1
    from public.challenges c
    where c.id = challenge_participants.challenge_id
      and (
        c.visibility = 'public'
        or c.created_by = auth.uid()
        or public.is_challenge_participant(c.id, auth.uid())
      )
  )
);

CREATE POLICY "challenge_participants_insert"
ON public.challenge_participants
FOR INSERT
TO authenticated
WITH CHECK (
  exists (
    select 1
    from public.challenges c
    where c.id = challenge_participants.challenge_id
      and c.created_by = auth.uid()
  )
);

CREATE POLICY "challenge_participants_update"
ON public.challenge_participants
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "challenge_participants_delete"
ON public.challenge_participants
FOR DELETE
TO authenticated
USING (
  exists (
    select 1
    from public.challenges c
    where c.id = challenge_participants.challenge_id
      and c.created_by = auth.uid()
  )
);

-- 3) incentive_eligible_reps: drop recursive + overly-permissive policies
DROP POLICY IF EXISTS "Users can view eligible reps for visible incentives" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "Incentive creator can manage eligible reps" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "Incentive creator can delete eligible reps" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "ier_select" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "ier_insert" ON public.incentive_eligible_reps;
DROP POLICY IF EXISTS "ier_delete" ON public.incentive_eligible_reps;

-- Recreate safe policies (no recursion)
CREATE POLICY "incentive_eligible_reps_select"
ON public.incentive_eligible_reps
FOR SELECT
TO authenticated
USING (
  exists (
    select 1
    from public.incentives i
    where i.id = incentive_eligible_reps.incentive_id
      and (
        i.visibility = 'public'
        or i.created_by = auth.uid()
        or public.is_incentive_eligible(i.id, auth.uid())
      )
  )
);

CREATE POLICY "incentive_eligible_reps_insert"
ON public.incentive_eligible_reps
FOR INSERT
TO authenticated
WITH CHECK (
  exists (
    select 1
    from public.incentives i
    where i.id = incentive_eligible_reps.incentive_id
      and i.created_by = auth.uid()
  )
);

CREATE POLICY "incentive_eligible_reps_delete"
ON public.incentive_eligible_reps
FOR DELETE
TO authenticated
USING (
  exists (
    select 1
    from public.incentives i
    where i.id = incentive_eligible_reps.incentive_id
      and i.created_by = auth.uid()
  )
);
