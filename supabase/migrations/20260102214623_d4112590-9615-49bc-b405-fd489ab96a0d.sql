-- Add pages_toured column to track which page tours users have completed
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS pages_toured jsonb DEFAULT '[]'::jsonb;