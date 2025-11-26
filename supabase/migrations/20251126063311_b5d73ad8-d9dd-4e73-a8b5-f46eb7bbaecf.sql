-- Add nudge_leader checkbox and last_nudge_time tracking to reps table
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS nudge_leader boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_nudge_time timestamp with time zone DEFAULT null;