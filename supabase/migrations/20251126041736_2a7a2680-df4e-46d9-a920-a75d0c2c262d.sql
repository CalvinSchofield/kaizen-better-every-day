-- Add team_leader_phone column to reps table
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS team_leader_phone text;