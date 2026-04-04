
-- Streak protections table
CREATE TABLE public.streak_protections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  protection_type text NOT NULL CHECK (protection_type IN ('earned', 'recovery')),
  method text NOT NULL CHECK (method IN ('doors_150', 'presentations_150', 'recovery_sales', 'recovery_doors', 'recovery_prmr')),
  baseline_value numeric,
  actual_value numeric,
  streak_length integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, entry_date)
);

ALTER TABLE public.streak_protections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own protections"
  ON public.streak_protections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own protections"
  ON public.streak_protections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Leaders can view downline protections"
  ON public.streak_protections FOR SELECT
  TO authenticated
  USING (
    public.is_team_lead(auth.uid())
    OR public.is_mgmt_group_lead(auth.uid())
    OR public.is_area_director(auth.uid())
  );

-- Streak recovery windows table
CREATE TABLE public.streak_recovery_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  streak_lost_on date NOT NULL,
  recovery_deadline_date date,
  knocking_days_used jsonb DEFAULT '[]'::jsonb,
  target_fp numeric,
  target_prmr numeric,
  target_doors numeric,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'recovered', 'expired')),
  restored_streak integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.streak_recovery_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recovery windows"
  ON public.streak_recovery_windows FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own recovery windows"
  ON public.streak_recovery_windows FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own recovery windows"
  ON public.streak_recovery_windows FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Leaders can view downline recovery windows"
  ON public.streak_recovery_windows FOR SELECT
  TO authenticated
  USING (
    public.is_team_lead(auth.uid())
    OR public.is_mgmt_group_lead(auth.uid())
    OR public.is_area_director(auth.uid())
  );
