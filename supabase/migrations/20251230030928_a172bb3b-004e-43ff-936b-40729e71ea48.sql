-- Update sync_recruit_to_rep to match on email only (no notion_page_id)
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

  -- Update matching rep record if exists (match by email for ghost reps)
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
  WHERE NEW.email IS NOT NULL AND LOWER(email) = LOWER(NEW.email);

  -- Reset guard
  PERFORM set_config('app.syncing_from_other_table', 'false', true);

  RETURN NEW;
END;
$function$;

-- Update sync_rep_to_recruit to match on email only (no notion_page_id)
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

  -- Update matching recruit record (match by email only)
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
  WHERE NEW.email IS NOT NULL AND LOWER(email) = LOWER(NEW.email);

  -- Reset guard
  PERFORM set_config('app.syncing_from_other_table', 'false', true);

  RETURN NEW;
END;
$function$;

-- Update auto_create_rep_from_recruit to not use notion_page_id
CREATE OR REPLACE FUNCTION public.auto_create_rep_from_recruit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing_rep_count integer;
  _recruiter_rep record;
  _team_leader_name text;
  _team_leader_phone text;
BEGIN
  -- Only proceed if stage changed and new stage indicates signing or beyond
  IF (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    -- Check if new stage is Signed or beyond (case insensitive matching)
    IF (
      LOWER(NEW.stage) LIKE '%signed%' OR
      LOWER(NEW.stage) LIKE '%shadow%' OR
      (LOWER(NEW.stage) LIKE '%sold%' AND LOWER(NEW.stage) NOT LIKE '%100%')
    ) THEN
      -- Recruit must have email to create app account
      IF NEW.email IS NULL OR NEW.email = '' THEN
        RETURN NEW;
      END IF;

      -- Check if a rep already exists with this email
      SELECT COUNT(*) INTO _existing_rep_count
      FROM public.reps
      WHERE LOWER(email) = LOWER(NEW.email);

      IF _existing_rep_count > 0 THEN
        RETURN NEW;
      END IF;

      -- Get recruiter's info to set team leader
      IF NEW.recruiter_user_id IS NOT NULL THEN
        SELECT name, phone INTO _recruiter_rep
        FROM public.reps
        WHERE user_id = NEW.recruiter_user_id
        LIMIT 1;
        
        _team_leader_name := _recruiter_rep.name;
        _team_leader_phone := _recruiter_rep.phone;
      END IF;

      -- Create the ghost rep (user_id = NULL, will be linked on signup)
      INSERT INTO public.reps (
        name,
        email,
        phone,
        stage,
        year,
        team_leader,
        team_leader_phone,
        user_id,
        onboarding_complete,
        trainings_complete,
        slack_joined,
        ramp_phase_1_complete,
        ramp_phase_2_complete,
        ramp_phase_3_complete,
        ramp_phase_4_complete,
        blitz_ready,
        ipad_assigned
      ) VALUES (
        NEW.name,
        NEW.email,
        NEW.phone,
        NEW.stage,
        COALESCE(NEW.year, 'Rookie'),
        _team_leader_name,
        _team_leader_phone,
        NULL,  -- Ghost rep - user_id will be linked on signup
        COALESCE(NEW.onboarding_complete, false),
        COALESCE(NEW.trainings_complete, false),
        COALESCE(NEW.slack_joined, false),
        COALESCE(NEW.ramp_phase_1_complete, false),
        COALESCE(NEW.ramp_phase_2_complete, false),
        COALESCE(NEW.ramp_phase_3_complete, false),
        COALESCE(NEW.ramp_phase_4_complete, false),
        COALESCE(NEW.blitz_ready, false),
        COALESCE(NEW.ipad_assigned, false)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Update auto_create_rep_when_email_added to not use notion_page_id
CREATE OR REPLACE FUNCTION public.auto_create_rep_when_email_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing_rep_count integer;
  _recruiter_rep record;
  _team_leader_name text;
  _team_leader_phone text;
BEGIN
  -- Only proceed if email was just added or changed to a new value
  IF (NEW.email IS NOT NULL AND NEW.email != '' AND 
      (OLD.email IS NULL OR OLD.email = '' OR OLD.email IS DISTINCT FROM NEW.email)) THEN
    
    -- Check if a rep already exists with this email
    SELECT COUNT(*) INTO _existing_rep_count
    FROM public.reps
    WHERE LOWER(email) = LOWER(NEW.email);

    IF _existing_rep_count > 0 THEN
      -- Rep already exists, let sync_recruit_to_rep handle the update
      RETURN NEW;
    END IF;

    -- Get recruiter's info to set team leader
    IF NEW.recruiter_user_id IS NOT NULL THEN
      SELECT name, phone INTO _recruiter_rep
      FROM public.reps
      WHERE user_id = NEW.recruiter_user_id
      LIMIT 1;
      
      _team_leader_name := _recruiter_rep.name;
      _team_leader_phone := _recruiter_rep.phone;
    END IF;

    -- Create the ghost rep (user_id = NULL, will be linked on signup via link_rep_to_existing_user trigger)
    INSERT INTO public.reps (
      name,
      email,
      phone,
      stage,
      year,
      team_leader,
      team_leader_phone,
      user_id,
      onboarding_complete,
      trainings_complete,
      slack_joined,
      ramp_phase_1_complete,
      ramp_phase_2_complete,
      ramp_phase_3_complete,
      ramp_phase_4_complete,
      blitz_ready,
      ipad_assigned
    ) VALUES (
      NEW.name,
      NEW.email,
      NEW.phone,
      NEW.stage,
      COALESCE(NEW.year, 'Rookie'),
      _team_leader_name,
      _team_leader_phone,
      NULL,  -- Ghost rep - will be linked by link_rep_to_existing_user trigger
      COALESCE(NEW.onboarding_complete, false),
      COALESCE(NEW.trainings_complete, false),
      COALESCE(NEW.slack_joined, false),
      COALESCE(NEW.ramp_phase_1_complete, false),
      COALESCE(NEW.ramp_phase_2_complete, false),
      COALESCE(NEW.ramp_phase_3_complete, false),
      COALESCE(NEW.ramp_phase_4_complete, false),
      COALESCE(NEW.blitz_ready, false),
      COALESCE(NEW.ipad_assigned, false)
    );
    
    RAISE LOG 'Created ghost rep for recruit % with email %', NEW.name, NEW.email;
  END IF;

  RETURN NEW;
END;
$function$;