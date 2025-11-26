-- Add goal tracking columns to reps table
ALTER TABLE public.reps 
ADD COLUMN IF NOT EXISTS personal_fp integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS personal_fp_goal integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reps_with_sale integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS reps_with_sale_goal integer DEFAULT 0;