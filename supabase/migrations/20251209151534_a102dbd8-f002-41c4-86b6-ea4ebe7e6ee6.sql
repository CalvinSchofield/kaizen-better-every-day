-- Add CRM configuration columns to reps table
ALTER TABLE public.reps ADD COLUMN IF NOT EXISTS crm_enabled boolean DEFAULT false;
ALTER TABLE public.reps ADD COLUMN IF NOT EXISTS crm_detailed_enabled boolean DEFAULT false;

-- Add comment explaining the columns
COMMENT ON COLUMN public.reps.crm_enabled IS 'Enable simple CRM fields (name, phone, account number, location) when logging sales';
COMMENT ON COLUMN public.reps.crm_detailed_enabled IS 'Enable detailed CRM fields (time to sell, deal type, money spent, difficulty) - requires crm_enabled';