
-- Step 1: Update sync_recruit_to_rep with loop prevention
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

  -- Update matching rep record if exists (match by notion_page_id or email for ghost reps)
  UPDATE public.reps
  SET 
    name = CASE WHEN NEW.name IS NOT NULL THEN NEW.name ELSE name END,
    email = CASE WHEN NEW.email IS NOT NULL THEN NEW.email ELSE email END,
    phone = CASE WHEN NEW.phone IS NOT NULL THEN NEW.phone ELSE phone END,
    stage = NEW.stage,
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

  -- Reset guard
  PERFORM set_config('app.syncing_from_other_table', 'false', true);

  RETURN NEW;
END;
$function$;

-- Step 2: Create new sync_rep_to_recruit trigger function (reverse sync)
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
      AND OLD.stage IS NOT DISTINCT FROM NEW.stage) THEN
    RETURN NEW;
  END IF;
  
  -- Set guard to prevent reverse trigger from firing
  PERFORM set_config('app.syncing_from_other_table', 'true', true);

  -- Update matching recruit record (match by notion_page_id or email)
  UPDATE public.recruits
  SET 
    stage = NEW.stage,
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
     OR (NEW.email IS NOT NULL AND LOWER(email) = LOWER(NEW.email));

  -- Reset guard
  PERFORM set_config('app.syncing_from_other_table', 'false', true);

  RETURN NEW;
END;
$function$;

-- Step 3: Create the trigger for sync_rep_to_recruit
DROP TRIGGER IF EXISTS sync_rep_to_recruit_trigger ON public.reps;
CREATE TRIGGER sync_rep_to_recruit_trigger
  AFTER UPDATE ON public.reps
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_rep_to_recruit();

-- Step 4: Fix existing data discrepancies (sync recruits -> reps where recruits has more complete data)
UPDATE public.reps r
SET 
  ramp_phase_1_complete = COALESCE(rec.ramp_phase_1_complete, r.ramp_phase_1_complete),
  ramp_phase_2_complete = COALESCE(rec.ramp_phase_2_complete, r.ramp_phase_2_complete),
  ramp_phase_3_complete = COALESCE(rec.ramp_phase_3_complete, r.ramp_phase_3_complete),
  ramp_phase_4_complete = COALESCE(rec.ramp_phase_4_complete, r.ramp_phase_4_complete),
  onboarding_complete = COALESCE(rec.onboarding_complete, r.onboarding_complete),
  trainings_complete = COALESCE(rec.trainings_complete, r.trainings_complete),
  slack_joined = COALESCE(rec.slack_joined, r.slack_joined),
  ipad_assigned = COALESCE(rec.ipad_assigned, r.ipad_assigned),
  blitz_ready = COALESCE(rec.blitz_ready, r.blitz_ready),
  updated_at = NOW()
FROM public.recruits rec
WHERE (r.notion_page_id = rec.notion_page_id AND r.notion_page_id IS NOT NULL)
   OR (r.email IS NOT NULL AND LOWER(r.email) = LOWER(rec.email))
AND (
  (rec.ramp_phase_1_complete = true AND COALESCE(r.ramp_phase_1_complete, false) = false)
  OR (rec.ramp_phase_2_complete = true AND COALESCE(r.ramp_phase_2_complete, false) = false)
  OR (rec.ramp_phase_3_complete = true AND COALESCE(r.ramp_phase_3_complete, false) = false)
  OR (rec.ramp_phase_4_complete = true AND COALESCE(r.ramp_phase_4_complete, false) = false)
  OR (rec.onboarding_complete = true AND COALESCE(r.onboarding_complete, false) = false)
  OR (rec.trainings_complete = true AND COALESCE(r.trainings_complete, false) = false)
  OR (rec.slack_joined = true AND COALESCE(r.slack_joined, false) = false)
  OR (rec.ipad_assigned = true AND COALESCE(r.ipad_assigned, false) = false)
  OR (rec.blitz_ready = true AND COALESCE(r.blitz_ready, false) = false)
);
