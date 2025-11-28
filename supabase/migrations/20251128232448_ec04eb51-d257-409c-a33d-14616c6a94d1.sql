-- Add declined_blitz_rsvps column to track blitzes user has declined
ALTER TABLE reps ADD COLUMN declined_blitz_rsvps jsonb DEFAULT '[]'::jsonb;