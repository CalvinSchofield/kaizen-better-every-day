
UPDATE reps SET intro_seen = false, onboarding_complete = false, pages_toured = '[]'::jsonb WHERE user_id = '63b693af-111b-4368-93ec-686e8172d4e7';
DELETE FROM rep_goals WHERE user_id = '63b693af-111b-4368-93ec-686e8172d4e7';
