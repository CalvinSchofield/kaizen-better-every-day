-- Function to auto-create a reps record when a recruit reaches "Signed" or higher stage
CREATE OR REPLACE FUNCTION public.auto_create_rep_from_recruit()
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

      -- Check if a rep already exists with this email or notion_page_id
      SELECT COUNT(*) INTO _existing_rep_count
      FROM public.reps
      WHERE LOWER(email) = LOWER(NEW.email)
         OR notion_page_id = NEW.notion_page_id;

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
$$;

-- Create trigger on recruits table
DROP TRIGGER IF EXISTS on_recruit_stage_signed ON public.recruits;
CREATE TRIGGER on_recruit_stage_signed
  AFTER UPDATE ON public.recruits
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_rep_from_recruit();

-- Function to sync recruit changes to existing reps
CREATE OR REPLACE FUNCTION public.sync_recruit_to_rep()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Update matching rep record if exists (match by notion_page_id or email for ghost reps)
  UPDATE public.reps
  SET 
    name = COALESCE(NEW.name, name),
    email = COALESCE(NEW.email, email),
    phone = COALESCE(NEW.phone, phone),
    stage = COALESCE(NEW.stage, stage),
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
     OR (user_id IS NULL AND LOWER(email) = LOWER(NEW.email));

  RETURN NEW;
END;
$$;

-- Create sync trigger
DROP TRIGGER IF EXISTS on_recruit_sync_to_rep ON public.recruits;
CREATE TRIGGER on_recruit_sync_to_rep
  AFTER UPDATE ON public.recruits
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION public.sync_recruit_to_rep();