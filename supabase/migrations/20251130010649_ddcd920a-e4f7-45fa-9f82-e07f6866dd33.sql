-- Add custom counter configuration to reps table
ALTER TABLE public.reps 
ADD COLUMN custom_counter_config JSONB DEFAULT '[]'::jsonb;

-- Add custom counters data to daily_entries table
ALTER TABLE public.daily_entries 
ADD COLUMN custom_counters JSONB DEFAULT '{}'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN public.reps.custom_counter_config IS 'Array of custom counter definitions: [{"id": "uuid", "name": "Referrals", "emoji": "🎯"}]';
COMMENT ON COLUMN public.daily_entries.custom_counters IS 'Daily values for custom counters: {"counter_id_1": 5, "counter_id_2": 3}';