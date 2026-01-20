
-- Fix sync_recruit_to_rep to sync by UUID first, then email fallback
CREATE OR REPLACE FUNCTION public.sync_recruit_to_rep()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Loop prevention: skip if we're already syncing from the other table
  IF current_setting('app.syncing_from_other_table', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Set guard to prevent reverse trigger from firing
  PERFORM set_config('app.syncing_from_other_table', 'true', true);

  -- PRIMARY: Update matching rep record by UUID (unified architecture)
  UPDATE public.reps
  SET 
    name = CASE WHEN NEW.name IS NOT NULL THEN NEW.name ELSE name END,
    email = CASE WHEN NEW.email IS NOT NULL THEN NEW.email ELSE email END,
    phone = CASE WHEN NEW.phone IS NOT NULL THEN NEW.phone ELSE phone END,
    stage = NEW.stage,
    year = COALESCE(NEW.year, year),
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
  WHERE id = NEW.id;

  -- FALLBACK: If no UUID match and email exists, try email-based match
  IF NOT FOUND AND NEW.email IS NOT NULL THEN
    UPDATE public.reps
    SET 
      name = CASE WHEN NEW.name IS NOT NULL THEN NEW.name ELSE name END,
      email = CASE WHEN NEW.email IS NOT NULL THEN NEW.email ELSE email END,
      phone = CASE WHEN NEW.phone IS NOT NULL THEN NEW.phone ELSE phone END,
      stage = NEW.stage,
      year = COALESCE(NEW.year, year),
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
    WHERE LOWER(email) = LOWER(NEW.email);
  END IF;

  -- Reset guard
  PERFORM set_config('app.syncing_from_other_table', 'false', true);

  RETURN NEW;
END;
$function$;

-- Fix sync_rep_to_recruit to sync by UUID first, then email fallback
CREATE OR REPLACE FUNCTION public.sync_rep_to_recruit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Loop prevention: skip if we're already syncing from the other table
  IF current_setting('app.syncing_from_other_table', true) = 'true' THEN
    RETURN NEW;
  END IF;
  
  -- Only sync if relevant fields changed
  IF (OLD.ramp_phase_1_complete IS NOT DISTINCT FROM NEW.ramp_phase_1_complete
      AND OLD.ramp_phase_2_complete IS NOT DISTINCT FROM NEW.ramp_phase_2_complete
      AND OLD.ramp_phase_3_complete IS NOT DISTINCT FROM NEW.ramp_phase_3_complete
      AND OLD.ramp_phase_4_complete IS NOT DISTINCT FROM NEW.ramp_phase_4_complete
      AND OLD.onboarding_complete IS NOT DISTINCT FROM NEW.onboarding_complete
      AND OLD.trainings_complete IS NOT DISTINCT FROM NEW.trainings_complete
      AND OLD.slack_joined IS NOT DISTINCT FROM NEW.slack_joined
      AND OLD.ipad_assigned IS NOT DISTINCT FROM NEW.ipad_assigned
      AND OLD.blitz_ready IS NOT DISTINCT FROM NEW.blitz_ready
      AND OLD.stage IS NOT DISTINCT FROM NEW.stage
      AND OLD.year IS NOT DISTINCT FROM NEW.year) THEN
    RETURN NEW;
  END IF;
  
  -- Set guard to prevent reverse trigger from firing
  PERFORM set_config('app.syncing_from_other_table', 'true', true);

  -- PRIMARY: Update matching recruit record by UUID (unified architecture)
  UPDATE public.recruits
  SET 
    stage = NEW.stage,
    year = COALESCE(NEW.year, year),
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
  WHERE id = NEW.id;

  -- FALLBACK: If no UUID match and email exists, try email-based match
  IF NOT FOUND AND NEW.email IS NOT NULL THEN
    UPDATE public.recruits
    SET 
      stage = NEW.stage,
      year = COALESCE(NEW.year, year),
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
    WHERE LOWER(email) = LOWER(NEW.email);
  END IF;

  -- Reset guard
  PERFORM set_config('app.syncing_from_other_table', 'false', true);

  RETURN NEW;
END;
$function$;
