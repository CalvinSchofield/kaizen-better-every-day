
-- Fix mismatched UUIDs: Update reps to use recruit IDs where names match
-- This consolidates the dual-record problem by making reps.id = recruits.id

-- Step 1: For each recruit with a matching rep (by name) but different ID,
-- update the rep's id to match the recruit's id
-- We need to delete the old rep record and insert a new one with the correct ID

-- First, create a temp table to store the mappings
CREATE TEMP TABLE id_mappings AS
SELECT 
  r.id as recruit_id,
  r.name as recruit_name,
  rep.id as old_rep_id,
  rep.name as rep_name,
  rep.user_id as rep_user_id,
  rep.email as rep_email,
  rep.phone as rep_phone,
  rep.stage as rep_stage,
  rep.year as rep_year,
  rep.team_leader as rep_team_leader,
  rep.team_leader_phone as rep_team_leader_phone,
  rep.onboarding_complete as rep_onboarding_complete,
  rep.trainings_complete as rep_trainings_complete,
  rep.slack_joined as rep_slack_joined,
  rep.ramp_phase_1_complete as rep_ramp_phase_1_complete,
  rep.ramp_phase_2_complete as rep_ramp_phase_2_complete,
  rep.ramp_phase_3_complete as rep_ramp_phase_3_complete,
  rep.ramp_phase_4_complete as rep_ramp_phase_4_complete,
  rep.blitz_ready as rep_blitz_ready,
  rep.ipad_assigned as rep_ipad_assigned,
  rep.committed_blitzes as rep_committed_blitzes,
  rep.watched_videos as rep_watched_videos,
  rep.personal_fp as rep_personal_fp,
  rep.reps_with_sale as rep_reps_with_sale,
  rep.crm_enabled as rep_crm_enabled,
  rep.crm_detailed_enabled as rep_crm_detailed_enabled,
  rep.created_at as rep_created_at
FROM recruits r
JOIN reps rep ON LOWER(TRIM(REGEXP_REPLACE(r.name, '[^\w\s]', '', 'g'))) = LOWER(TRIM(REGEXP_REPLACE(rep.name, '[^\w\s]', '', 'g')))
WHERE r.id != rep.id
  AND NOT EXISTS (
    -- Don't process if a rep with the recruit's ID already exists
    SELECT 1 FROM reps existing WHERE existing.id = r.id
  );

-- Step 2: Delete the old rep records (the ones with wrong IDs)
DELETE FROM reps 
WHERE id IN (SELECT old_rep_id FROM id_mappings);

-- Step 3: Insert new rep records with the correct IDs (matching recruit IDs)
INSERT INTO reps (
  id, name, email, phone, stage, year, team_leader, team_leader_phone, user_id,
  onboarding_complete, trainings_complete, slack_joined,
  ramp_phase_1_complete, ramp_phase_2_complete, ramp_phase_3_complete, ramp_phase_4_complete,
  blitz_ready, ipad_assigned, committed_blitzes, watched_videos, personal_fp, reps_with_sale,
  crm_enabled, crm_detailed_enabled, created_at, updated_at
)
SELECT 
  recruit_id, -- Use the recruit's ID
  rep_name,
  rep_email,
  rep_phone,
  rep_stage,
  rep_year,
  rep_team_leader,
  rep_team_leader_phone,
  rep_user_id,
  rep_onboarding_complete,
  rep_trainings_complete,
  rep_slack_joined,
  rep_ramp_phase_1_complete,
  rep_ramp_phase_2_complete,
  rep_ramp_phase_3_complete,
  rep_ramp_phase_4_complete,
  rep_blitz_ready,
  rep_ipad_assigned,
  rep_committed_blitzes,
  rep_watched_videos,
  rep_personal_fp,
  rep_reps_with_sale,
  rep_crm_enabled,
  rep_crm_detailed_enabled,
  rep_created_at,
  NOW()
FROM id_mappings;

-- Clean up
DROP TABLE id_mappings;
