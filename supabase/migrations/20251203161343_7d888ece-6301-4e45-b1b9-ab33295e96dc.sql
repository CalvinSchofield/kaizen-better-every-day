-- Add sales_log column to daily_entries for tracking individual sales
ALTER TABLE daily_entries 
ADD COLUMN IF NOT EXISTS sales_log jsonb DEFAULT '[]'::jsonb;

-- Add sales_logger_enabled preference to reps table
ALTER TABLE reps 
ADD COLUMN IF NOT EXISTS sales_logger_enabled boolean DEFAULT false;