-- Unified UUID Migration: Make reps.id match recruits.id for email-matched pairs
-- Must handle ALL FK constraints properly

-- Step 1: Drop all foreign key constraints that reference reps table
ALTER TABLE blitz_declines DROP CONSTRAINT IF EXISTS blitz_declines_rep_id_fkey;
ALTER TABLE blitz_invites DROP CONSTRAINT IF EXISTS blitz_invites_rep_id_fkey;
ALTER TABLE recruits DROP CONSTRAINT IF EXISTS recruits_recruiter_user_id_fkey;
ALTER TABLE teams DROP CONSTRAINT IF EXISTS teams_lead_user_id_fkey;
ALTER TABLE mgmt_groups DROP CONSTRAINT IF EXISTS mgmt_groups_lead_user_id_fkey;

-- Step 2: Create a mapping table to track the ID changes
CREATE TEMP TABLE id_migration_map AS
SELECT 
  rep.id as old_rep_id,
  r.id as new_rep_id,
  rep.user_id,
  rep.email
FROM reps rep
JOIN recruits r ON LOWER(rep.email) = LOWER(r.email)
WHERE rep.email IS NOT NULL
  AND rep.id != r.id;

-- Step 3: Update blitz_declines to use the new rep IDs
UPDATE blitz_declines bd
SET rep_id = m.new_rep_id
FROM id_migration_map m
WHERE bd.rep_id = m.old_rep_id;

-- Step 4: Update blitz_invites to use the new rep IDs
UPDATE blitz_invites bi
SET rep_id = m.new_rep_id
FROM id_migration_map m
WHERE bi.rep_id = m.old_rep_id;

-- Step 5: Create a backup of rep data we need to preserve
CREATE TEMP TABLE rep_data_backup AS
SELECT 
  r.id as new_id,
  rep.user_id,
  rep.name,
  rep.email,
  rep.phone,
  rep.year,
  rep.stage,
  rep.team_leader,
  rep.team_leader_phone,
  rep.recruiter,
  rep.onboarding_complete,
  rep.trainings_complete,
  rep.slack_joined,
  rep.ramp_phase_1_complete,
  rep.ramp_phase_2_complete,
  rep.ramp_phase_3_complete,
  rep.ramp_phase_4_complete,
  rep.blitz_ready,
  rep.ipad_assigned,
  rep.path_to_pro_started,
  rep.path_to_pro_progress,
  rep.completed_tasks,
  rep.nudge_leader,
  rep.last_nudge_time,
  rep.personal_fp,
  rep.personal_fp_goal,
  rep.reps_with_sale,
  rep.reps_with_sale_goal,
  rep.blitz_trip_date,
  rep.blitz_trip_end_date,
  rep.blitz_trip_name,
  rep.blitz_trip_location,
  rep.committed_blitzes,
  rep.contacted_for_blitz,
  rep.declined_blitz_rsvps,
  rep.custom_counter_config,
  rep.efp_mode_enabled,
  rep.counter_layout_config,
  rep.sales_logger_enabled,
  rep.crm_enabled,
  rep.crm_detailed_enabled,
  rep.intro_seen,
  rep.dismissed_recruit_ids,
  rep.me_vs_me_enabled,
  rep.processed_blitz_ids,
  rep.watched_videos,
  rep.ramp_to_blitz_phase,
  rep.timezone,
  rep.profile_photo_url,
  rep.rsvp_first_window_ack_blitz_ids,
  rep.rsvp_second_window_ack_blitz_ids,
  rep.created_at,
  rep.id as old_rep_id
FROM reps rep
JOIN recruits r ON LOWER(rep.email) = LOWER(r.email)
WHERE rep.email IS NOT NULL
  AND rep.id != r.id;

-- Step 6: Delete the old rep records that will be replaced
DELETE FROM reps 
WHERE id IN (SELECT old_rep_id FROM rep_data_backup);

-- Step 7: Insert the rep records with the new (recruit) IDs
INSERT INTO reps (
  id, user_id, name, email, phone, year, stage, team_leader, team_leader_phone, recruiter,
  onboarding_complete, trainings_complete, slack_joined,
  ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete,
  blitz_ready, ipad_assigned, path_to_pro_started, path_to_pro_progress,
  completed_tasks, nudge_leader, last_nudge_time, personal_fp, personal_fp_goal,
  reps_with_sale, reps_with_sale_goal, blitz_trip_date, blitz_trip_end_date,
  blitz_trip_name, blitz_trip_location, committed_blitzes, contacted_for_blitz,
  declined_blitz_rsvps, custom_counter_config, efp_mode_enabled, counter_layout_config,
  sales_logger_enabled, crm_enabled, crm_detailed_enabled, intro_seen,
  dismissed_recruit_ids, me_vs_me_enabled, processed_blitz_ids, watched_videos,
  ramp_to_blitz_phase, timezone, profile_photo_url,
  rsvp_first_window_ack_blitz_ids, rsvp_second_window_ack_blitz_ids, created_at, updated_at
)
SELECT 
  new_id, user_id, name, email, phone, year, stage, team_leader, team_leader_phone, recruiter,
  onboarding_complete, trainings_complete, slack_joined,
  ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete,
  blitz_ready, ipad_assigned, path_to_pro_started, path_to_pro_progress,
  completed_tasks, nudge_leader, last_nudge_time, personal_fp, personal_fp_goal,
  reps_with_sale, reps_with_sale_goal, blitz_trip_date, blitz_trip_end_date,
  blitz_trip_name, blitz_trip_location, committed_blitzes, contacted_for_blitz,
  declined_blitz_rsvps, custom_counter_config, efp_mode_enabled, counter_layout_config,
  sales_logger_enabled, crm_enabled, crm_detailed_enabled, intro_seen,
  dismissed_recruit_ids, me_vs_me_enabled, processed_blitz_ids, watched_videos,
  ramp_to_blitz_phase, timezone, profile_photo_url,
  rsvp_first_window_ack_blitz_ids, rsvp_second_window_ack_blitz_ids, created_at, NOW()
FROM rep_data_backup;

-- Step 8: Re-add all the foreign key constraints
ALTER TABLE blitz_declines 
ADD CONSTRAINT blitz_declines_rep_id_fkey 
FOREIGN KEY (rep_id) REFERENCES reps(id);

ALTER TABLE blitz_invites 
ADD CONSTRAINT blitz_invites_rep_id_fkey 
FOREIGN KEY (rep_id) REFERENCES reps(id);

ALTER TABLE recruits 
ADD CONSTRAINT recruits_recruiter_user_id_fkey 
FOREIGN KEY (recruiter_user_id) REFERENCES reps(user_id);

ALTER TABLE teams 
ADD CONSTRAINT teams_lead_user_id_fkey 
FOREIGN KEY (lead_user_id) REFERENCES reps(user_id);

ALTER TABLE mgmt_groups 
ADD CONSTRAINT mgmt_groups_lead_user_id_fkey 
FOREIGN KEY (lead_user_id) REFERENCES reps(user_id);

-- Step 9: Update the auto_create_rep_from_recruit trigger to use recruit's ID
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
  IF (OLD.stage IS DISTINCT FROM NEW.stage) THEN
    IF (
      LOWER(NEW.stage) LIKE '%signed%' OR
      LOWER(NEW.stage) LIKE '%shadow%' OR
      (LOWER(NEW.stage) LIKE '%sold%' AND LOWER(NEW.stage) NOT LIKE '%100%')
    ) THEN
      IF NEW.email IS NULL OR NEW.email = '' THEN
        RETURN NEW;
      END IF;

      SELECT COUNT(*) INTO _existing_rep_count
      FROM public.reps
      WHERE LOWER(email) = LOWER(NEW.email) OR id = NEW.id;

      IF _existing_rep_count > 0 THEN
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
  END IF;
  RETURN NEW;
END;
$function$;

-- Step 10: Update the auto_create_rep_when_email_added trigger to use recruit's ID
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
  IF (NEW.email IS NOT NULL AND NEW.email != '' AND 
      (OLD.email IS NULL OR OLD.email = '' OR OLD.email IS DISTINCT FROM NEW.email)) THEN
    
    SELECT COUNT(*) INTO _existing_rep_count
    FROM public.reps
    WHERE LOWER(email) = LOWER(NEW.email) OR id = NEW.id;

    IF _existing_rep_count > 0 THEN
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
$function$;