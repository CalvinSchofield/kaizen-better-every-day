-- Add columns to rep_goals for weekly training history tracking
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS training_week_start date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS training_hours_history jsonb DEFAULT '[]'::jsonb;

-- Add comment explaining the columns
COMMENT ON COLUMN public.rep_goals.training_week_start IS 'Start date of the current training week (Sunday)';
COMMENT ON COLUMN public.rep_goals.training_hours_history IS 'Array of past weeks: [{week_start: "2025-01-05", minutes: 120}, ...]';