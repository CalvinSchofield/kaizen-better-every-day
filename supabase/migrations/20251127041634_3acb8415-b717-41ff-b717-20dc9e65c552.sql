-- Add committed_blitzes field to reps table for tracking multiple blitz commitments
ALTER TABLE public.reps
ADD COLUMN IF NOT EXISTS committed_blitzes jsonb DEFAULT '[]'::jsonb;