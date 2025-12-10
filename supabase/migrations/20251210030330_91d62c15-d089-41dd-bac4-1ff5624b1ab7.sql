-- Add unique constraint on user_id for rep_goals table
-- This enables the upsert functionality to work correctly
ALTER TABLE public.rep_goals 
ADD CONSTRAINT rep_goals_user_id_unique UNIQUE (user_id);