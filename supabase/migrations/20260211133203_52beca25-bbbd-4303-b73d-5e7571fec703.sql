
-- Trigger: When a recruit moves to a "quit" stage, cascade their recruiter_user_id
-- to their recruiter's recruiter for all recruits they recruited.
-- Also log a system activity for each affected recruit.

CREATE OR REPLACE FUNCTION public.cascade_recruiter_on_quit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _quitting_user_id uuid;
  _upstream_recruiter_user_id uuid;
  _upstream_recruiter_name text;
  _quitting_name text;
  _affected_recruit RECORD;
  _quit_stages text[] := ARRAY['Not Interested', 'Signed but Not Interested', 'Potential Follow Up'];
BEGIN
  -- Only fire when stage changes TO a quit stage
  IF NOT (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    RETURN NEW;
  END IF;
  
  -- Check if new stage is a quit stage (use normalized comparison)
  IF NOT (normalize_stage(NEW.stage) = ANY(_quit_stages)) THEN
    RETURN NEW;
  END IF;
  
  _quitting_name := NEW.name;
  
  -- Find the user_id of the quitting recruit (they may be in reps table)
  SELECT user_id INTO _quitting_user_id
  FROM public.reps
  WHERE id = NEW.id AND user_id IS NOT NULL;
  
  -- If the quitting person has no user_id, they can't be a recruiter, skip
  IF _quitting_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Find their upstream recruiter (the recruiter of the quitting person)
  _upstream_recruiter_user_id := NEW.recruiter_user_id;
  
  -- Get the upstream recruiter's name for logging
  IF _upstream_recruiter_user_id IS NOT NULL THEN
    SELECT name INTO _upstream_recruiter_name
    FROM public.reps
    WHERE user_id = _upstream_recruiter_user_id
    LIMIT 1;
  END IF;
  
  -- Find all recruits that have the quitting person as their recruiter
  FOR _affected_recruit IN
    SELECT id, name FROM public.recruits
    WHERE recruiter_user_id = _quitting_user_id
      AND id != NEW.id
  LOOP
    -- Update the recruit's recruiter to the upstream recruiter
    UPDATE public.recruits
    SET recruiter_user_id = _upstream_recruiter_user_id,
        updated_at = NOW()
    WHERE id = _affected_recruit.id;
    
    -- Log a system activity
    INSERT INTO public.recruit_activities (
      recruit_id,
      activity_type,
      logged_by_user_id,
      notes
    ) VALUES (
      _affected_recruit.id,
      'note',
      COALESCE(_upstream_recruiter_user_id, _quitting_user_id),
      'Recruiter automatically changed from ' || _quitting_name || 
      ' to ' || COALESCE(_upstream_recruiter_name, 'none') ||
      ' because ' || _quitting_name || ' moved to "' || NEW.stage || '"'
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Create the trigger on the recruits table
CREATE TRIGGER cascade_recruiter_on_quit_trigger
  AFTER UPDATE ON public.recruits
  FOR EACH ROW
  EXECUTE FUNCTION public.cascade_recruiter_on_quit();
