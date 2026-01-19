-- Add custom_fp_pace column to rep_goals for custom projected EFP/FP+ pace
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS custom_fp_pace numeric;