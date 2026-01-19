-- Add self-reported onboarding columns for rookie self-service completion tracking
ALTER TABLE public.reps
ADD COLUMN IF NOT EXISTS self_reported_onboarding_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS self_reported_trainings_complete BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS self_reported_slack_joined BOOLEAN DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.reps.self_reported_onboarding_complete IS 'Set by rookie when they mark onboarding done, awaiting leader verification';
COMMENT ON COLUMN public.reps.self_reported_trainings_complete IS 'Set by rookie when they mark trainings done, awaiting leader verification';
COMMENT ON COLUMN public.reps.self_reported_slack_joined IS 'Set by rookie when they mark Slack joined, awaiting leader verification';