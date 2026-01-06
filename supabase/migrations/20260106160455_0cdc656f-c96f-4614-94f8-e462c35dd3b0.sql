-- Add preferred ROI mode column to rep_goals table
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS preferred_roi_mode text DEFAULT 'upfront';