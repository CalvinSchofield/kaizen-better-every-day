
-- Create invite_codes table
CREATE TABLE public.invite_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  inviter_user_id uuid NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  mgmt_group_id uuid REFERENCES public.mgmt_groups(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  uses_count integer NOT NULL DEFAULT 0,
  max_uses integer,
  is_active boolean NOT NULL DEFAULT true
);

-- Add invite_code column to reps
ALTER TABLE public.reps ADD COLUMN IF NOT EXISTS invite_code_used text;

-- Add invite_code column to recruits  
ALTER TABLE public.recruits ADD COLUMN IF NOT EXISTS invite_code_used text;

-- Enable RLS
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- Policies: any authenticated user can view invite codes (needed to validate on signup)
CREATE POLICY "Anyone can view active invite codes"
  ON public.invite_codes FOR SELECT
  TO public
  USING (true);

-- Users can create their own invite codes
CREATE POLICY "Users can create own invite codes"
  ON public.invite_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = inviter_user_id);

-- Users can update their own invite codes
CREATE POLICY "Users can update own invite codes"
  ON public.invite_codes FOR UPDATE
  TO authenticated
  USING (auth.uid() = inviter_user_id);

-- Users can delete their own invite codes
CREATE POLICY "Users can delete own invite codes"
  ON public.invite_codes FOR DELETE
  TO authenticated
  USING (auth.uid() = inviter_user_id);
