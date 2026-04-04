
-- 1. Create challenge_teams table for car_wars metadata
CREATE TABLE public.challenge_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  team_label text NOT NULL DEFAULT '',
  team_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, team_key)
);

ALTER TABLE public.challenge_teams ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the challenge can see its teams
CREATE POLICY "Anyone can view challenge teams for visible challenges"
ON public.challenge_teams FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_teams.challenge_id
    AND (c.visibility = 'public' OR c.created_by = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.challenge_participants cp
        WHERE cp.challenge_id = c.id AND cp.user_id = auth.uid()
      ))
  )
);

-- Creator can insert teams
CREATE POLICY "Creator can insert challenge teams"
ON public.challenge_teams FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_teams.challenge_id AND c.created_by = auth.uid()
  )
);

-- Creator can update teams
CREATE POLICY "Creator can update challenge teams"
ON public.challenge_teams FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_teams.challenge_id AND c.created_by = auth.uid()
  )
);

-- Creator can delete teams
CREATE POLICY "Creator can delete challenge teams"
ON public.challenge_teams FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.challenges c
    WHERE c.id = challenge_teams.challenge_id AND c.created_by = auth.uid()
  )
);

-- 2. Add winner_team_key to challenges for car_wars winner tracking
ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS winner_team_key text;
