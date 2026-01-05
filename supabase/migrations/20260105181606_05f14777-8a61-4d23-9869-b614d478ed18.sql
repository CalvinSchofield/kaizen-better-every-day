CREATE OR REPLACE FUNCTION public.auto_create_rep_when_email_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _existing_rep_count integer;
  _existing_rep_by_name record;
  _recruiter_rep record;
  _team_leader_name text;
  _team_leader_phone text;
BEGIN
  IF (NEW.email IS NOT NULL AND NEW.email != '' AND 
      (OLD.email IS NULL OR OLD.email = '' OR OLD.email IS DISTINCT FROM NEW.email)) THEN
    
    -- Check if rep already exists by email or by this recruit's ID
    SELECT COUNT(*) INTO _existing_rep_count
    FROM public.reps
    WHERE LOWER(email) = LOWER(NEW.email) OR id = NEW.id;

    IF _existing_rep_count > 0 THEN
      -- If rep exists by email or ID, just update the email on the matching rep
      UPDATE public.reps
      SET email = NEW.email, updated_at = NOW()
      WHERE id = NEW.id OR LOWER(email) = LOWER(NEW.email);
      RETURN NEW;
    END IF;

    -- Check if a rep with the same normalized name already exists
    SELECT id, email INTO _existing_rep_by_name
    FROM public.reps
    WHERE normalize_name(name) = normalize_name(NEW.name)
    LIMIT 1;

    IF _existing_rep_by_name.id IS NOT NULL THEN
      -- Update the existing rep's email instead of creating a new one
      UPDATE public.reps
      SET email = NEW.email, updated_at = NOW()
      WHERE id = _existing_rep_by_name.id;
      RETURN NEW;
    END IF;

    IF NEW.recruiter_user_id IS NOT NULL THEN
      SELECT name, phone INTO _recruiter_rep
      FROM public.reps
      WHERE user_id = NEW.recruiter_user_id
      LIMIT 1;
      
      _team_leader_name := _recruiter_rep.name;
      _team_leader_phone := _recruiter_rep.phone;
    END IF;

    INSERT INTO public.reps (
      id, name, email, phone, stage, year, team_leader, team_leader_phone, user_id,
      onboarding_complete, trainings_complete, slack_joined,
      ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete,
      blitz_ready, ipad_assigned
    ) VALUES (
      NEW.id, NEW.name, NEW.email, NEW.phone, NEW.stage, COALESCE(NEW.year, 'Rookie'),
      _team_leader_name, _team_leader_phone, NULL,
      COALESCE(NEW.onboarding_complete, false), COALESCE(NEW.trainings_complete, false),
      COALESCE(NEW.slack_joined, false), COALESCE(NEW.ramp_phase_1_complete, false),
      COALESCE(NEW.ramp_phase_2_complete, false), COALESCE(NEW.ramp_phase_3_complete, false),
      COALESCE(NEW.ramp_phase_4_complete, false), COALESCE(NEW.blitz_ready, false),
      COALESCE(NEW.ipad_assigned, false)
    );
  END IF;
  RETURN NEW;
END;
$function$