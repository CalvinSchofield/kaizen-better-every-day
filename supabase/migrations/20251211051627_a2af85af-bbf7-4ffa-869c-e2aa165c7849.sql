-- Add prep_score_history column to rep_goals for tracking weekly prep scores
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS prep_score_history jsonb DEFAULT '[]'::jsonb;