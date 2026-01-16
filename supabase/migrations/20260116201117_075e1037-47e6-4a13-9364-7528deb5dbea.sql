-- Add significant_other_name and watch_out_notes columns to recruits table
-- These allow leaders to track important notes about recruits

ALTER TABLE public.recruits 
ADD COLUMN IF NOT EXISTS significant_other_name text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS watch_out_notes text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.recruits.significant_other_name IS 'Name of recruit''s significant other for relationship building';
COMMENT ON COLUMN public.recruits.watch_out_notes IS 'Leader notes about things to watch out for - objections, concerns, etc.';