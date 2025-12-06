-- Add cancel_rate column to rep_goals for cancel/unfunded rate percentage
-- Stored as decimal (e.g., 0.10 = 10%)
-- Default to 0.10 (10%) for all users
ALTER TABLE public.rep_goals 
ADD COLUMN IF NOT EXISTS cancel_rate numeric DEFAULT 0.10;

-- Add comment for documentation
COMMENT ON COLUMN public.rep_goals.cancel_rate IS 'Cancel/unfunded rate as decimal (0.05-0.15). Used to adjust goals to account for expected cancellations. Rookies default to 0.10 (10%)';