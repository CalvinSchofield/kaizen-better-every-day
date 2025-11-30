-- Add upgrade_prmr column to daily_entries table
ALTER TABLE public.daily_entries 
ADD COLUMN upgrade_prmr numeric DEFAULT NULL;

COMMENT ON COLUMN public.daily_entries.upgrade_prmr IS 'Calculated upgrade PRMR (upgrade FP+ × 85). NULL = unknown for historical data.';