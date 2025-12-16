-- Add video progress tracking to reps table
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS watched_videos jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN public.reps.watched_videos IS 'Array of video IDs that the rep has watched, e.g. ["what-is-blitz", "how-pay-works"]';