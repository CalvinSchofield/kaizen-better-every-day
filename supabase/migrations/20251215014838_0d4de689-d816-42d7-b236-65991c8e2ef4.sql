-- Add column to track processed blitz attendance (persists across devices)
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS processed_blitz_ids jsonb DEFAULT '[]'::jsonb;