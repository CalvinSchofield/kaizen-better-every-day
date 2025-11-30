-- Add timezone field to reps table if it doesn't exist
ALTER TABLE reps ADD COLUMN IF NOT EXISTS timezone TEXT;