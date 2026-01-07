-- Add 'group_total' as a valid target_type for incentives
-- No schema change needed since target_type is TEXT, but let's add a comment
-- The valid values are now: 'first_to', 'most_by_end', 'group_total'

COMMENT ON COLUMN public.incentives.target_type IS 'Valid values: first_to (first individual to reach target), most_by_end (individual with most by end), group_total (group collectively reaches target)';