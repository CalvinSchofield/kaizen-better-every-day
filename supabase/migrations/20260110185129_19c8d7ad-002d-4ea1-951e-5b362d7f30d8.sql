-- Drop the existing check constraint and add a new one that includes 'anyone_who'
ALTER TABLE public.incentives DROP CONSTRAINT IF EXISTS incentives_target_type_check;

ALTER TABLE public.incentives ADD CONSTRAINT incentives_target_type_check 
CHECK (target_type IN ('first_to', 'most', 'group_total', 'anyone_who'));