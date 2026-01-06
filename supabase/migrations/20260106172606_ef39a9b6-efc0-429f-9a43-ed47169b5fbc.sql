-- Set default value for crm_enabled to true for new reps
ALTER TABLE public.reps 
ALTER COLUMN crm_enabled SET DEFAULT true;

-- Update existing reps who have null or false to have crm_enabled = true
UPDATE public.reps 
SET crm_enabled = true 
WHERE crm_enabled IS NULL OR crm_enabled = false;