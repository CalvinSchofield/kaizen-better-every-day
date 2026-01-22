-- Add spouse name and caution notes columns to recruits table
ALTER TABLE public.recruits ADD COLUMN IF NOT EXISTS spouse_name TEXT;
ALTER TABLE public.recruits ADD COLUMN IF NOT EXISTS caution_notes TEXT;