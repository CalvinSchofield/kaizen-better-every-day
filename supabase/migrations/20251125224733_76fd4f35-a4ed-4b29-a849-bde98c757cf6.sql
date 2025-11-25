-- Add ramp_to_blitz_phase column to store the Notion select property value
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS ramp_to_blitz_phase TEXT DEFAULT 'Not started';

-- Add comment explaining the column
COMMENT ON COLUMN public.reps.ramp_to_blitz_phase IS 'Tracks journey progress from Notion. Values: Not started, Onboarding ✅, Slack ✅, Trainings ✅, Phase 1, Phase 2, Phase 3, Phase 4, Phase 4 ✅';