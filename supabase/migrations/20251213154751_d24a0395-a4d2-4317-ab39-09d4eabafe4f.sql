-- Add column to store dismissed recruit recommendations per leader
-- This persists across devices and sessions for premium UX
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS dismissed_recruit_ids jsonb DEFAULT '[]'::jsonb;