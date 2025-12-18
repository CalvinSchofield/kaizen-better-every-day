-- Add custom_payscale_fp column to rep_goals table for ROI calculation customization
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS custom_payscale_fp numeric DEFAULT NULL;