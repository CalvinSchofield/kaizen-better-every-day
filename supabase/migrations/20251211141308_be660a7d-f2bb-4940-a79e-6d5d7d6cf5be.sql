-- Add training streak tracking fields to rep_goals
ALTER TABLE public.rep_goals
ADD COLUMN training_streak integer DEFAULT 0,
ADD COLUMN last_training_date date DEFAULT NULL;