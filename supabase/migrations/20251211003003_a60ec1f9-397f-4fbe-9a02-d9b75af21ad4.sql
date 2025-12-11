-- Add intro_seen field to reps table to track if user has seen the intro wizard
ALTER TABLE public.reps ADD COLUMN IF NOT EXISTS intro_seen boolean DEFAULT false;