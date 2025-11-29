-- Add time tracking columns to daily_entries table
ALTER TABLE daily_entries
ADD COLUMN work_start_time TIMESTAMPTZ,
ADD COLUMN work_end_time TIMESTAMPTZ,
ADD COLUMN break_periods JSONB DEFAULT '[]'::jsonb,
ADD COLUMN counter_timestamps JSONB DEFAULT '{}'::jsonb,
ADD COLUMN timezone TEXT;

-- Add comment explaining the time tracking columns
COMMENT ON COLUMN daily_entries.work_start_time IS 'When the work session began (stored in UTC)';
COMMENT ON COLUMN daily_entries.work_end_time IS 'When the work session ended (stored in UTC)';
COMMENT ON COLUMN daily_entries.break_periods IS 'Array of break periods with start and end times: [{start: "timestamp", end: "timestamp"}]';
COMMENT ON COLUMN daily_entries.counter_timestamps IS 'Timestamps for each counter interaction: {doors_knocked: ["timestamp1", ...], pitches: [...]}';
COMMENT ON COLUMN daily_entries.timezone IS 'User timezone (e.g., America/Denver) for local time conversions';