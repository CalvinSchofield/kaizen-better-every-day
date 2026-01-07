-- Create challenges table
CREATE TABLE public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('1v1', 'group')),
  metric text NOT NULL CHECK (metric IN ('fp_plus', 'prmr', 'transitions', 'doors_knocked')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'declined', 'active', 'completed', 'voided')),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  stakes text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  winner_user_id uuid REFERENCES auth.users(id),
  is_tie boolean DEFAULT false,
  tiebreaker_winner_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- Create challenge_participants table
CREATE TABLE public.challenge_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  team text CHECK (team IN ('a', 'b')),
  role text NOT NULL CHECK (role IN ('captain_a', 'captain_b', 'member')),
  accepted boolean,
  final_value numeric,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

-- Create incentives table
CREATE TABLE public.incentives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL,
  description text,
  reward text NOT NULL,
  metric text NOT NULL CHECK (metric IN ('fp_plus', 'prmr', 'transitions', 'doors_knocked')),
  target_type text NOT NULL CHECK (target_type IN ('first_to', 'most_by_end')),
  target_value numeric,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  winner_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT valid_incentive_date_range CHECK (end_date >= start_date)
);

-- Create incentive_eligible_reps table
CREATE TABLE public.incentive_eligible_reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incentive_id uuid NOT NULL REFERENCES public.incentives(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(incentive_id, user_id)
);

-- Enable RLS on all tables
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incentive_eligible_reps ENABLE ROW LEVEL SECURITY;

-- RLS Policies for challenges
CREATE POLICY "Users can view public challenges"
  ON public.challenges FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Participants can view their private challenges"
  ON public.challenges FOR SELECT
  USING (
    visibility = 'private' AND
    EXISTS (
      SELECT 1 FROM public.challenge_participants cp
      WHERE cp.challenge_id = id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can create challenges"
  ON public.challenges FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creator can update challenge before start"
  ON public.challenges FOR UPDATE
  USING (auth.uid() = created_by AND start_date > CURRENT_DATE);

-- RLS Policies for challenge_participants
CREATE POLICY "Users can view participants of visible challenges"
  ON public.challenge_participants FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id AND (
        c.visibility = 'public' OR
        EXISTS (
          SELECT 1 FROM public.challenge_participants cp2
          WHERE cp2.challenge_id = c.id AND cp2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Challenge creator can add participants"
  ON public.challenge_participants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.challenges c
      WHERE c.id = challenge_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Participants can update their own acceptance"
  ON public.challenge_participants FOR UPDATE
  USING (user_id = auth.uid());

-- RLS Policies for incentives
CREATE POLICY "Users can view public incentives"
  ON public.incentives FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Eligible reps can view private incentives"
  ON public.incentives FOR SELECT
  USING (
    visibility = 'private' AND
    EXISTS (
      SELECT 1 FROM public.incentive_eligible_reps ier
      WHERE ier.incentive_id = id AND ier.user_id = auth.uid()
    )
  );

CREATE POLICY "Leaders can create incentives"
  ON public.incentives FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND
    (is_team_lead(auth.uid()) OR is_mgmt_group_lead(auth.uid()) OR is_area_director(auth.uid()))
  );

CREATE POLICY "Creator can update their incentives"
  ON public.incentives FOR UPDATE
  USING (auth.uid() = created_by);

-- RLS Policies for incentive_eligible_reps
CREATE POLICY "Users can view eligible reps for visible incentives"
  ON public.incentive_eligible_reps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.incentives i
      WHERE i.id = incentive_id AND (
        i.visibility = 'public' OR
        EXISTS (
          SELECT 1 FROM public.incentive_eligible_reps ier2
          WHERE ier2.incentive_id = i.id AND ier2.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Incentive creator can manage eligible reps"
  ON public.incentive_eligible_reps FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.incentives i
      WHERE i.id = incentive_id AND i.created_by = auth.uid()
    )
  );

CREATE POLICY "Incentive creator can delete eligible reps"
  ON public.incentive_eligible_reps FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.incentives i
      WHERE i.id = incentive_id AND i.created_by = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_challenges_status ON public.challenges(status);
CREATE INDEX idx_challenges_created_by ON public.challenges(created_by);
CREATE INDEX idx_challenges_dates ON public.challenges(start_date, end_date);
CREATE INDEX idx_challenge_participants_challenge ON public.challenge_participants(challenge_id);
CREATE INDEX idx_challenge_participants_user ON public.challenge_participants(user_id);
CREATE INDEX idx_incentives_status ON public.incentives(status);
CREATE INDEX idx_incentives_created_by ON public.incentives(created_by);
CREATE INDEX idx_incentive_eligible_reps_incentive ON public.incentive_eligible_reps(incentive_id);
CREATE INDEX idx_incentive_eligible_reps_user ON public.incentive_eligible_reps(user_id);