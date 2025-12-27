
-- Create a trigger that auto-creates a ghost rep when email is added to any recruit
-- This ensures the account linking works regardless of when the email is added

CREATE OR REPLACE FUNCTION public.auto_create_rep_when_email_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _existing_rep_count integer;
  _recruiter_rep record;
  _team_leader_name text;
  _team_leader_phone text;
BEGIN
  -- Only proceed if email was just added or changed to a new value
  IF (NEW.email IS NOT NULL AND NEW.email != '' AND 
      (OLD.email IS NULL OR OLD.email = '' OR OLD.email IS DISTINCT FROM NEW.email)) THEN
    
    -- Check if a rep already exists with this email or notion_page_id
    SELECT COUNT(*) INTO _existing_rep_count
    FROM public.reps
    WHERE LOWER(email) = LOWER(NEW.email)
       OR notion_page_id = NEW.notion_page_id;

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
      notion_page_id,
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
      NEW.notion_page_id,
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
$$;

-- Create trigger that fires AFTER insert or update on recruits (when email is added)
DROP TRIGGER IF EXISTS on_recruit_email_added ON public.recruits;
CREATE TRIGGER on_recruit_email_added
  AFTER INSERT OR UPDATE OF email ON public.recruits
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_rep_when_email_added();

-- Add comment explaining the flow
COMMENT ON FUNCTION public.auto_create_rep_when_email_added() IS 
'Creates a ghost rep when an email is added to a recruit. This ensures:
1. The rep record exists when the user signs up
2. link_rep_to_existing_user can link them to their auth account
3. Works for recruits at any stage, not just "Signed" or beyond';
