-- Add efp_mode_enabled column to reps table
ALTER TABLE reps ADD COLUMN efp_mode_enabled boolean DEFAULT false;