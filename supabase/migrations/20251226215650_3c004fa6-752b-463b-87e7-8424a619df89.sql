-- Fix sync_recruit_to_rep to properly sync stage changes
-- The old version used COALESCE which prevented overwriting existing values

CREATE OR REPLACE FUNCTION public.sync_recruit_to_rep()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update matching rep record if exists (match by notion_page_id or email for ghost reps)
  -- Use NEW values directly instead of COALESCE to ensure changes are synced
  UPDATE public.reps
  SET 
    name = CASE WHEN NEW.name IS NOT NULL THEN NEW.name ELSE name END,
    email = CASE WHEN NEW.email IS NOT NULL THEN NEW.email ELSE email END,
    phone = CASE WHEN NEW.phone IS NOT NULL THEN NEW.phone ELSE phone END,
    stage = NEW.stage,  -- Always sync stage - this is critical for exit stages
    onboarding_complete = COALESCE(NEW.onboarding_complete, onboarding_complete),
    trainings_complete = COALESCE(NEW.trainings_complete, trainings_complete),
    slack_joined = COALESCE(NEW.slack_joined, slack_joined),
    ramp_phase_1_complete = COALESCE(NEW.ramp_phase_1_complete, ramp_phase_1_complete),
    ramp_phase_2_complete = COALESCE(NEW.ramp_phase_2_complete, ramp_phase_2_complete),
    ramp_phase_3_complete = COALESCE(NEW.ramp_phase_3_complete, ramp_phase_3_complete),
    ramp_phase_4_complete = COALESCE(NEW.ramp_phase_4_complete, ramp_phase_4_complete),
    blitz_ready = COALESCE(NEW.blitz_ready, blitz_ready),
    ipad_assigned = COALESCE(NEW.ipad_assigned, ipad_assigned),
    updated_at = NOW()
  WHERE notion_page_id = NEW.notion_page_id
     OR (user_id IS NULL AND NEW.email IS NOT NULL AND LOWER(email) = LOWER(NEW.email));

  RETURN NEW;
END;
$$;