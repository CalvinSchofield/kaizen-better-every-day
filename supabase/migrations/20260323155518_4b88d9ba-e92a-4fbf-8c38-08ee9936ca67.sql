
-- Delete related records first
DELETE FROM recruit_activities WHERE recruit_id = 'e2a3f9bf-c267-49d4-88df-2a54b0f08258';
DELETE FROM recruit_activity_read_status WHERE recruit_id = 'e2a3f9bf-c267-49d4-88df-2a54b0f08258';
DELETE FROM reps WHERE id = 'e2a3f9bf-c267-49d4-88df-2a54b0f08258';
DELETE FROM recruits WHERE id = 'e2a3f9bf-c267-49d4-88df-2a54b0f08258';
-- Delete the auth user (email@test.com)
DELETE FROM auth.users WHERE LOWER(email) = 'email@test.com';
