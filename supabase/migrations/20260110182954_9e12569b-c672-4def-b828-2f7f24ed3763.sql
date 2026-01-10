-- Add winner_user_ids column for 'anyone_who' incentives where multiple participants can win
ALTER TABLE public.incentives ADD COLUMN IF NOT EXISTS winner_user_ids jsonb DEFAULT '[]'::jsonb;

-- Add a comment to explain the column
COMMENT ON COLUMN public.incentives.winner_user_ids IS 'Array of user IDs who qualified for anyone_who type incentives. For other types, use winner_user_id.';